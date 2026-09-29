# LawBattle RAG Python 학습 가이드

## 1. 먼저 설치할 최소 패키지

4060 노트북에서 Python 가상환경을 만든 뒤 시작한다.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install numpy tqdm pydantic FlagEmbedding qdrant-client
```

처음에는 LangChain이나 LlamaIndex 없이 직접 구현한다. 두 프레임워크는 편리하지만 청킹, 검색, 점수 결합이 어떻게 작동하는지 가릴 수 있다. 기본 파이프라인을 이해한 뒤 비교용으로 사용한다.

## 2. 기본 Python 모듈

| 모듈 | 자주 쓰는 함수·클래스 | 용도 |
|---|---|---|
| `json` | `json.loads`, `json.dumps` | JSONL 한 줄 파싱, 결과 저장 |
| `pathlib` | `Path`, `read_text`, `open` | 운영체제와 무관한 파일 경로 |
| `dataclasses` | `@dataclass`, `field` | `Document`, `Chunk` 자료형 |
| `typing` | `Iterable`, `Sequence`, `Literal` | 함수 입력·출력 타입 표시 |
| `hashlib` | `sha256` | 내용 기반 chunk ID 생성 |
| `logging` | `getLogger`, `info`, `warning` | 수집·임베딩 진행 기록 |
| `time` | `perf_counter` | 검색과 reranking 지연시간 측정 |
| `collections` | `defaultdict` | parent 문서별 검색 결과 묶기 |

JSONL은 전체 파일을 한꺼번에 읽지 않고 줄 단위로 처리할 수 있다.

```python
import json
from pathlib import Path

def load_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as file:
        return [json.loads(line) for line in file if line.strip()]
```

실제 15,000건 자료에서는 `list`로 전부 만들기보다 `yield`를 사용하는 generator로 바꾸는 연습도 할 수 있다.

## 3. 배열과 유사도

`numpy`는 임베딩 배열과 간단한 baseline 검색에 사용한다.

| 함수 | 의미 |
|---|---|
| `np.asarray(values, dtype=np.float32)` | Python 리스트를 벡터 배열로 변환 |
| `np.linalg.norm(vector)` | 벡터 크기 계산 |
| `matrix @ query_vector` | 정규화된 벡터의 내적·코사인 유사도 |
| `np.argsort(scores)[::-1]` | 높은 점수부터 문서 순위 생성 |
| `np.argpartition` | 전체 정렬 없이 상위 K개 후보 선택 |

임베딩을 미리 L2 정규화했다면 코사인 유사도는 내적으로 계산할 수 있다.

```python
matrix = matrix / np.linalg.norm(matrix, axis=1, keepdims=True)
query = query / np.linalg.norm(query)
scores = matrix @ query
top_ids = np.argsort(scores)[::-1][:10]
```

이 코드는 학습용 baseline이다. 실제 서비스 검색은 Qdrant의 인덱스를 사용한다.

## 4. BGE-M3 임베딩

`FlagEmbedding`의 핵심 클래스와 함수는 다음과 같다.

```python
from FlagEmbedding import BGEM3FlagModel

model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)
output = model.encode(
    texts,
    batch_size=8,
    max_length=1024,
    return_dense=True,
    return_sparse=True,
    return_colbert_vecs=False,
)

dense_vectors = output["dense_vecs"]
sparse_vectors = output["lexical_weights"]
```

- `dense_vecs`: 의미 검색용 1,024차원 벡터
- `lexical_weights`: 정확한 단어 검색용 sparse 가중치
- `colbert_vecs`: 고급 multi-vector 실험용; 처음에는 끈다
- `max_length`: 항상 모델 최대치로 둘 필요가 없다. chunk 크기에 맞춰 줄이면 빠르다.
- `batch_size`: VRAM 사용량을 보며 4, 8, 16 순서로 높인다.

BGE-M3 공식 구현은 Dense, Sparse, Multi-vector를 한 모델에서 지원한다. [BGE-M3 모델 카드](https://huggingface.co/BAAI/bge-m3)

Dense만 빠르게 시험할 때는 `sentence-transformers`의 `SentenceTransformer.encode()`도 자주 쓴다. BGE-M3의 sparse 출력까지 학습하려면 `FlagEmbedding`을 사용하는 편이 명확하다.

## 5. Qdrant client

주로 사용하는 객체는 다음과 같다.

```python
from qdrant_client import QdrantClient, models
```

| 객체·메서드 | 용도 |
|---|---|
| `QdrantClient(path=...)` | 디스크에 저장하는 로컬 모드 |
| `QdrantClient(url=...)` | 실행 중인 Qdrant 서버 연결 |
| `client.collection_exists()` | 컬렉션 존재 확인 |
| `client.create_collection()` | dense·sparse 벡터 구조 생성 |
| `client.upsert()` | chunk와 payload를 batch 저장 |
| `client.query_points()` | 검색, filter, hybrid query |
| `models.PointStruct` | ID, vector, payload 한 건 |
| `models.VectorParams` | dense 차원과 거리함수 설정 |
| `models.SparseVectorParams` | sparse 벡터 설정 |
| `models.Filter` | 사건종류·날짜·자료유형 필터 |
| `models.Prefetch` | Dense와 Sparse 후보를 각각 먼저 검색 |
| `models.FusionQuery` | RRF 등으로 후보 순위 결합 |

Qdrant의 현재 Query API는 `prefetch`로 여러 검색을 실행한 뒤 RRF 또는 DBSF로 합치는 방식을 지원한다. [Qdrant Hybrid Query 문서](https://qdrant.tech/documentation/search/hybrid-queries/)

처음에는 컬렉션 두 개를 사용한다.

```text
precedents       가상·실제 판례 chunk
statutes_current 현행 법령 조문 chunk
```

payload에는 `parent_id`, `section_id`, `document_type`, `decision_date`, `topics`, `text`를 보관한다. 벡터 검색 후 `parent_id` 기준으로 묶을 수 있어야 한다.

## 6. Reranker

reranker는 질의와 후보 passage를 한 쌍으로 직접 비교한다.

```python
from FlagEmbedding import FlagReranker

reranker = FlagReranker("BAAI/bge-reranker-v2-m3", use_fp16=True)
pairs = [[query, candidate["text"]] for candidate in candidates]
scores = reranker.compute_score(pairs, normalize=True)
```

전체 DB를 rerank하지 않고 Hybrid 검색 상위 20~30개에만 적용한다. `bge-reranker-v2-m3`는 다국어용 cross-encoder다. [공식 모델 카드](https://huggingface.co/BAAI/bge-reranker-v2-m3)

## 7. 평가에 쓰는 함수

처음에는 라이브러리보다 직접 구현해 계산을 이해한다.

```python
def recall_at_k(ranked_ids: list[str], relevant_ids: set[str], k: int) -> float:
    found = len(set(ranked_ids[:k]) & relevant_ids)
    return found / len(relevant_ids) if relevant_ids else 0.0

def reciprocal_rank(ranked_ids: list[str], relevant_ids: set[str]) -> float:
    for rank, document_id in enumerate(ranked_ids, start=1):
        if document_id in relevant_ids:
            return 1.0 / rank
    return 0.0
```

다음 단계에서 `ranx`, `ir-measures` 또는 `pytrec_eval` 같은 정보검색 평가 라이브러리로 결과를 검산할 수 있다. 먼저 기록할 지표는 다음 네 가지다.

- `Recall@10`: 관련 자료를 상위 10개 안에서 얼마나 찾았는가
- `MRR`: 첫 관련 자료가 얼마나 위에 있는가
- `nDCG@10`: 관련성 등급까지 고려한 순위 품질
- 검색 지연시간: `time.perf_counter()`로 측정

## 8. 보조 패키지

| 패키지 | 사용할 시점 |
|---|---|
| `tqdm` | 임베딩 batch 진행률 표시 |
| `pydantic` | API 응답과 chunk schema 검증 |
| `httpx` | 비동기 HTTP 수집기로 확장할 때; 현재 API는 순차 호출 유지 |
| `pandas` | 실험 결과 표와 CSV 비교 |
| `pytest` | Python 함수 단위 테스트 |
| `rank-bm25` | 작은 데이터에서 전통 BM25 baseline 비교 |
| `langchain`, `llama-index` | 직접 구현한 파이프라인과 프레임워크를 비교할 때 |

## 9. 직접 작성할 첫 함수

아래 네 함수를 첫 과제로 구현한다.

```python
def load_documents(path: Path) -> list[dict]: ...

def chunk_document(document: dict) -> list[dict]: ...

def build_search_text(document: dict, section: dict) -> str: ...

def evaluate_recall(results: dict[str, list[str]], queries: list[dict], k: int) -> float: ...
```

첫 버전의 `chunk_document()`는 `sections` 한 개를 chunk 한 개로 바꾸면 된다. chunk ID는 `{document_id}:{section_id}`로 만들고 `parent_id`에 원문 문서 ID를 저장한다. 이 단계에서는 임베딩이나 Qdrant를 아직 붙이지 않는다.

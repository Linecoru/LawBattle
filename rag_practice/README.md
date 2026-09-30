# LawBattle RAG 실습

프로젝트 루트에서 아래 순서대로 실행합니다.

```powershell
python rag_practice/01_load_data.py
python rag_practice/02_chunking.py
python rag_practice/02b_semantic_chunking.py
python rag_practice/03_bm25_search.py
python rag_practice/04_dense_search.py
python rag_practice/05_hybrid_search.py
python rag_practice/06_reranking.py
```

## 파일 역할

| 파일 | 학습 내용 |
|---|---|
| `common.py` | 데이터 경로, JSONL 읽기·쓰기, 공통 `Chunk` 자료형, 검색 평가 |
| `01_load_data.py` | JSONL 구조 확인 |
| `02_chunking.py` | 원문 section을 검색 chunk로 변환 |
| `02b_semantic_chunking.py` | 인접 문장 임베딩 유사도로 의미 경계 탐색 |
| `03_bm25_search.py` | 키워드 기반 Sparse 검색 |
| `04_dense_search.py` | BGE-M3 임베딩 기반 Dense 검색 |
| `05_hybrid_search.py` | BM25와 Dense 결과를 RRF로 결합 |
| `06_reranking.py` | 상위 후보를 cross-encoder로 재정렬 |

`common.py`는 특정 검색 기법을 구현하는 파일이 아닙니다. 여러 실습 파일에 똑같이 들어갈 경로 계산, 파일 읽기, 평가 코드를 한 번만 작성해 공유합니다.

## 설치

Python 3.10 이상을 사용합니다. 1~2단계는 Python 표준 라이브러리만 사용하며, 이후 단계는 필요한 패키지를 설치합니다.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r rag_practice/requirements.txt
```

BGE-M3와 reranker는 최초 실행 때 모델을 내려받습니다. 현재 노트북에서는 소량 데이터로 CPU 실행이 가능하지만 느릴 수 있습니다. `04_dense_search.py`와 `06_reranking.py`의 `--fp16` 옵션은 CUDA GPU가 있는 컴퓨터에서만 사용합니다.

생성 파일은 `artifacts/rag_practice/`에 저장되며 Git에는 포함되지 않습니다.

## 실제 소규모 데이터 사용

기본값은 국가법령정보센터 API에서 받은 `real_sample`입니다. 따라서 별도 설정 없이 실행해도 실제 자료를 사용합니다.

```powershell
python rag_practice/01_load_data.py
python rag_practice/02_chunking.py
python rag_practice/03_bm25_search.py
```

예전 가상 데이터로 실험할 때만 다음 환경변수를 설정합니다.

```powershell
$env:RAG_DATASET = "tutorial"
```

각 데이터셋의 생성 결과는 `artifacts/rag_practice/tutorial`과 `artifacts/rag_practice/real_sample`로 분리됩니다.

## 시맨틱 청킹 비교

기존 방식은 section 하나를 chunk 하나로 사용합니다. 시맨틱 방식은 문장별 BGE-M3 임베딩을 만든 뒤 인접 문장 유사도가 하위 25%인 지점을 경계 후보로 삼고, 300~1,000자 길이 제한을 함께 적용합니다.

```powershell
python rag_practice/02b_semantic_chunking.py
$env:RAG_CHUNKING = "semantic"
python rag_practice/03_bm25_search.py
python rag_practice/04_dense_search.py
```

결과는 `semantic_chunks.jsonl`, `dense_semantic_results.json`처럼 기존 section 결과와 분리됩니다. 기본 section 방식으로 돌아갈 때는 다음과 같이 환경변수를 지웁니다.

```powershell
Remove-Item Env:RAG_CHUNKING
```

경계 민감도를 바꾸는 예시는 다음과 같습니다. percentile이 높을수록 의미 경계를 더 많이 잡습니다.

```powershell
python rag_practice/02b_semantic_chunking.py --percentile 35 --min-chars 250 --max-chars 800
```

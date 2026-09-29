# LawBattle RAG 실습

프로젝트 루트에서 아래 순서대로 실행합니다.

```powershell
python rag_practice/01_load_data.py
python rag_practice/02_chunking.py
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

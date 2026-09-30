# 실제 법령·판례 소규모 RAG 데이터

국가법령정보센터 Open API에서 받은 실제 자료를 RAG 실습 형식으로 정규화한 소규모 데이터셋입니다.

- 현행 형법 조문 3건: 제21조, 제257조, 제329조
- 대법원 판례 5건: 정당방위 4건, 절도 1건
- 판례는 API의 `판시사항`, `판결요지`, `판례내용` 전문을 담았습니다.
- `metadata.fictional`은 모두 `false`이며 각 문서에 공식 원문 URL이 있습니다.
- `scripts/collect_real_sample.mjs`로 다시 수집할 수 있습니다.

`gold_queries.jsonl`의 질문과 관련도 등급은 국가법령정보센터가 제공한 데이터가 아닙니다. 검색 품질을 측정하기 위해 LawBattle 실습용으로 직접 만든 평가 기준입니다.

## 실행

현재 기본 데이터셋이므로 프로젝트 루트에서 바로 기존 실습을 실행합니다.

```powershell
python rag_practice/01_load_data.py
python rag_practice/02_chunking.py
python rag_practice/03_bm25_search.py
```

가상 데이터로 돌아가려면 환경변수를 설정합니다.

```powershell
$env:RAG_DATASET = "tutorial"
```

## 다시 수집

프로젝트 루트의 `.env`에 `LAW_OC`를 설정하고 실행합니다.

```powershell
node --env-file=.env scripts/collect_real_sample.mjs
npm.cmd run check:real-sample
```

원본 API 응답 캐시는 Git에서 제외되는 `data/runtime/api-real-sample`에 저장됩니다. 같은 요청은 캐시를 사용하므로 반복 실행해도 다시 호출하지 않습니다.

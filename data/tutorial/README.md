# RAG 실습 데이터

이 폴더의 자료는 검색·청킹·reranking 실습만을 위해 만든 **가상 법령과 가상 판례**입니다. 실제 법령, 실제 판결 또는 법률 자문으로 사용하면 안 됩니다.

## 파일

- `raw_documents.jsonl`: 청킹 전 원문 16건(가상 법령 6건, 가상 판례 10건)
- `gold_queries.jsonl`: 검색 질의 12건과 관련 문서 정답표

각 줄이 독립된 JSON 객체인 JSONL 형식입니다. 판례는 `facts`, `issue`, `holding`, `reasoning` 구조를 유지하고 법령은 조문별 구조를 유지합니다. `relevance` 값은 `3=핵심 정답`, `2=직접 관련`, `1=보조 관련`입니다. `hard_negative_ids`는 단어는 비슷하지만 해당 질의의 답으로 쓰기 어려운 문서입니다.

## 권장 실습 순서

1. `sections`를 그대로 한 chunk씩 만드는 구조 기반 청킹을 구현합니다.
2. `title + heading + text`를 이어 붙인 검색 문자열을 만듭니다.
3. Dense 검색을 실행하고 `gold_queries.jsonl`의 정답과 비교합니다.
4. Sparse 검색과 RRF를 추가합니다.
5. 상위 20개에 reranker를 적용합니다.
6. 같은 `parent_id`의 chunk가 결과를 독점하지 않도록 문서별로 묶습니다.

데이터 무결성은 프로젝트 루트에서 다음 명령으로 확인합니다.

```powershell
npm.cmd run check:tutorial
```

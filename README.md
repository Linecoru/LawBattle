# 작은 법정

외부 패키지 설치 없이 Node.js 20 이상에서 실행하는 로컬 웹게임입니다.

```powershell
npm start
```

브라우저에서 http://localhost:3000 에 접속하세요.

사건 3개, 60초 진영 선택, 180초 주장 작성, 기록 팝업, 자동 저장과 새로고침 복구, 순차 말풍선, 자동 재생, 결과 화면을 제공합니다. 선택 시간 종료 시 변호인으로 배정하고, 작성 시간 종료 시 현재 글을 그대로 제출합니다. 빈 글은 의견 없음으로 진행합니다.

현재 LLM과 자료 검색은 연결 전입니다. 상대방은 사건별 고정 예시 의견을 사용하며 결과는 항상 데모 무승부입니다. 법률 API 호출이나 판례 수집은 발생하지 않습니다. 원문을 그대로 유지하며 실제 분석이 수행된 것처럼 표시하지 않습니다.

`public/game.js`는 사건과 순수 진행 로직, `public/app.js`는 화면·상태, `public/style.css`는 CSS 법정 및 SD 캐릭터를 담당합니다. 브라우저 저장은 이 기기의 localStorage를 사용합니다. `server.mjs`는 localhost에만 바인딩된 정적 서버이며 `/api/health`를 제공합니다.

```powershell
npm test
```

백엔드는 게임 생성·조회·제출 API와 파일 기반 영속 저장을 제공합니다. 같은 내용을 재제출하면 기존 결과를 반환하며, 다른 내용으로 덮어쓰는 제출은 거부합니다. 서버 데이터는 `data/runtime`에 저장됩니다.

자료 검색은 `POST /api/v1/sources/search`에서 `{ "query": "검색어", "type": "statute" }` 형식으로 호출합니다. `type`은 `statute` 또는 `precedent`이며 생략할 수 있습니다. 작은 로컬 데이터셋을 위한 키워드 검색과 미리 계산한 벡터의 코사인 검색을 제공합니다. Qdrant 수준의 대규모 인덱스는 아닙니다. 임베딩 모델이 같은 벡터끼리만 비교합니다.

검증된 자료를 JSON 배열로 준비한 뒤 `node scripts/import_sources.mjs 자료.json`으로 불러옵니다. 필수 필드는 `id`, `type`, `title`, `text`, `url`이며 국가법령정보센터 도메인의 원문 URL만 허용합니다. 선택 필드 `vector`, `embeddingModel`을 함께 넣으면 벡터 검색이 가능합니다. 실제 자료가 없으면 빈 검색 결과를 반환합니다.

국가법령정보 API 클라이언트는 순차 요청, 최소 1초 간격, 15초 timeout, 원문 캐시, 서버 오류 재시도를 구현합니다. 401·403·429에서는 즉시 중단합니다. 이는 자체 보수적 제한이며 제공자가 보장한 호출 한도가 아닙니다. `LAW_OC` 환경변수를 지정한 뒤 `node scripts/law_sample.mjs list`, `precedent 일련번호`, `statute 법령ID`로 개별 샘플을 저장할 수 있습니다. 인증값은 출력하지 않습니다. 대량 수집은 자동 실행하지 않습니다.

남은 작업: 실제 인증값으로 API 응답 검증, 원문 청킹·정규화, 임베딩 생성 및 대규모 벡터 DB, Qwen 모델 어댑터. 현재 작업물은 플레이 가능한 로컬 버전이며 실제 RAG 분석은 아직 수행하지 않습니다.

## RAG 학습 자료

실제 법률자료와 분리된 가상 실습 문서와 검색 정답표는 [`data/tutorial`](./data/tutorial/README.md)에 있습니다. Python 모듈, BGE-M3, Qdrant, reranker와 첫 구현 과제는 [`docs/RAG_파이썬_학습_가이드.md`](./docs/RAG_파이썬_학습_가이드.md)에 정리했습니다.

바로 실행할 수 있는 단계별 코드는 [`rag_practice`](./rag_practice/README.md)에 있습니다.

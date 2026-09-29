"""1단계: JSONL 파일을 읽고 원문 및 평가 질의 구조를 살펴본다."""

from collections import Counter

from common import DOCUMENTS_PATH, QUERIES_PATH, load_documents, load_queries


def main() -> None:
    documents = load_documents()
    queries = load_queries()
    type_counts = Counter(document["document_type"] for document in documents)

    print(f"문서 파일: {DOCUMENTS_PATH}")
    print(f"질의 파일: {QUERIES_PATH}")
    print(f"문서 {len(documents)}건: {dict(type_counts)}")
    print(f"평가 질의 {len(queries)}건")

    first = documents[0]
    print("\n첫 문서")
    print(f'- id: {first["id"]}')
    print(f'- 제목: {first["title"]}')
    print(f'- section 수: {len(first["sections"])}')
    print(f'- 주제: {first["metadata"]["topics"]}')

    query = queries[0]
    print("\n첫 평가 질의")
    print(f'- 질문: {query["query"]}')
    print(f'- 관련 문서와 등급: {query["relevance"]}')
    print(f'- hard negatives: {query["hard_negative_ids"]}')


if __name__ == "__main__":
    main()

"""2단계: 원문의 section 하나를 검색 chunk 하나로 변환한다."""

from common import SECTION_CHUNKS_PATH, chunk_documents, load_documents, save_chunks


def main() -> None:
    documents = load_documents()
    chunks = chunk_documents(documents)
    save_chunks(chunks)

    print(f"원문 {len(documents)}건 → chunk {len(chunks)}건")
    print(f"저장 위치: {SECTION_CHUNKS_PATH}")
    print("\n첫 chunk의 검색용 문자열")
    print("-" * 50)
    print(chunks[0].search_text)


if __name__ == "__main__":
    main()

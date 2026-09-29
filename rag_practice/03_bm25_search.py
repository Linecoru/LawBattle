"""3단계: BM25로 키워드 중심 Sparse 검색을 수행한다."""

from rank_bm25 import BM25Okapi

from common import (
    load_chunks,
    load_queries,
    print_metrics,
    save_rankings,
    tokenize,
    unique_parent_ranking,
)


def search_all(top_k: int = 10) -> dict[str, list[str]]:
    chunks = load_chunks()
    queries = load_queries()
    corpus_tokens = [tokenize(chunk.search_text) for chunk in chunks]
    bm25 = BM25Okapi(corpus_tokens)
    rankings: dict[str, list[str]] = {}

    for query in queries:
        scores = bm25.get_scores(tokenize(query["query"]))
        ranked_indices = sorted(
            range(len(scores)), key=lambda index: scores[index], reverse=True
        )
        rankings[query["query_id"]] = unique_parent_ranking(
            ranked_indices, chunks, limit=top_k
        )

    return rankings


def main() -> None:
    rankings = search_all()
    path = save_rankings("bm25", rankings)
    print_metrics("BM25", rankings)
    print(f"검색 결과 저장: {path}")
    print(f"q001 상위 결과: {rankings['q001'][:5]}")


if __name__ == "__main__":
    main()

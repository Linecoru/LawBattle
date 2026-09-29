"""5단계: BM25와 Dense 순위를 Reciprocal Rank Fusion으로 결합한다."""

from collections import defaultdict

from common import load_queries, load_rankings, print_metrics, save_rankings


def reciprocal_rank_fusion(
    result_lists: list[list[str]], rrf_k: int = 60
) -> list[str]:
    scores: defaultdict[str, float] = defaultdict(float)
    for ranked_ids in result_lists:
        for rank, document_id in enumerate(ranked_ids, start=1):
            scores[document_id] += 1.0 / (rrf_k + rank)
    return sorted(scores, key=scores.get, reverse=True)


def main() -> None:
    bm25 = load_rankings("bm25")
    dense = load_rankings("dense")
    queries = load_queries()
    hybrid: dict[str, list[str]] = {}

    for query in queries:
        query_id = query["query_id"]
        hybrid[query_id] = reciprocal_rank_fusion(
            [bm25.get(query_id, []), dense.get(query_id, [])]
        )

    path = save_rankings("hybrid", hybrid)
    print_metrics("Hybrid RRF", hybrid)
    print(f"검색 결과 저장: {path}")
    print(f"q001 상위 결과: {hybrid['q001'][:5]}")


if __name__ == "__main__":
    main()

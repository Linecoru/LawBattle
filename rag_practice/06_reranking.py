"""6단계: Hybrid 후보를 질의-passage cross-encoder로 재정렬한다."""

import argparse
from collections import defaultdict

from FlagEmbedding import FlagReranker

from common import (
    load_chunks,
    load_queries,
    load_rankings,
    print_metrics,
    save_rankings,
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="BAAI/bge-reranker-v2-m3")
    parser.add_argument(
        "--fp16", action="store_true", help="CUDA GPU에서만 사용 권장"
    )
    parser.add_argument("--candidates", type=int, default=10)
    args = parser.parse_args()

    chunks = load_chunks()
    queries = load_queries()
    hybrid = load_rankings("hybrid")
    chunks_by_parent: defaultdict[str, list[str]] = defaultdict(list)
    for chunk in chunks:
        chunks_by_parent[chunk.parent_id].append(chunk.search_text)

    reranker = FlagReranker(args.model, use_fp16=args.fp16)
    reranked: dict[str, list[str]] = {}

    for query in queries:
        query_id = query["query_id"]
        candidate_ids = hybrid[query_id][: args.candidates]
        # 한 문서에 section이 여러 개면 현재는 이어 붙인다. 다음 실습에서
        # chunk별 rerank 후 문서 점수를 max로 묶는 방식과 비교할 수 있다.
        passages = ["\n".join(chunks_by_parent[item]) for item in candidate_ids]
        pairs = [[query["query"], passage] for passage in passages]
        scores = reranker.compute_score(pairs, normalize=True)
        if isinstance(scores, float):
            scores = [scores]
        reranked[query_id] = [
            document_id
            for document_id, _ in sorted(
                zip(candidate_ids, scores, strict=True),
                key=lambda item: item[1],
                reverse=True,
            )
        ]

    path = save_rankings("reranked", reranked)
    print_metrics("Reranker", reranked)
    print(f"검색 결과 저장: {path}")
    print(f"q001 상위 결과: {reranked['q001'][:5]}")


if __name__ == "__main__":
    main()

"""4단계: BGE-M3 임베딩과 코사인 유사도로 Dense 검색을 수행한다."""

import argparse

import numpy as np
from FlagEmbedding import BGEM3FlagModel

from common import (
    ARTIFACT_DIR,
    load_chunks,
    load_queries,
    print_metrics,
    save_rankings,
    unique_parent_ranking,
)


def normalize(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    return matrix / np.clip(norms, 1e-12, None)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="BAAI/bge-m3")
    parser.add_argument(
        "--fp16", action="store_true", help="CUDA GPU에서만 사용 권장"
    )
    args = parser.parse_args()

    chunks = load_chunks()
    queries = load_queries()
    model = BGEM3FlagModel(args.model, use_fp16=args.fp16)

    document_vectors = model.encode(
        [chunk.search_text for chunk in chunks],
        batch_size=4,
        max_length=512,
        return_dense=True,
        return_sparse=False,
        return_colbert_vecs=False,
    )["dense_vecs"]
    query_vectors = model.encode(
        [query["query"] for query in queries],
        batch_size=4,
        max_length=256,
        return_dense=True,
        return_sparse=False,
        return_colbert_vecs=False,
    )["dense_vecs"]

    document_vectors = normalize(np.asarray(document_vectors, dtype=np.float32))
    query_vectors = normalize(np.asarray(query_vectors, dtype=np.float32))
    rankings: dict[str, list[str]] = {}

    for query, query_vector in zip(queries, query_vectors, strict=True):
        scores = document_vectors @ query_vector
        ranked_indices = np.argsort(scores)[::-1]
        rankings[query["query_id"]] = unique_parent_ranking(
            ranked_indices, chunks, limit=10
        )

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        ARTIFACT_DIR / "dense_vectors.npz",
        document_vectors=document_vectors,
        query_vectors=query_vectors,
    )
    path = save_rankings("dense", rankings)
    print_metrics("Dense", rankings)
    print(f"검색 결과 저장: {path}")
    print(f"q001 상위 결과: {rankings['q001'][:5]}")


if __name__ == "__main__":
    main()

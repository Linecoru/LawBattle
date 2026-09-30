"""2B단계: 인접 문장의 임베딩 유사도가 떨어지는 지점에서 의미 청크를 나눈다."""

import argparse
import re
from dataclasses import asdict

import numpy as np
from FlagEmbedding import BGEM3FlagModel

from common import (
    ARTIFACT_DIR,
    Chunk,
    SEMANTIC_CHUNKS_PATH,
    build_search_text,
    load_documents,
    write_jsonl,
)


def split_by_length(text: str, max_chars: int) -> list[str]:
    """문장 하나가 너무 길 때 공백을 우선해 안전 크기로 나눈다."""

    pieces: list[str] = []
    remaining = text.strip()
    while len(remaining) > max_chars:
        boundary = remaining.rfind(" ", 0, max_chars + 1)
        if boundary < max_chars // 2:
            boundary = max_chars
        pieces.append(remaining[:boundary].strip())
        remaining = remaining[boundary:].strip()
    if remaining:
        pieces.append(remaining)
    return pieces


def split_units(text: str, max_chars: int) -> list[str]:
    """줄바꿈과 문장부호를 보존하면서 임베딩할 최소 단위를 만든다."""

    rough_units = re.split(r"(?<=[.!?。])\s+|\n+", text.strip())
    units: list[str] = []
    for unit in rough_units:
        cleaned = unit.strip()
        if cleaned:
            units.extend(split_by_length(cleaned, max_chars))
    return units


def normalize(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    return matrix / np.clip(norms, 1e-12, None)


def find_ranges(
    units: list[str],
    vectors: np.ndarray,
    percentile: float,
    min_chars: int,
    max_chars: int,
) -> tuple[list[tuple[int, int]], float, list[float]]:
    """낮은 인접 유사도와 길이 제한을 함께 사용해 [시작, 끝) 범위를 만든다."""

    if len(units) == 1:
        return [(0, 1)], -1.0, []

    similarities = np.sum(vectors[:-1] * vectors[1:], axis=1).tolist()
    threshold = float(np.percentile(similarities, percentile))
    ranges: list[tuple[int, int]] = []
    start = 0
    current_chars = len(units[0])

    for index in range(1, len(units)):
        proposed_chars = current_chars + 1 + len(units[index])
        semantic_break = (
            current_chars >= min_chars and similarities[index - 1] < threshold
        )
        size_break = proposed_chars > max_chars
        if semantic_break or size_break:
            ranges.append((start, index))
            start = index
            current_chars = len(units[index])
        else:
            current_chars = proposed_chars

    ranges.append((start, len(units)))
    return ranges, threshold, similarities


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="BAAI/bge-m3")
    parser.add_argument("--percentile", type=float, default=25.0)
    parser.add_argument("--min-chars", type=int, default=300)
    parser.add_argument("--max-chars", type=int, default=1000)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument(
        "--fp16", action="store_true", help="CUDA GPU에서만 사용 권장"
    )
    args = parser.parse_args()
    if not 0 <= args.percentile <= 100:
        parser.error("--percentile은 0부터 100 사이여야 합니다.")
    if args.min_chars <= 0 or args.max_chars < args.min_chars:
        parser.error("글자 수는 0보다 크고 max-chars >= min-chars여야 합니다.")

    documents = load_documents()
    jobs: list[tuple[dict, dict, list[str], int, int]] = []
    all_units: list[str] = []
    for document in documents:
        for section in document["sections"]:
            units = split_units(section["text"], args.max_chars)
            if not units:
                continue
            start = len(all_units)
            all_units.extend(units)
            jobs.append((document, section, units, start, len(all_units)))

    model = BGEM3FlagModel(args.model, use_fp16=args.fp16)
    vectors = model.encode(
        all_units,
        batch_size=args.batch_size,
        max_length=512,
        return_dense=True,
        return_sparse=False,
        return_colbert_vecs=False,
    )["dense_vecs"]
    vectors = normalize(np.asarray(vectors, dtype=np.float32))

    chunks: list[Chunk] = []
    report: list[dict] = []
    for document, section, units, vector_start, vector_end in jobs:
        ranges, threshold, similarities = find_ranges(
            units,
            vectors[vector_start:vector_end],
            args.percentile,
            args.min_chars,
            args.max_chars,
        )
        for chunk_number, (start, end) in enumerate(ranges, start=1):
            text = " ".join(units[start:end])
            heading = f'{section["heading"]} · 의미 청크 {chunk_number}'
            chunk = Chunk(
                chunk_id=(
                    f'{document["id"]}:{section["section_id"]}:semantic-'
                    f"{chunk_number:03d}"
                ),
                parent_id=document["id"],
                document_type=document["document_type"],
                title=document["title"],
                section_id=section["section_id"],
                heading=heading,
                text=text,
                search_text=build_search_text(
                    document, {"heading": heading, "text": text}
                ),
            )
            chunks.append(chunk)
            report.append(
                {
                    "chunk_id": chunk.chunk_id,
                    "characters": len(text),
                    "unit_start": start,
                    "unit_end": end,
                    "threshold": round(threshold, 4),
                    "left_boundary_similarity": (
                        round(similarities[start - 1], 4) if start else None
                    ),
                }
            )

    write_jsonl(SEMANTIC_CHUNKS_PATH, (asdict(chunk) for chunk in chunks))
    write_jsonl(ARTIFACT_DIR / "semantic_chunking_report.jsonl", report)
    print(f"원문 {len(documents)}건 → semantic chunk {len(chunks)}건")
    print(f"저장 위치: {SEMANTIC_CHUNKS_PATH}")
    print(
        f"설정: percentile={args.percentile}, min_chars={args.min_chars}, "
        f"max_chars={args.max_chars}"
    )


if __name__ == "__main__":
    main()

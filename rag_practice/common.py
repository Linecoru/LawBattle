"""RAG 실습 전 단계에서 공유하는 작은 입출력·평가 도구 모음."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data" / "tutorial"
ARTIFACT_DIR = PROJECT_ROOT / "artifacts" / "rag_practice"
DOCUMENTS_PATH = DATA_DIR / "raw_documents.jsonl"
QUERIES_PATH = DATA_DIR / "gold_queries.jsonl"
CHUNKS_PATH = ARTIFACT_DIR / "chunks.jsonl"


@dataclass(frozen=True, slots=True)
class Chunk:
    """검색의 최소 단위. parent_id로 원문 문서까지 되돌아갈 수 있다."""

    chunk_id: str
    parent_id: str
    document_type: str
    title: str
    section_id: str
    heading: str
    text: str
    search_text: str


def iter_jsonl(path: Path) -> Iterable[dict[str, Any]]:
    """큰 파일도 한 줄씩 처리할 수 있는 JSONL generator."""

    with path.open(encoding="utf-8") as file:
        for line_number, line in enumerate(file, start=1):
            if not line.strip():
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"{path}:{line_number} JSON 형식 오류") from error


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    return list(iter_jsonl(path))


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as file:
        for row in rows:
            file.write(json.dumps(row, ensure_ascii=False) + "\n")


def load_documents() -> list[dict[str, Any]]:
    return load_jsonl(DOCUMENTS_PATH)


def load_queries() -> list[dict[str, Any]]:
    return load_jsonl(QUERIES_PATH)


def build_search_text(document: dict[str, Any], section: dict[str, Any]) -> str:
    """제목과 조문 제목을 본문에 붙여 짧은 chunk의 문맥 손실을 줄인다."""

    topics = " ".join(document.get("metadata", {}).get("topics", []))
    return "\n".join(
        value
        for value in (
            document["title"],
            section["heading"],
            topics,
            section["text"],
        )
        if value
    )


def chunk_documents(documents: Iterable[dict[str, Any]]) -> list[Chunk]:
    chunks: list[Chunk] = []
    for document in documents:
        for section in document["sections"]:
            chunks.append(
                Chunk(
                    chunk_id=f'{document["id"]}:{section["section_id"]}',
                    parent_id=document["id"],
                    document_type=document["document_type"],
                    title=document["title"],
                    section_id=section["section_id"],
                    heading=section["heading"],
                    text=section["text"],
                    search_text=build_search_text(document, section),
                )
            )
    return chunks


def save_chunks(chunks: Iterable[Chunk]) -> None:
    write_jsonl(CHUNKS_PATH, (asdict(chunk) for chunk in chunks))


def load_chunks() -> list[Chunk]:
    if not CHUNKS_PATH.exists():
        raise FileNotFoundError(
            f"{CHUNKS_PATH}가 없습니다. 먼저 02_chunking.py를 실행하세요."
        )
    return [Chunk(**row) for row in iter_jsonl(CHUNKS_PATH)]


def tokenize(text: str) -> list[str]:
    """학습용 단순 토크나이저. 실제 한국어 형태소 분석기와 비교해볼 수 있다."""

    return re.findall(r"[가-힣A-Za-z0-9]+", text.lower())


def save_rankings(name: str, rankings: dict[str, list[str]]) -> Path:
    path = ARTIFACT_DIR / f"{name}_results.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(rankings, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return path


def load_rankings(name: str) -> dict[str, list[str]]:
    path = ARTIFACT_DIR / f"{name}_results.json"
    if not path.exists():
        raise FileNotFoundError(f"{path}가 없습니다. 앞 단계부터 실행하세요.")
    return json.loads(path.read_text(encoding="utf-8"))


def unique_parent_ranking(
    ranked_chunk_indices: Iterable[int], chunks: list[Chunk], limit: int = 10
) -> list[str]:
    """여러 chunk가 같은 원문을 중복 점유하지 않도록 parent 문서 ID로 묶는다."""

    parents: list[str] = []
    seen: set[str] = set()
    for index in ranked_chunk_indices:
        parent_id = chunks[index].parent_id
        if parent_id in seen:
            continue
        seen.add(parent_id)
        parents.append(parent_id)
        if len(parents) >= limit:
            break
    return parents


def recall_at_k(ranked_ids: list[str], relevant_ids: set[str], k: int) -> float:
    if not relevant_ids:
        return 0.0
    return len(set(ranked_ids[:k]) & relevant_ids) / len(relevant_ids)


def reciprocal_rank(ranked_ids: list[str], relevant_ids: set[str]) -> float:
    for rank, document_id in enumerate(ranked_ids, start=1):
        if document_id in relevant_ids:
            return 1.0 / rank
    return 0.0


def evaluate_rankings(
    rankings: dict[str, list[str]], queries: list[dict[str, Any]], k: int = 10
) -> dict[str, float]:
    recalls: list[float] = []
    reciprocal_ranks: list[float] = []
    for query in queries:
        relevant_ids = {
            document_id
            for document_id, grade in query["relevance"].items()
            if grade > 0
        }
        ranked_ids = rankings.get(query["query_id"], [])
        recalls.append(recall_at_k(ranked_ids, relevant_ids, k))
        reciprocal_ranks.append(reciprocal_rank(ranked_ids, relevant_ids))

    count = len(queries)
    return {
        f"recall@{k}": sum(recalls) / count if count else 0.0,
        "mrr": sum(reciprocal_ranks) / count if count else 0.0,
    }


def print_metrics(label: str, rankings: dict[str, list[str]]) -> None:
    metrics = evaluate_rankings(rankings, load_queries())
    print(
        f'{label}: Recall@10={metrics["recall@10"]:.3f}, '
        f'MRR={metrics["mrr"]:.3f}'
    )

#!/usr/bin/env python3
"""Qwen3.5-9B 로컬 smoke test. 외부 패키지 없이 Ollama API를 호출한다."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FIXTURE = ROOT / "data" / "evals" / "qwen35_9b_smoke.json"
ALLOWED_CLASSES = [
    "record_supported",
    "party_claim",
    "reasonable_inference",
    "hypothesis",
    "unsupported_assertion",
]


FACT_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "statement_id": {"type": "string"},
                    "classification": {"type": "string", "enum": ALLOWED_CLASSES},
                    "reason": {"type": "string"},
                },
                "required": ["statement_id", "classification", "reason"],
            },
        }
    },
    "required": ["items"],
}


JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "winner": {"type": "string", "enum": ["A", "B", "DRAW"]},
        "reason": {"type": "string"},
        "unsupported_assertions_a": {"type": "array", "items": {"type": "string"}},
        "unsupported_assertions_b": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "winner",
        "reason",
        "unsupported_assertions_a",
        "unsupported_assertions_b",
    ],
}


def ollama_chat(base_url: str, model: str, prompt: str, schema: dict) -> tuple[dict, dict]:
    payload = {
        "model": model,
        "stream": False,
        "think": False,
        "format": schema,
        "messages": [
            {
                "role": "system",
                "content": (
                    "당신은 법률 결론을 내리는 판사가 아니라 법정 대결 게임의 분석기다. "
                    "제공된 사건 기록 밖의 지식을 사실로 보충하지 말고, 반드시 지정된 JSON 형식으로만 답하라."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "options": {"temperature": 0, "num_ctx": 8192, "num_predict": 800},
        "keep_alive": "10m",
    }
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/api/chat",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    with urllib.request.urlopen(request, timeout=300) as response:
        outer = json.loads(response.read().decode("utf-8"))
    elapsed = time.perf_counter() - started
    parsed = json.loads(outer["message"]["content"])
    metrics = {
        "elapsed_seconds": round(elapsed, 3),
        "prompt_tokens": outer.get("prompt_eval_count"),
        "output_tokens": outer.get("eval_count"),
        "load_seconds": round(outer.get("load_duration", 0) / 1_000_000_000, 3),
    }
    return parsed, metrics


def fact_prompt(case: dict) -> str:
    return (
        "아래 문장 각각을 분류하라. record_supported는 확정 기록에 직접 있음, party_claim은 기록상 당사자의 주장, "
        "reasonable_inference는 기록에서 이끌어낸 해석, hypothesis는 조건부 가정, unsupported_assertion은 "
        "기록에 없는 내용을 실제 사실처럼 단정한 경우다. 기록에 없다는 이유만으로 추론이나 가정을 "
        "unsupported_assertion으로 분류하지 마라. 모든 statement_id를 한 번씩 반환하라.\n\n"
        f"사건 기록:\n{json.dumps(case['case_record'], ensure_ascii=False, indent=2)}\n\n"
        f"분류할 문장:\n{json.dumps(case['statements'], ensure_ascii=False, indent=2)}"
    )


def judge_prompt(record: list[str], argument_a: str, argument_b: str) -> str:
    return (
        "두 주장을 법률적으로 정답인지 판단하지 말고, 사건 기록 충실도·논리 일관성·상대적 설득력만 비교하라. "
        "기록에 없는 사실을 단정한 부분은 따로 적고 판정 근거에서 제외하라. 합리적 추론과 명시적인 조건부 "
        "가정은 기록 외 사실 단정과 구분하라. 두 주장이 비슷하면 DRAW를 선택하라.\n\n"
        f"사건 기록:\n{json.dumps(record, ensure_ascii=False, indent=2)}\n\n"
        f"A측 주장:\n{argument_a}\n\nB측 주장:\n{argument_b}"
    )


def validate_fixture(data: dict) -> None:
    if not data.get("fact_audits") or not data.get("judgments"):
        raise ValueError("fact_audits와 judgments가 각각 한 건 이상 필요합니다.")
    for case in data["fact_audits"]:
        statement_ids = {item["id"] for item in case["statements"]}
        if statement_ids != set(case["expected"]):
            raise ValueError(f"{case['id']}: 문장 ID와 expected ID가 다릅니다.")
        invalid = set(case["expected"].values()) - set(ALLOWED_CLASSES)
        if invalid:
            raise ValueError(f"{case['id']}: 잘못된 분류값 {sorted(invalid)}")


def swap_winner(winner: str) -> str:
    return {"A": "B", "B": "A", "DRAW": "DRAW"}[winner]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", type=Path, default=DEFAULT_FIXTURE)
    parser.add_argument("--model", default=os.getenv("OLLAMA_MODEL", "qwen3.5:9b"))
    parser.add_argument("--base-url", default=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"))
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()

    data = json.loads(args.fixture.read_text(encoding="utf-8"))
    validate_fixture(data)
    if args.check_only:
        print(f"fixture OK: {args.fixture}")
        print(f"fact audits={len(data['fact_audits'])}, judgments={len(data['judgments'])}")
        return 0

    report = {
        "model": args.model,
        "base_url": args.base_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "fact_audits": [],
        "judgments": [],
    }

    for case in data["fact_audits"]:
        result, metrics = ollama_chat(args.base_url, args.model, fact_prompt(case), FACT_SCHEMA)
        predicted = {item["statement_id"]: item["classification"] for item in result["items"]}
        expected = case["expected"]
        correct = sum(predicted.get(key) == value for key, value in expected.items())
        report["fact_audits"].append(
            {
                "id": case["id"],
                "correct": correct,
                "total": len(expected),
                "passed": correct == len(expected),
                "expected": expected,
                "predicted": predicted,
                "raw": result,
                "metrics": metrics,
            }
        )

    for case in data["judgments"]:
        first, first_metrics = ollama_chat(
            args.base_url,
            args.model,
            judge_prompt(case["case_record"], case["argument_a"], case["argument_b"]),
            JUDGE_SCHEMA,
        )
        swapped, swapped_metrics = ollama_chat(
            args.base_url,
            args.model,
            judge_prompt(case["case_record"], case["argument_b"], case["argument_a"]),
            JUDGE_SCHEMA,
        )
        canonical_swapped = swap_winner(swapped["winner"])
        report["judgments"].append(
            {
                "id": case["id"],
                "expected_winner": case["expected_winner"],
                "winner": first["winner"],
                "winner_after_order_normalization": canonical_swapped,
                "expected_match": first["winner"] == case["expected_winner"],
                "order_consistent": first["winner"] == canonical_swapped,
                "first": first,
                "swapped": swapped,
                "metrics": {"first": first_metrics, "swapped": swapped_metrics},
            }
        )

    fact_correct = sum(item["correct"] for item in report["fact_audits"])
    fact_total = sum(item["total"] for item in report["fact_audits"])
    report["summary"] = {
        "fact_accuracy": round(fact_correct / fact_total, 3),
        "fact_cases_all_correct": sum(item["passed"] for item in report["fact_audits"]),
        "order_consistency": round(
            sum(item["order_consistent"] for item in report["judgments"]) / len(report["judgments"]), 3
        ),
        "expected_winner_match": round(
            sum(item["expected_match"] for item in report["judgments"]) / len(report["judgments"]), 3
        ),
    }

    output_dir = ROOT / "artifacts" / "evals"
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    output_path = output_dir / f"qwen35_9b_smoke-{stamp}.json"
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    print(f"report: {output_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.URLError as exc:
        print(f"Ollama 연결 실패: {exc}", file=sys.stderr)
        print("Ollama가 실행 중인지와 'ollama run qwen3.5:9b' 완료 여부를 확인하세요.", file=sys.stderr)
        raise SystemExit(2)
    except (KeyError, ValueError, json.JSONDecodeError) as exc:
        print(f"평가 데이터 또는 모델 응답 오류: {exc}", file=sys.stderr)
        raise SystemExit(3)

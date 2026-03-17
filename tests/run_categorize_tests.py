"""
Regression Test Runner for process-document-categorize
Reads test fixtures (OCR text + expected category), runs them through
the GPT prompt, and reports pass/fail.

Usage:
  python3 tests/run_categorize_tests.py                    # all tests, default model
  python3 tests/run_categorize_tests.py --model gpt-5.2    # specific model
  python3 tests/run_categorize_tests.py --tag spam          # filter by tag
  python3 tests/run_categorize_tests.py --quick             # only easy+medium tests

Requires: OPENAI_API_KEY environment variable
"""
import json
import time
import sys
import os
import urllib.request
import urllib.error
import argparse
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
FIXTURES_FILE = SCRIPT_DIR / "categorize_test_fixtures.json"
PROMPT_FILE = SCRIPT_DIR.parent / "supabase" / "functions" / "process-document" / "prompts.ts"


def load_prompt():
    """Extract SYSTEM_PROMPT from prompts.ts"""
    content = PROMPT_FILE.read_text(encoding="utf-8")
    start = content.index("export const SYSTEM_PROMPT = `") + len("export const SYSTEM_PROMPT = `")
    end = content.rindex("`;")
    return content[start:end]


def load_fixtures(tag_filter=None, quick=False):
    """Load test fixtures, optionally filtered"""
    data = json.loads(FIXTURES_FILE.read_text(encoding="utf-8"))
    cases = data["test_cases"]

    if tag_filter:
        cases = [c for c in cases if tag_filter in c.get("tags", [])]

    if quick:
        cases = [c for c in cases if c.get("difficulty") in ("easy", "medium")]

    return cases, data.get("_meta", {})


def call_openai(model, system_prompt, user_content, reasoning_effort=None):
    """Call OpenAI API, return (kategorie, duration, error)"""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return None, 0, "OPENAI_API_KEY not set"

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "response_format": {"type": "json_object"},
    }
    if reasoning_effort:
        body["reasoning_effort"] = reasoning_effort

    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )

    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        duration = time.time() - start
        content = json.loads(result["choices"][0]["message"]["content"])
        return content.get("kategorie", "???"), duration, None
    except urllib.error.HTTPError as e:
        duration = time.time() - start
        error_body = e.read().decode("utf-8") if e.fp else str(e)
        return None, duration, f"HTTP {e.code}: {error_body[:200]}"
    except Exception as e:
        duration = time.time() - start
        return None, duration, str(e)[:200]


def main():
    parser = argparse.ArgumentParser(description="Run categorization regression tests")
    parser.add_argument("--model", default="gpt-5.2", help="OpenAI model (default: gpt-5.2)")
    parser.add_argument("--effort", default="low", help="Reasoning effort: low/medium/high (default: low)")
    parser.add_argument("--tag", help="Filter tests by tag")
    parser.add_argument("--quick", action="store_true", help="Only easy+medium tests")
    parser.add_argument("--id", help="Run single test by document ID (prefix match)")
    args = parser.parse_args()

    system_prompt = load_prompt()
    cases, meta = load_fixtures(tag_filter=args.tag, quick=args.quick)

    if args.id:
        cases = [c for c in cases if c["id"].startswith(args.id)]

    if not cases:
        print("No test cases match the filter.")
        sys.exit(1)

    # For gpt-5-mini, don't use reasoning_effort
    reasoning_effort = args.effort if args.model != "gpt-5-mini" else None

    print("=" * 90)
    print(f"Categorization Regression Tests")
    print(f"Model: {args.model} | Effort: {reasoning_effort or 'n/a'} | Tests: {len(cases)}")
    print(f"Prompt: {len(system_prompt)} chars | Fixtures: {meta.get('prompt_version', '?')}")
    print("=" * 90)

    results = []
    passed = 0
    failed = 0
    errors = 0

    for i, tc in enumerate(cases, 1):
        label = f"[{i}/{len(cases)}] {tc['id'][:8]}..."
        sys.stdout.write(f"{label} expected={tc['expected']:25s} ... ")
        sys.stdout.flush()

        user_content = (
            f"Dateiname: {tc['filename']}\n\n"
            f"Analysiere das folgende Dokument und extrahiere alle "
            f"relevanten Informationen als JSON:\n\n{tc['ocr_text']}"
        )

        kategorie, duration, error = call_openai(
            args.model, system_prompt, user_content, reasoning_effort
        )

        if error:
            print(f"ERROR ({duration:.1f}s): {error}")
            errors += 1
            results.append(("ERROR", tc, None, duration))
        elif kategorie == tc["expected"]:
            print(f"PASS ({duration:.1f}s)")
            passed += 1
            results.append(("PASS", tc, kategorie, duration))
        else:
            print(f"FAIL: got {kategorie} ({duration:.1f}s)")
            failed += 1
            results.append(("FAIL", tc, kategorie, duration))

    # Summary
    print("\n" + "=" * 90)
    total = passed + failed + errors
    print(f"RESULTS: {passed}/{total} passed, {failed} failed, {errors} errors")

    if failed > 0:
        print(f"\nFAILED TESTS:")
        for status, tc, got, dur in results:
            if status == "FAIL":
                print(f"  {tc['id'][:12]}  expected={tc['expected']:25s} got={got:25s} [{tc.get('difficulty','')}]")
                print(f"    {tc.get('description', '')[:100]}")

    total_time = sum(d for _, _, _, d in results)
    avg_time = total_time / len(results) if results else 0
    print(f"\nTotal time: {total_time:.1f}s | Avg: {avg_time:.1f}s per test")

    sys.exit(1 if failed > 0 or errors > 0 else 0)


if __name__ == "__main__":
    main()

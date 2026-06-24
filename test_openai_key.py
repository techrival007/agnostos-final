#!/usr/bin/env python3
"""Test OPENAI_API_KEY from backend/.env with a custom prompt."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT / "backend" / ".env"


def load_key_from_env() -> str:
    if not ENV_FILE.exists():
        print(f"Missing {ENV_FILE}")
        sys.exit(1)

    for line in ENV_FILE.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.split("=", 1)[0].strip() == "OPENAI_API_KEY":
            key = stripped.split("=", 1)[1].strip().strip('"').strip("'")
            if key:
                return key

    print(f"OPENAI_API_KEY not found in {ENV_FILE}")
    print("Add: OPENAI_API_KEY=sk-...")
    sys.exit(1)


def ask_prompt() -> str:
    print("OpenAI test (key loaded from backend/.env)")
    print("Enter your message below. Empty line to finish.\n")

    lines: list[str] = []
    while True:
        try:
            line = input("> " if not lines else "  ")
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not line.strip() and lines:
            break
        if line.strip():
            lines.append(line)

    if not lines:
        print("No input provided.")
        sys.exit(1)

    return "\n".join(lines)


def test_key(api_key: str, prompt: str) -> None:
    payload = json.dumps(
        {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 256,
        }
    ).encode()

    request = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    print(f"\nUsing key from {ENV_FILE} (starts with {api_key[:7]}...)")
    print("Calling OpenAI...\n")

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = json.loads(response.read().decode())
            reply = body["choices"][0]["message"]["content"]
            print(f"SUCCESS — HTTP {response.status}\n")
            print(reply.strip())
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode()
        print(f"FAILED — HTTP {exc.code}")
        try:
            print(json.dumps(json.loads(error_body), indent=2))
        except json.JSONDecodeError:
            print(error_body)
        sys.exit(1)
    except urllib.error.URLError as exc:
        print(f"FAILED — network error: {exc.reason}")
        sys.exit(1)


if __name__ == "__main__":
    test_key(load_key_from_env(), ask_prompt())

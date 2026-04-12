from pathlib import Path


def _env_file_path() -> Path:
    return Path(__file__).resolve().parents[1] / ".env"


def update_env_value(key: str, value: str) -> None:
    env_path = _env_file_path()
    lines: list[str] = []

    if env_path.exists():
        lines = env_path.read_text(encoding="utf-8").splitlines()

    key_prefix = f"{key}="
    updated = False
    next_lines: list[str] = []

    for line in lines:
        if line.startswith(key_prefix):
            next_lines.append(f"{key}={value}")
            updated = True
        else:
            next_lines.append(line)

    if not updated:
        next_lines.append(f"{key}={value}")

    env_path.write_text("\n".join(next_lines) + "\n", encoding="utf-8")

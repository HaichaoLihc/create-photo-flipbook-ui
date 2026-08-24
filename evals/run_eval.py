#!/usr/bin/env python3
"""Run a blinded Codex forward eval and archive a reproducible run record."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
CASES_DIR = ROOT / "evals" / "cases"
DEFAULT_RESULTS_DIR = ROOT / "evals" / "results"
SKILL_NAME = "create-photo-flipbook-ui"
SOURCE_SKILL = ROOT / "skills" / SKILL_NAME


def fail(message: str) -> None:
    raise SystemExit(f"error: {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run an isolated Codex forward eval for one case."
    )
    parser.add_argument("case", help="Case directory name under evals/cases")
    parser.add_argument("--model", help="Optional Codex model override")
    parser.add_argument(
        "--results-dir",
        type=Path,
        default=DEFAULT_RESULTS_DIR,
        help="Directory used to archive run records",
    )
    parser.add_argument(
        "--no-sync",
        action="store_true",
        help="Use the installed Skill without syncing the repository copy",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and print the plan without changing files or starting Codex",
    )
    return parser.parse_args()


def files_under(directory: Path) -> Iterable[Path]:
    return sorted(
        path
        for path in directory.rglob("*")
        if path.is_file() and ".git" not in path.relative_to(directory).parts
    )


def tree_hash(directory: Path) -> str:
    digest = hashlib.sha256()
    for path in files_under(directory):
        relative = path.relative_to(directory).as_posix().encode()
        digest.update(len(relative).to_bytes(8, "big"))
        digest.update(relative)
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
    return digest.hexdigest()


def git_value(*args: str) -> str | None:
    completed = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    value = completed.stdout.strip()
    return value if completed.returncode == 0 and value else None


def installed_skill_path() -> Path:
    codex_home = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
    return codex_home.expanduser().resolve() / "skills" / SKILL_NAME


def sync_skill(destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "rsync",
            "-a",
            "--delete",
            "--exclude=.git/",
            f"{SOURCE_SKILL}/",
            f"{destination}/",
        ],
        check=True,
    )


def make_run_id(case_id: str) -> str:
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    commit = git_value("rev-parse", "--short=10", "HEAD") or "no-git"
    return f"{stamp}-{case_id}-{commit}"


def source_skill_version(source_hash: str) -> tuple[str, str | None, bool]:
    commit = git_value("rev-parse", "HEAD")
    version = git_value("describe", "--tags", "--always") or commit or "unversioned"
    relative_skill = SOURCE_SKILL.relative_to(ROOT).as_posix()
    dirty = bool(git_value("status", "--porcelain", "--", relative_skill))
    if dirty:
        version = f"{version}-skill-dirty-{source_hash[:12]}"
    return version, commit, dirty


def validate_case(case_dir: Path, require_rsync: bool) -> tuple[Path, Path]:
    prompt_path = case_dir / "prompt.md"
    input_dir = case_dir / "input"
    if not case_dir.is_dir():
        fail(f"unknown case: {case_dir.name}")
    if not prompt_path.is_file() or not prompt_path.read_text(encoding="utf-8").strip():
        fail(f"missing or empty prompt: {prompt_path}")
    if not input_dir.is_dir() or not any(files_under(input_dir)):
        fail(f"case input directory is missing or empty: {input_dir}")
    if not (SOURCE_SKILL / "SKILL.md").is_file():
        fail(f"source Skill is missing: {SOURCE_SKILL}")
    if shutil.which("codex") is None:
        fail("codex CLI is not available")
    if require_rsync and shutil.which("rsync") is None:
        fail("rsync is not available")
    return prompt_path, input_dir


def main() -> int:
    args = parse_args()
    if Path(args.case).name != args.case or args.case in {".", ".."}:
        fail("case must be one directory name under evals/cases")
    case_dir = (CASES_DIR / args.case).resolve()
    try:
        case_dir.relative_to(CASES_DIR.resolve())
    except ValueError:
        fail("case must be a directory name under evals/cases")

    prompt_path, input_dir = validate_case(case_dir, require_rsync=not args.no_sync)
    prompt = prompt_path.read_text(encoding="utf-8").strip() + "\n"
    destination = installed_skill_path()
    source_hash = tree_hash(SOURCE_SKILL)
    skill_version, skill_commit, skill_source_dirty = source_skill_version(source_hash)
    run_id = make_run_id(args.case)
    results_dir = args.results_dir.expanduser().resolve()
    record_dir = results_dir / args.case / run_id

    command = [
        "codex",
        "-a",
        "never",
        "exec",
        "--skip-git-repo-check",
        "--ephemeral",
        "--sandbox",
        "workspace-write",
        "--json",
    ]
    if args.model:
        command.extend(["--model", args.model])

    plan = {
        "case": args.case,
        "model": args.model,
        "skill_version": skill_version,
        "skill_git_commit": skill_commit,
        "skill_source_dirty": skill_source_dirty,
        "source_skill": str(SOURCE_SKILL),
        "installed_skill": str(destination),
        "source_skill_sha256": source_hash,
        "input_sha256": tree_hash(input_dir),
        "result": str(record_dir),
        "sync_skill": not args.no_sync,
        "command": command + ["--cd", "<temporary-workspace>", "-"],
    }
    if args.dry_run:
        print(json.dumps(plan, indent=2))
        return 0

    if record_dir.exists():
        fail(f"run record already exists: {record_dir}")
    record_dir.mkdir(parents=True)

    if not args.no_sync:
        sync_skill(destination)
    if not destination.is_dir():
        fail(f"installed Skill is missing: {destination}")
    installed_hash = tree_hash(destination)
    if not args.no_sync and installed_hash != source_hash:
        fail("installed Skill hash does not match the repository Skill after sync")

    workspace = Path(tempfile.mkdtemp(prefix=f"flipbook-eval-{args.case}-"))
    shutil.copytree(input_dir, workspace / "input")
    (record_dir / "prompt.md").write_text(prompt, encoding="utf-8")

    manifest = {
        **plan,
        "evaluated_skill_sha256": installed_hash,
        "skill_install_matches_source": installed_hash == source_hash,
        "run_id": run_id,
        "started_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "git_commit": git_value("rev-parse", "HEAD"),
        "git_dirty": bool(git_value("status", "--porcelain")),
        "codex_version": subprocess.run(
            ["codex", "--version"],
            text=True,
            stdout=subprocess.PIPE,
            check=True,
        ).stdout.strip(),
    }

    events_path = record_dir / "codex-events.jsonl"
    stderr_path = record_dir / "codex-stderr.log"
    final_path = record_dir / "final-message.md"
    run_command = command + [
        "--cd",
        str(workspace),
        "--output-last-message",
        str(final_path),
        "-",
    ]

    return_code = 1
    try:
        with events_path.open("w", encoding="utf-8") as events, stderr_path.open(
            "w", encoding="utf-8"
        ) as errors:
            completed = subprocess.run(
                run_command,
                input=prompt,
                text=True,
                stdout=events,
                stderr=errors,
                check=False,
            )
        return_code = completed.returncode
    finally:
        manifest["finished_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
        manifest["codex_exit_code"] = return_code
        shutil.move(str(workspace), str(record_dir / "workspace"))
        (record_dir / "manifest.json").write_text(
            json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
        )

    print(f"Run archived at {record_dir}")
    return return_code


if __name__ == "__main__":
    sys.exit(main())

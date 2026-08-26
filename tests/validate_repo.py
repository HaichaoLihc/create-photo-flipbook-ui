#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "create-photo-flipbook-ui"
SKILL_MD = SKILL / "SKILL.md"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def main() -> None:
    require(SKILL_MD.is_file(), "Missing installable SKILL.md")
    text = SKILL_MD.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    require(match is not None, "SKILL.md frontmatter is missing or malformed")
    frontmatter = match.group(1)
    require(
        re.search(r"^name:\s*create-photo-flipbook-ui\s*$", frontmatter, re.MULTILINE)
        is not None,
        "Skill name does not match its directory",
    )
    require(
        re.search(r"^description:\s*\S", frontmatter, re.MULTILINE) is not None,
        "Skill description is missing",
    )
    require(
        "If the request is ambiguous, default to the editing path." in text,
        "Skill must default ambiguous requests to editing",
    )
    require(
        "Trigger this path only from an explicit no-edit or assemble-as-is request." in text,
        "Fast path must require explicit no-edit intent",
    )

    required = [
        SKILL / "agents" / "openai.yaml",
        SKILL / "assets" / "html" / "index.html",
        SKILL / "assets" / "html" / "styles.css",
        SKILL / "assets" / "html" / "flipbook.js",
        SKILL / "assets" / "html" / "html-contract.test.mjs",
        SKILL / "assets" / "html" / "vendor" / "page-flip.browser.js",
        SKILL / "scripts" / "make_contact_sheet.py",
        SKILL / "references" / "styles" / "poetic-documentary.md",
        SKILL / "references" / "styles" / "travel-zine.md",
        ROOT / "examples" / "vanilla-html-book" / "index.html",
        ROOT / "evals" / "run_eval.py",
        ROOT / "evals" / "cases" / "hawaii-v1" / "prompt.md",
        ROOT / "evals" / "cases" / "hawaii-v1" / "input" / "page-01-cover-hd.jpg",
        ROOT / "evals" / "rubrics" / "photo-flipbook-v1.json",
    ]
    for path in required:
        require(path.is_file(), f"Missing required repository file: {path.relative_to(ROOT)}")

    subprocess.run(
        ["node", "--test", str(SKILL / "assets" / "html" / "html-contract.test.mjs")],
        check=True,
    )
    subprocess.run(
        ["python3", "-m", "unittest", str(ROOT / "tests" / "test_contact_sheet.py")],
        check=True,
    )
    subprocess.run(
        ["node", "--test", str(ROOT / "examples" / "vanilla-html-book" / "test.mjs")],
        check=True,
    )
    print("Repository structure is valid")


if __name__ == "__main__":
    main()

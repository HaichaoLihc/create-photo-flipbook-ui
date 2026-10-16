#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "create-photo-flipbook-ui"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def validate_skill(skill: Path) -> None:
    skill_md = skill / "SKILL.md"
    require(skill_md.is_file(), f"Missing installable SKILL.md in {skill.name}")
    text = skill_md.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    require(match is not None, f"{skill.name}/SKILL.md frontmatter is missing or malformed")
    frontmatter = match.group(1)
    require(
        re.search(rf"^name:\s*{re.escape(skill.name)}\s*$", frontmatter, re.MULTILINE)
        is not None,
        f"Skill name does not match its directory: {skill.name}",
    )
    require(
        re.search(r"^description:\s*\S", frontmatter, re.MULTILINE) is not None,
        f"Skill description is missing: {skill.name}",
    )
    for document in [skill_md, *(skill / "references").rglob("*.md")]:
        for target in re.findall(r"\]\(([^)]+)\)", document.read_text(encoding="utf-8")):
            if "://" in target or target.startswith("#"):
                continue
            linked = document.parent / target.split("#", 1)[0]
            require(linked.exists(), f"Broken skill reference in {skill.name}/{document.name}: {target}")



def main() -> None:
    validate_skill(SKILL)

    required = [
        SKILL / "agents" / "openai.yaml",
        SKILL / "assets" / "html" / "index.html",
        SKILL / "assets" / "html" / "styles.css",
        SKILL / "assets" / "html" / "flipbook.js",
        SKILL / "assets" / "html" / "html-contract.test.mjs",
        SKILL / "assets" / "html" / "vendor" / "page-flip.browser.js",
        SKILL / "scripts" / "make_contact_sheet.py",
        SKILL / "scripts" / "photo_library.py",
        SKILL / "references" / "default-style.md",
        SKILL / "references" / "book-rhythm.md",
        SKILL / "references" / "photo-library.md",
        SKILL / "references" / "spread-generation.md",
        SKILL / "references" / "book-editing.md",
        ROOT / "ui-collections" / "2d-book" / "index.html",
        ROOT / "ui-collections" / "library" / "index.html",
        ROOT / "ui-collections" / "library" / "book.html",
        ROOT / "ui-collections" / "library" / "package.json",
        ROOT / "ui-collections" / "3d-book-1" / "index.html",
        ROOT / "ui-collections" / "3d-book-1" / "package.json",
        ROOT / "ui-collections" / "3d-book-2" / "index.html",
        ROOT / "ui-collections" / "3d-book-2" / "package.json",
        ROOT / "website" / "index.html",
        ROOT / "website" / "zh" / "index.html",
        ROOT / "website" / "demo.html",
        ROOT / "website" / "zh" / "demo.html",
        ROOT / "website" / "package.json",
        ROOT / "website" / "package-lock.json",
        ROOT / "ui-collections" / "card-gallery" / "index.html",
        ROOT / "ui-collections" / "image-atlas" / "index.html",
        ROOT / "ui-collections" / "photo-ring" / "index.html",
        ROOT / "ui-collections" / "film-negative-flipbook" / "build_archive.py",
        ROOT / "evals" / "run_eval.py",
        ROOT / "evals" / "cases" / "hawaii-v1" / "prompt.md",
        ROOT / "evals" / "cases" / "hawaii-v1" / "input" / "page-01-cover-hd.jpg",
        ROOT / "evals" / "rubrics" / "photo-flipbook-v1.json",
    ]
    for path in required:
        require(path.is_file(), f"Missing required repository file: {path.relative_to(ROOT)}")

    for target in re.findall(r"\]\(([^)]+)\)", (ROOT / "README.md").read_text(encoding="utf-8")):
        if "://" not in target and not target.startswith("#"):
            require((ROOT / target.split("#", 1)[0]).exists(), f"Broken README reference: {target}")

    subprocess.run(
        ["node", "--test", str(SKILL / "assets" / "html" / "html-contract.test.mjs")],
        check=True,
    )
    subprocess.run(
        ["python3", "-m", "unittest", str(ROOT / "tests" / "test_contact_sheet.py"),
         str(ROOT / "tests" / "test_photo_library.py")],
        check=True,
    )
    subprocess.run(
        ["node", "--test", str(ROOT / "ui-collections" / "2d-book" / "test.mjs")],
        check=True,
    )
    subprocess.run(
        [
            "node",
            "--test",
            str(ROOT / "ui-collections" / "3d-book-1" / "src" / "flipbook-contract.test.mjs"),
        ],
        check=True,
    )
    subprocess.run(
        [
            "node",
            "--test",
            str(ROOT / "ui-collections" / "3d-book-2" / "src" / "quick-flipbook-contract.test.mjs"),
        ],
        check=True,
    )
    subprocess.run(
        ["node", "--test", str(ROOT / "ui-collections" / "library" / "test.mjs")],
        check=True,
    )
    subprocess.run(
        ["node", "--test", str(ROOT / "ui-collections" / "photo-ring" / "tests" / "collection.test.cjs")],
        check=True,
    )
    print("Repository structure is valid")


if __name__ == "__main__":
    main()

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
    for document in [SKILL_MD, *(SKILL / "references").rglob("*.md")]:
        for target in re.findall(r"\]\(([^)]+)\)", document.read_text(encoding="utf-8")):
            if "://" in target or target.startswith("#"):
                continue
            linked = document.parent / target.split("#", 1)[0]
            require(linked.exists(), f"Broken skill reference in {document.name}: {target}")

    required = [
        SKILL / "agents" / "openai.yaml",
        SKILL / "assets" / "html" / "index.html",
        SKILL / "assets" / "html" / "styles.css",
        SKILL / "assets" / "html" / "flipbook.js",
        SKILL / "assets" / "html" / "html-contract.test.mjs",
        SKILL / "assets" / "html" / "vendor" / "page-flip.browser.js",
        SKILL / "scripts" / "make_contact_sheet.py",
        SKILL / "scripts" / "photo_library.py",
        SKILL / "references" / "photo-library.md",
        SKILL / "references" / "spread-generation.md",
        SKILL / "references" / "book-editing.md",
        SKILL / "references" / "photo-skill-catalog.md",
        SKILL / "references" / "pinterest-style-research.md",
        SKILL / "scripts" / "pinterest" / "cli.mjs",
        SKILL / "scripts" / "pinterest" / "engine.mjs",
        SKILL / "scripts" / "pinterest" / "storage.mjs",
        SKILL / "scripts" / "pinterest" / "package.json",
        SKILL / "scripts" / "pinterest" / "package-lock.json",
        ROOT / "examples" / "2d-book" / "index.html",
        ROOT / "examples" / "library" / "index.html",
        ROOT / "examples" / "library" / "book.html",
        ROOT / "examples" / "library" / "package.json",
        ROOT / "examples" / "3d-book-1" / "index.html",
        ROOT / "examples" / "3d-book-1" / "package.json",
        ROOT / "examples" / "3d-book-2" / "index.html",
        ROOT / "examples" / "3d-book-2" / "package.json",
        ROOT / "evals" / "run_eval.py",
        ROOT / "evals" / "cases" / "hawaii-v1" / "prompt.md",
        ROOT / "evals" / "cases" / "hawaii-v1" / "input" / "page-01-cover-hd.jpg",
        ROOT / "evals" / "rubrics" / "photo-flipbook-v1.json",
    ]
    for path in required:
        require(path.is_file(), f"Missing required repository file: {path.relative_to(ROOT)}")

    catalog = (SKILL / "references" / "photo-skill-catalog.md").read_text(
        encoding="utf-8"
    )
    catalog_skills = (
        "$compose-photo-memory-archive",
        "$gc-minimal-zine-poster-v0-3",
        "$photo-abstract-editorial",
        "$scene-distillation-zine-v1-3",
        "$scenes-gathered-zine-v1-3",
        "$surreal-pop-collage",
    )
    for skill_name in catalog_skills:
        require(skill_name in catalog, f"Missing curated photo skill: {skill_name}")
    catalog_lines = [line for line in catalog.splitlines() if line.strip()]
    require(
        catalog_lines[0] == "# Curated Photo Skills"
        and all(line.startswith("- `$",) and line.endswith("`") for line in catalog_lines[1:]),
        "Photo skill catalog must contain only a heading and skill-name list",
    )

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
        ["node", "--test", str(ROOT / "examples" / "2d-book" / "test.mjs")],
        check=True,
    )
    subprocess.run(
        [
            "node",
            "--test",
            str(ROOT / "examples" / "3d-book-1" / "src" / "flipbook-contract.test.mjs"),
        ],
        check=True,
    )
    subprocess.run(
        [
            "node",
            "--test",
            str(ROOT / "examples" / "3d-book-2" / "src" / "quick-flipbook-contract.test.mjs"),
        ],
        check=True,
    )
    subprocess.run(
        ["node", "--test", str(ROOT / "tests" / "pinterest.test.mjs")],
        check=True,
    )
    subprocess.run(
        ["node", "--test", str(ROOT / "examples" / "library" / "test.mjs")],
        check=True,
    )
    print("Repository structure is valid")


if __name__ == "__main__":
    main()

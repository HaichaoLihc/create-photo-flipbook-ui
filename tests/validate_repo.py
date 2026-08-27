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
    for snippet in (
        "Explore the collection before editing it.",
        "Style fidelity vs book coherence",
        "as baseline knowledge, not a fixed recipe",
        "choose more than one when their combination has a clear purpose",
        "the left half is the back cover and the right half is the front cover",
        "keep the generated back cover as the final hard leaf",
        "Build a contact sheet from the accepted full spreads in reading order.",
    ):
        require(snippet in text, f"Missing spread-first workflow contract: {snippet}")
    workflow_order = [
        text.index("Explore the collection before editing it."),
        text.index("Read [photo-skill-catalog.md]"),
        text.index("Curate only photographs"),
        text.index("Generate the outside-cover spread first"),
    ]
    require(
        workflow_order == sorted(workflow_order),
        "Editing workflow must explore, route, curate/sequence, then generate",
    )
    styles_dir = SKILL / "references" / "styles"
    require(
        not styles_dir.exists() or not any(styles_dir.iterdir()),
        "Flipbook engine must not bundle visual styles",
    )

    required = [
        SKILL / "agents" / "openai.yaml",
        SKILL / "assets" / "html" / "index.html",
        SKILL / "assets" / "html" / "styles.css",
        SKILL / "assets" / "html" / "flipbook.js",
        SKILL / "assets" / "html" / "html-contract.test.mjs",
        SKILL / "assets" / "html" / "vendor" / "page-flip.browser.js",
        SKILL / "scripts" / "make_contact_sheet.py",
        SKILL / "references" / "book-editing.md",
        SKILL / "references" / "photo-skill-catalog.md",
        ROOT / "examples" / "v1" / "index.html",
        ROOT / "examples" / "v2" / "index.html",
        ROOT / "examples" / "v2" / "package.json",
        ROOT / "examples" / "v3-book" / "index.html",
        ROOT / "examples" / "v3-book" / "package.json",
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
        ["python3", "-m", "unittest", str(ROOT / "tests" / "test_contact_sheet.py")],
        check=True,
    )
    subprocess.run(
        ["node", "--test", str(ROOT / "examples" / "v1" / "test.mjs")],
        check=True,
    )
    subprocess.run(
        [
            "node",
            "--test",
            str(ROOT / "examples" / "v2" / "src" / "flipbook-contract.test.mjs"),
        ],
        check=True,
    )
    subprocess.run(
        [
            "node",
            "--test",
            str(ROOT / "examples" / "v3-book" / "src" / "quick-flipbook-contract.test.mjs"),
        ],
        check=True,
    )
    print("Repository structure is valid")


if __name__ == "__main__":
    main()

"""Copy a local photo and register its stable ID. No resizing or network access."""
import argparse
import json
from pathlib import Path
import re
import shutil


def add_photo(root, source, photo_id, description="", photographer=""):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", photo_id):
        raise ValueError("Use letters, numbers, hyphens or underscores for the photo ID.")
    suffix = source.suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".avif"} or not source.is_file():
        raise ValueError("Supply a local JPEG, PNG, WebP or AVIF file.")
    manifest = root / "dist/photos.json"
    data = json.loads(manifest.read_text())
    if any(p["id"] == photo_id for p in data["photos"]):
        raise ValueError(f"Photo ID already exists: {photo_id}")
    relative = f"assets/photos/{photo_id}{suffix}"
    target = root / "dist" / relative
    if target.exists():
        raise ValueError(f"File already exists: {target}")
    data["photos"].append({"id": photo_id, "src": relative,
                           "description": description, "photographer": photographer})
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    try:
        manifest.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    except Exception:
        target.unlink()
        raise
    return relative


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path)
    parser.add_argument("--id", required=True, help="Stable ID used by story chapters")
    parser.add_argument("--description", default="")
    parser.add_argument("--photographer", default="")
    args = parser.parse_args()
    try:
        path = add_photo(Path(__file__).resolve().parents[1], args.file, args.id,
                         args.description, args.photographer)
        print(f"Added {args.id}: {path}. The image stays local; metadata is tracked.")
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, f"{error}\n")

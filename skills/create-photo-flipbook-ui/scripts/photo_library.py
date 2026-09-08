#!/usr/bin/env python3
"""Folder collections for the existing photo-search engine; originals stay untouched."""

from __future__ import annotations

import argparse
from contextlib import contextmanager
import hashlib
import importlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import uuid

sys.dont_write_bytecode = True
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
VERSION = 1


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def photo_id(path):
    # Same stable path-based IDs as photo_search_engine.photo_id_for_path.
    return "photo_" + hashlib.sha256(str(path).encode("utf-8")).hexdigest()[:16]


def fingerprint(path):
    stat = Path(path).stat()
    return {"size": stat.st_size, "mtime_ns": stat.st_mtime_ns}


def scan(folder):
    """Resolve paths and exclude symlinks escaping the requested source folder."""
    paths = {p.resolve() for p in folder.rglob("*") if p.suffix.lower() in EXTENSIONS and p.is_file()}
    return {str(p): fingerprint(p) for p in sorted(paths) if p.is_relative_to(folder)}


@contextmanager
def index_lock(collection):
    import fcntl

    with (collection / ".index.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise RuntimeError("This collection is already being indexed; wait for that run") from error
        try:
            yield
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


class SiglipBackend:
    """Reuse the installed engine and its indexing CLI, without copying model code."""

    def __init__(self, directory):
        self.directory = Path(directory).expanduser().resolve()
        for filename in ("index.py", "photo_search_engine.py"):
            if not (self.directory / filename).is_file():
                raise ValueError(f"Missing {filename} in engine directory {self.directory}")
        sys.path.insert(0, str(self.directory))
        self.module = importlib.import_module("photo_search_engine")
        if Path(self.module.__file__).resolve().parent != self.directory:
            raise RuntimeError("A different photo-search engine is already loaded")
        self.model_id = self.module.MODEL_ID

    def encode(self, paths, work, batch_size):
        import numpy as np
        from PIL import Image

        # The engine writes paths.json and embeddings.npy in its working directory.
        # Stage only changed files via links and keep those writes in a temporary folder.
        inputs = work / "inputs"
        inputs.mkdir()
        originals = {}
        for path in paths:
            # The upstream CLI fails when every input is unreadable. Decode first
            # so a corrupt-only refresh can still retain the usable collection.
            try:
                with Image.open(path) as source:
                    source.load()
            except (OSError, ValueError):
                continue
            link = inputs / (photo_id(path) + Path(path).suffix.lower())
            link.symlink_to(path)
            originals[str(link)] = path
        if not originals:
            return {}
        subprocess.run(
            [sys.executable, "-B", str(self.directory / "index.py"), str(inputs),
             "--batch-size", str(batch_size)],
            cwd=work, stdout=sys.stderr, check=True,
        )
        returned = read_json(work / "paths.json")
        vectors = np.load(work / "embeddings.npy", allow_pickle=False)
        if vectors.ndim != 2 or len(returned) != len(vectors) or not np.isfinite(vectors).all():
            raise ValueError("The engine returned an invalid embedding index")
        if len(returned) != len(set(returned)) or any(p not in originals for p in returned):
            raise ValueError("The engine returned unexpected source paths")
        return {originals[p]: vectors[i] for i, p in enumerate(returned)}

    def search(self, snapshot, query, count, threshold):
        return self.module.PhotoSearchEngine(base_dir=snapshot).search(query, count, threshold)["results"]


def load_collection(collection, *, check_files=False):
    collection = Path(collection).expanduser().resolve()
    state = read_json(collection / "collection.json")
    if state.get("version") != VERSION:
        raise ValueError("Unsupported collection version")
    root = Path(state["source_root"])
    snapshot = (collection / state["snapshot"]).resolve()
    if not root.is_absolute() or not snapshot.is_relative_to(collection) or snapshot == collection:
        raise ValueError("Invalid collection paths")
    paths = read_json(snapshot / "paths.json")
    if paths != list(state["files"]):
        raise ValueError("Collection manifest does not match its index")
    for path, record in state["files"].items():
        resolved = Path(path).resolve()
        if not resolved.is_relative_to(root) or str(resolved) != path:
            raise ValueError("Collection contains a photo outside its source folder")
        if check_files and (not resolved.is_file() or fingerprint(resolved) != record):
            raise ValueError("Source photos changed or disappeared; run index again before searching")
    return state, snapshot


def index_collection(folder, cache, backend, batch_size=32):
    import numpy as np

    root = Path(folder).expanduser().resolve()
    if not root.is_dir():
        raise ValueError(f"Photo folder does not exist: {root}")
    if batch_size < 1:
        raise ValueError("batch size must be positive")
    collection_id = hashlib.sha256(str(root).encode("utf-8")).hexdigest()[:24]
    collection = Path(cache).expanduser().resolve() / collection_id
    if collection.is_relative_to(root):
        raise ValueError("Keep the collection cache outside the source photo folder")
    collection.mkdir(parents=True, exist_ok=True)
    with index_lock(collection):
        current = scan(root)
        old = None
        previous = {}
        if (collection / "collection.json").exists():
            old, old_snapshot = load_collection(collection)
            if old["source_root"] != str(root):
                raise ValueError("Collection belongs to a different source folder")
            if old["model_id"] == backend.model_id:
                matrix = np.load(old_snapshot / "embeddings.npy", allow_pickle=False)
                if matrix.ndim != 2 or len(matrix) != len(old["files"]) or not np.isfinite(matrix).all():
                    raise ValueError("Cached embedding index is invalid")
                previous = {p: matrix[i] for i, p in enumerate(old["files"])
                            if current.get(p) == old["files"][p]}
        changed = [p for p in current if p not in previous]
        if old and not changed and set(previous) == set(old["files"]) and old["model_id"] == backend.model_id:
            return {**old, "collection_dir": str(collection), "reused": len(previous), "embedded": 0}
        with tempfile.TemporaryDirectory(prefix="photo-index-", dir=collection) as temporary:
            work = Path(temporary)
            added = backend.encode(changed, work, batch_size) if changed else {}
            if set(added) - set(changed):
                raise ValueError("The engine returned unexpected photos")
            available = {**previous, **added}
            kept = [p for p in current if p in available]
            # Do not publish an index built while its sources were being edited.
            if scan(root) != current:
                raise RuntimeError("Source folder changed during indexing; run index again")
            matrix = np.stack([available[p] for p in kept]) if kept else np.empty((0, 0), dtype=np.float32)
            if matrix.ndim != 2 or not np.isfinite(matrix).all():
                raise ValueError("Embedding dimensions or values are invalid")
            skipped = [p for p in current if p not in available]
            snapshot_name = "snapshot-" + uuid.uuid4().hex
            staged = work / snapshot_name
            staged.mkdir()
            np.save(staged / "embeddings.npy", matrix, allow_pickle=False)
            write_json(staged / "paths.json", kept)
            state = {
                "version": VERSION, "collection_id": collection_id, "source_root": str(root),
                "model_id": backend.model_id, "snapshot": snapshot_name,
                "status": "partial" if skipped else ("ready" if kept else "empty"),
                "total_images": len(kept), "skipped": skipped,
                "files": {p: current[p] for p in kept},
            }
            write_json(work / "collection.json", state)
            staged.rename(collection / snapshot_name)
            os.replace(work / "collection.json", collection / "collection.json")
        return {**state, "collection_dir": str(collection), "reused": len(previous), "embedded": len(added)}


def make_results(paths):
    return [{"path": p, "photo_id": photo_id(p), "rank": i + 1} for i, p in enumerate(paths)]


def save_sheet(results, output, *, query=None, state=None):
    from make_contact_sheet import make_contact_sheet

    output = Path(output).expanduser().resolve()
    output.mkdir(parents=True, exist_ok=False)
    items = []
    for i, result in enumerate(results):
        path = str(Path(result["path"]).resolve())
        items.append({**result, "path": path, "photo_id": photo_id(path), "position": i + 1,
                      "row": i // 5 + 1, "column": i % 5 + 1, "fingerprint": fingerprint(path)})
    sheet = make_contact_sheet([r["path"] for r in items], output / "contact-sheet.jpg", columns=5) if items else None
    manifest = {
        "version": VERSION, "query": query, "count": len(items), "items": items,
        "grid": {"columns": 5, "rows": (len(items) + 4) // 5, "order": "left-to-right, then top-to-bottom"},
        "contact_sheet": str(sheet) if sheet else None,
    }
    if state:
        manifest.update({k: state[k] for k in ("collection_id", "source_root", "model_id", "snapshot")})
    write_json(output / "manifest.json", manifest)
    return {**manifest, "manifest_path": str(output / "manifest.json")}


def collection_sheet(collection, output, count=25, *, query=None, threshold=0.0, backend=None):
    if not 1 <= count <= 50:
        raise ValueError("count must be between 1 and 50")
    if not 0 <= threshold <= 1:
        raise ValueError("threshold must be between 0 and 1")
    if query is not None and not query.strip():
        raise ValueError("query must not be empty")
    state, snapshot = load_collection(collection, check_files=True)
    paths = list(state["files"])
    if query is None:
        # An evenly spaced overview is a sample, not semantic clustering.
        size = min(len(paths), count)
        indices = [round(i * (len(paths) - 1) / max(1, size - 1)) for i in range(size)]
        results = make_results([paths[i] for i in indices])
    else:
        if backend.model_id != state["model_id"]:
            raise ValueError("Model changed; run index again to rebuild this collection")
        results = backend.search(snapshot, query, count, threshold) if paths else []
        if any(r["path"] not in state["files"] for r in results):
            raise ValueError("Search returned a photo outside this collection")
    return save_sheet(results, output, query=query, state=state)


def select_photos(manifest_path, ids, output, collection=None):
    manifest = read_json(manifest_path)
    source_items = manifest["items"]  # Also accepts the current MCP's saved JSON manifest.
    by_id = {item["photo_id"]: item for item in source_items}
    if len(by_id) != len(source_items):
        raise ValueError("Manifest contains duplicate photo IDs")
    state = load_collection(collection, check_files=True)[0] if collection else None
    selected = []
    for selected_id in dict.fromkeys(ids):
        if selected_id not in by_id:
            raise ValueError(f"Photo ID is not in this manifest: {selected_id}")
        item = by_id[selected_id]
        path = Path(item["path"]).expanduser().resolve()
        if not path.is_file() or photo_id(path) != selected_id:
            raise ValueError("Selected photo is missing or its ID does not match its path")
        root = (state or manifest).get("source_root")
        if root and not path.is_relative_to(Path(root).resolve()):
            raise ValueError("Selected photo is outside the requested source folder")
        if state and str(path) not in state["files"]:
            raise ValueError("Selected photo does not belong to this collection")
        current = fingerprint(path)
        if "fingerprint" in item and current != item["fingerprint"]:
            raise ValueError("Selected photo changed since review; inspect a fresh contact sheet")
        selected.append({"photo_id": selected_id, "path": str(path), "fingerprint": current})
    if not selected:
        raise ValueError("Select at least one photo")
    output = Path(output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8") as stream:
        json.dump({"version": VERSION, "source_manifest": str(Path(manifest_path).resolve()),
                   "items": selected}, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    return {"selection_path": str(output), "count": len(selected)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine-dir", default=os.environ.get("PHOTO_SEARCH_ENGINE_DIR"))
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("doctor", help="Inspect engine location without loading the model")
    index = commands.add_parser("index", help="Create or refresh a folder's cached collection")
    index.add_argument("folder")
    index.add_argument("--cache-dir", default=os.environ.get("PHOTO_LIBRARY_CACHE", "~/.cache/photo-search/collections"))
    index.add_argument("--batch-size", type=int, default=32)
    for name in ("overview", "search"):
        command = commands.add_parser(name)
        command.add_argument("--collection", required=True)
        command.add_argument("--output", required=True, help="New directory for this sheet and manifest")
        command.add_argument("--count", type=int, default=25)
        if name == "search":
            command.add_argument("--query", required=True)
            command.add_argument("--threshold", type=float, default=0.0)
    select = commands.add_parser("select")
    select.add_argument("--manifest", required=True)
    select.add_argument("--ids", nargs="+", required=True, help="Photo IDs in desired selection order")
    select.add_argument("--output", required=True, help="New selection JSON file")
    select.add_argument("--collection", help="Restrict even an MCP manifest to this indexed folder")
    args = parser.parse_args()
    if args.command in {"doctor", "index", "search"} and not args.engine_dir:
        parser.error("Set --engine-dir or PHOTO_SEARCH_ENGINE_DIR to the installed photo-search project")
    if args.command == "doctor":
        directory = Path(args.engine_dir).expanduser().resolve()
        missing = [name for name in ("index.py", "photo_search_engine.py") if not (directory / name).is_file()]
        if missing:
            raise ValueError("Missing engine files: " + ", ".join(missing))
        python = directory / ".venv" / "bin" / "python"
        result = {"engine_dir": str(directory), "suggested_python": str(python) if python.is_file() else None,
                  "current_python": sys.executable, "model_loaded": False,
                  "note": "Use an interpreter with the engine requirements installed for index and search."}
    elif args.command == "index":
        result = index_collection(args.folder, args.cache_dir, SiglipBackend(args.engine_dir), args.batch_size)
        result = {k: v for k, v in result.items() if k != "files"}
    elif args.command in {"overview", "search"}:
        backend = SiglipBackend(args.engine_dir) if args.command == "search" else None
        result = collection_sheet(args.collection, args.output, args.count, query=getattr(args, "query", None),
                                  threshold=getattr(args, "threshold", 0.0), backend=backend)
    else:
        result = select_photos(args.manifest, args.ids, args.output, args.collection)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError, KeyError, ImportError, subprocess.CalledProcessError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        sys.exit(1)

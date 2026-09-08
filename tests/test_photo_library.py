"""Collection behavior tests without downloading a model or touching a real library."""

from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

SCRIPTS = Path(__file__).resolve().parents[1] / "skills/create-photo-flipbook-ui/scripts"
sys.path.insert(0, str(SCRIPTS))
sys.dont_write_bytecode = True
import photo_library as library
import make_contact_sheet as sheets


class FixtureBackend:
    model_id = "fixture-colors"

    def __init__(self):
        self.batches = []
        self.fail = False

    def encode(self, paths, work, batch_size):
        self.batches.append(paths)
        if self.fail:
            raise RuntimeError("Index interrupted")
        encoded = {}
        for path in paths:
            try:
                with Image.open(path) as image:
                    vector = np.asarray(image.convert("RGB").resize((1, 1)), dtype=np.float32).reshape(3)
                encoded[path] = vector / np.linalg.norm(vector)
            except OSError:
                pass
        return encoded

    def search(self, snapshot, query, count, threshold):
        paths = library.read_json(snapshot / "paths.json")
        vectors = np.load(snapshot / "embeddings.npy")
        if query == "no matches":
            return []
        scores = vectors @ np.array([1, 0, 0])
        return [{"path": paths[i], "rank": rank + 1, "score": float(scores[i]),
                 "photo_id": library.photo_id(paths[i])}
                for rank, i in enumerate(np.argsort(scores)[::-1][:count]) if scores[i] >= threshold]


class PhotoLibraryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.photos = self.root / "photos"
        self.photos.mkdir()
        self.cache = self.root / "cache"
        self.backend = FixtureBackend()

    def photo(self, name, color, folder=None):
        path = (folder or self.photos) / name
        path.parent.mkdir(parents=True, exist_ok=True)
        Image.new("RGB", (80, 60), color).save(path)
        return str(path)

    def index(self):
        result = library.index_collection(self.photos, self.cache, self.backend)
        self.collection = Path(result["collection_dir"])
        return result

    def test_refresh_reuses_unchanged_and_handles_add_change_delete(self):
        a = self.photo("a.png", "red")
        b = self.photo("b.png", "green")
        first = self.index()
        self.assertEqual(first["embedded"], 2)
        repeated = self.index()
        self.assertEqual(repeated["snapshot"], first["snapshot"])
        self.assertEqual(repeated["reused"], 2)
        self.assertEqual(len(self.backend.batches), 1)
        self.photo("a.png", "blue")
        c = self.photo("nested/c.png", "red")
        refreshed = self.index()
        self.assertEqual(set(self.backend.batches[-1]), {a, c})
        self.assertEqual(refreshed["reused"], 1)
        Path(b).unlink()
        refreshed = self.index()
        self.assertEqual(set(refreshed["files"]), {a, c})
        self.assertEqual(refreshed["embedded"], 0)
        self.assertEqual(len(self.backend.batches), 2)

    def test_collections_and_symlinks_do_not_leak_other_folders(self):
        a = self.photo("a.png", "red")
        other = self.root / "other"
        other.mkdir()
        outside = self.photo("outside.png", "blue", other)
        (self.photos / "escape.png").symlink_to(outside)
        first = self.index()
        second = library.index_collection(other, self.cache, self.backend)
        self.assertEqual(list(first["files"]), [a])
        self.assertNotEqual(first["collection_id"], second["collection_id"])
        self.assertEqual(list(second["files"]), [outside])

    def test_failed_refresh_preserves_active_snapshot_and_original_bytes(self):
        a = self.photo("a.png", "red")
        original = Path(a).read_bytes()
        self.index()
        manifest = (self.collection / "collection.json").read_bytes()
        self.photo("b.png", "green")
        self.backend.fail = True
        with self.assertRaisesRegex(RuntimeError, "interrupted"):
            self.index()
        self.assertEqual((self.collection / "collection.json").read_bytes(), manifest)
        self.assertEqual(Path(a).read_bytes(), original)

    def test_partial_results_report_skipped_files_and_retry_them(self):
        self.photo("a.png", "red")
        broken = self.photos / "broken.jpg"
        broken.write_text("not an image")
        result = self.index()
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["skipped"], [str(broken)])
        self.index()
        self.assertEqual(self.backend.batches[-1], [str(broken)])

    def test_real_adapter_skips_corrupt_only_batch_without_launching_engine(self):
        broken = self.photos / "broken.jpg"
        broken.write_bytes(b"invalid image")
        work = self.root / "work"
        work.mkdir()
        backend = library.SiglipBackend.__new__(library.SiglipBackend)
        backend.directory = self.root / "no-engine-needed"
        self.assertEqual(backend.encode([str(broken)], work, 32), {})

    def test_model_change_rebuilds_every_vector(self):
        self.photo("a.png", "red")
        first = self.index()
        self.backend.model_id = "replacement-model"
        result = self.index()
        self.assertEqual(result["reused"], 0)
        self.assertEqual(result["embedded"], 1)
        self.assertNotEqual(result["snapshot"], first["snapshot"])

    def test_ranked_sheet_pixels_manifest_and_selection_order_agree(self):
        blue = self.photo("a-blue.png", "blue")
        red = self.photo("b-red.png", "red")
        self.index()
        result = library.collection_sheet(self.collection, self.root / "search", 2,
                                          query="red", backend=self.backend)
        self.assertEqual([i["path"] for i in result["items"]], [red, blue])
        self.assertEqual([(i["row"], i["column"]) for i in result["items"]], [(1, 1), (1, 2)])
        with Image.open(result["contact_sheet"]) as image:
            pixel = image.getpixel((sheets.MARGIN + sheets.CELL_WIDTH // 2,
                                    sheets.MARGIN + sheets.IMAGE_HEIGHT // 2))
            self.assertGreater(pixel[0], 245)
            self.assertLess(pixel[2], 10)
        selected = library.select_photos(result["manifest_path"],
                    [library.photo_id(blue), library.photo_id(red), library.photo_id(blue)],
                    self.root / "selection.json", self.collection)
        saved = library.read_json(selected["selection_path"])
        self.assertEqual([i["path"] for i in saved["items"]], [blue, red])

    def test_selection_rejects_unknown_outside_and_changed_photos(self):
        a = self.photo("a.png", "red")
        self.index()
        result = library.collection_sheet(self.collection, self.root / "overview")
        with self.assertRaisesRegex(ValueError, "not in this manifest"):
            library.select_photos(result["manifest_path"], ["made-up"], self.root / "bad.json")
        outside = self.photo("outside.png", "blue", self.root)
        manifest = self.root / "mcp.json"
        library.write_json(manifest, {"items": [{"photo_id": library.photo_id(outside), "path": outside}]})
        with self.assertRaisesRegex(ValueError, "outside"):
            library.select_photos(manifest, [library.photo_id(outside)], self.root / "bad.json", self.collection)
        self.photo("a.png", "blue")
        with self.assertRaisesRegex(ValueError, "changed since review"):
            library.select_photos(result["manifest_path"], [library.photo_id(a)], self.root / "bad.json")
        with self.assertRaisesRegex(ValueError, "changed or disappeared"):
            library.collection_sheet(self.collection, self.root / "stale")

    def test_empty_results_and_empty_folder_are_explicit(self):
        empty = self.index()
        self.assertEqual(empty["status"], "empty")
        overview = library.collection_sheet(self.collection, self.root / "empty")
        self.assertEqual(overview["count"], 0)
        self.assertIsNone(overview["contact_sheet"])
        self.photo("a.png", "red")
        self.index()
        result = library.collection_sheet(self.collection, self.root / "none", query="no matches", backend=self.backend)
        self.assertEqual(result["items"], [])
        self.assertIsNone(result["contact_sheet"])

    def test_overview_is_bounded_and_uses_all_of_the_path_range(self):
        paths = [self.photo(f"{i:02d}.png", "red") for i in range(8)]
        self.index()
        result = library.collection_sheet(self.collection, self.root / "overview", 3)
        self.assertEqual([i["path"] for i in result["items"]], [paths[0], paths[4], paths[7]])

    def test_index_lock_and_cache_boundary(self):
        self.index()
        with library.index_lock(self.collection):
            with self.assertRaisesRegex(RuntimeError, "already being indexed"):
                self.index()
        with self.assertRaisesRegex(ValueError, "outside"):
            library.index_collection(self.photos, self.photos / "cache", self.backend)


if __name__ == "__main__":
    unittest.main()

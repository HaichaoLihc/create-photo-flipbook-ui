from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "skills" / "create-photo-flipbook-ui" / "scripts" / "make_contact_sheet.py"
sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("make_contact_sheet", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class ContactSheetTests(unittest.TestCase):
    def test_preserves_supplied_image_order(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            ordered_colors = [(210, 20, 30), (20, 70, 210), (30, 180, 70)]
            files = []
            for index, color in enumerate(ordered_colors):
                path = directory / f"photo-{index}.png"
                Image.new("RGB", (400, 300), color).save(path)
                files.append(path)

            output = directory / "sheet.png"
            result = MODULE.make_contact_sheet(files, output)

            self.assertEqual(result, output)
            with Image.open(output) as sheet:
                columns, _ = MODULE._grid_shape(len(files))
                sampled = []
                for index in range(len(files)):
                    column = index % columns
                    row = index // columns
                    x = MODULE.MARGIN + column * (MODULE.CELL_WIDTH + MODULE.GAP) + MODULE.CELL_WIDTH // 2
                    y = MODULE.MARGIN + row * (MODULE.IMAGE_HEIGHT + MODULE.LABEL_HEIGHT + MODULE.GAP) + MODULE.IMAGE_HEIGHT // 2
                    sampled.append(sheet.getpixel((x, y)))
                self.assertEqual(sampled, ordered_colors)

    def test_rejects_an_empty_list(self) -> None:
        with self.assertRaises(ValueError):
            MODULE.make_contact_sheet([], "unused.png")


if __name__ == "__main__":
    unittest.main()

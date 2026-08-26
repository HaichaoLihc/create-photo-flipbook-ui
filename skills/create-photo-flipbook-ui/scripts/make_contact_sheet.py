#!/usr/bin/env python3
"""Create one labeled contact sheet from an explicitly ordered image list."""

from __future__ import annotations

import argparse
import math
from pathlib import Path
from typing import Sequence

from PIL import Image, ImageDraw, ImageFont, ImageOps


CELL_WIDTH = 360
IMAGE_HEIGHT = 270
LABEL_HEIGHT = 42
GAP = 12
MARGIN = 18
BACKGROUND = "#eeeae1"
CELL_BACKGROUND = "#d8d3c8"
TEXT_COLOR = "#24231f"


def _grid_shape(image_count: int) -> tuple[int, int]:
    columns = max(1, math.ceil(math.sqrt(image_count * 4 / 3)))
    rows = math.ceil(image_count / columns)
    return columns, rows


def _fit_label(draw: ImageDraw.ImageDraw, text: str, max_width: int, font: ImageFont.ImageFont) -> str:
    if draw.textlength(text, font=font) <= max_width:
        return text

    suffix = "…"
    candidate = text
    while candidate and draw.textlength(candidate + suffix, font=font) > max_width:
        candidate = candidate[:-1]
    return candidate + suffix


def make_contact_sheet(image_files: Sequence[str | Path], output_file: str | Path) -> Path:
    """Write a contact sheet whose cells follow ``image_files`` exactly."""

    files = [Path(path).expanduser() for path in image_files]
    if not files:
        raise ValueError("At least one image file is required")

    missing = [str(path) for path in files if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"Image file not found: {missing[0]}")

    columns, rows = _grid_shape(len(files))
    cell_height = IMAGE_HEIGHT + LABEL_HEIGHT
    sheet_width = MARGIN * 2 + columns * CELL_WIDTH + (columns - 1) * GAP
    sheet_height = MARGIN * 2 + rows * cell_height + (rows - 1) * GAP
    sheet = Image.new("RGB", (sheet_width, sheet_height), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=16)

    for index, path in enumerate(files):
        column = index % columns
        row = index // columns
        x = MARGIN + column * (CELL_WIDTH + GAP)
        y = MARGIN + row * (cell_height + GAP)

        draw.rectangle((x, y, x + CELL_WIDTH - 1, y + IMAGE_HEIGHT - 1), fill=CELL_BACKGROUND)
        try:
            with Image.open(path) as source:
                image = ImageOps.exif_transpose(source).convert("RGB")
                image.thumbnail((CELL_WIDTH, IMAGE_HEIGHT), Image.Resampling.LANCZOS)
                image_x = x + (CELL_WIDTH - image.width) // 2
                image_y = y + (IMAGE_HEIGHT - image.height) // 2
                sheet.paste(image, (image_x, image_y))
        except Image.UnidentifiedImageError as error:
            raise ValueError(f"Unsupported or invalid image: {path}") from error

        label = f"{index + 1:02d}  {path.name}"
        label = _fit_label(draw, label, CELL_WIDTH - 16, font)
        draw.text((x + 8, y + IMAGE_HEIGHT + 11), label, fill=TEXT_COLOR, font=font)

    output = Path(output_file).expanduser()
    output.parent.mkdir(parents=True, exist_ok=True)
    save_options = {"quality": 92, "subsampling": 0} if output.suffix.lower() in {".jpg", ".jpeg"} else {}
    sheet.save(output, **save_options)
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("images", nargs="+", help="Image files in the desired contact-sheet order")
    parser.add_argument("--output", "-o", required=True, help="Output .jpg or .png file")
    args = parser.parse_args()
    make_contact_sheet(args.images, args.output)


if __name__ == "__main__":
    main()

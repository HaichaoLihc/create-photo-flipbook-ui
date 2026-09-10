#!/usr/bin/env python3
"""Build a static 5-by-7 negative-sleeve flipbook from a photo folder."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
from pathlib import Path

PAGE_CAPACITY = 35
ROW_CAPACITY = 5
ROW_COUNT = 7
SUPPORTED = {".jpg", ".jpeg", ".png", ".webp"}


def natural_key(path: Path) -> list[object]:
    return [int(part) if part.isdigit() else part.casefold() for part in re.split(r"(\d+)", path.name)]


def frame_markup(record: dict[str, object] | None, slot_number: int) -> str:
    if record is None:
        return f'<span class="negative-frame is-empty" data-frame="{slot_number:04d}" aria-hidden="true"></span>'

    filename = html.escape(str(record["filename"]), quote=True)
    web_path = html.escape(str(record["web_path"]), quote=True)
    frame_number = int(record["index"])
    photo_id = html.escape(str(record.get("sha256", ""))[:16], quote=True)
    eager = "eager" if frame_number <= 70 else "lazy"
    return (
        f'<button class="negative-frame" data-frame="{frame_number:04d}" data-photo-id="{photo_id}" type="button" '
        f'aria-label="Reveal exposure {frame_number}">'
        f'<img src="{web_path}" alt="Archive photograph {filename}" loading="{eager}" decoding="async">'
        "</button>"
    )


def sleeve_markup(page_index: int, records: list[dict[str, object]]) -> str:
    # The blank inside-cover leaf occupies the first verso; sleeve one is recto.
    side = "recto" if page_index % 2 == 0 else "verso"
    start = page_index * PAGE_CAPACITY + 1
    end = start + len(records) - 1
    padded: list[dict[str, object] | None] = records + [None] * (PAGE_CAPACITY - len(records))
    rows = []
    for row_index in range(ROW_COUNT):
        row_start = row_index * ROW_CAPACITY
        frames = "".join(
            frame_markup(record, start + row_start + column_index)
            for column_index, record in enumerate(padded[row_start : row_start + ROW_CAPACITY])
        )
        rows.append(
            f'<div class="film-pocket"><div class="film-strip" aria-label="Negative strip {row_index + 1}">{frames}</div></div>'
        )

    return f"""
        <article class="book-page sleeve-page {side}" aria-label="Negative sleeve {page_index + 1}, exposures {start} through {end}">
          <div class="binder-holes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
          <div class="sleeve">
            {''.join(rows)}
          </div>
        </article>"""


def document(photo_count: int, sleeves: list[str], page_count: int) -> str:
    root = Path(__file__).resolve().parent
    asset_version = hashlib.sha256(b"".join((root / name).read_bytes() for name in ("styles.css", "flipbook.js", "strip-arrangement.js"))).hexdigest()[:10]
    opening_blank = '<article class="book-page opening-blank" aria-label="Blank inside cover"></article>'
    # Keep the back cover a single final leaf.
    closing_blank = '<article class="book-page closing-blank" aria-label="Blank end leaf"></article>' if page_count % 2 == 0 else ""

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#11110f">
  <title>Negative Archive — Film Sleeve Flipbook</title>
  <link rel="stylesheet" href="styles.css?v={asset_version}">
</head>
<body>
<main class="room">
  <header class="book-header">
    <span class="eyebrow">CONTACT ARCHIVE · {photo_count:,} EXPOSURES</span>
    <h1>Negative Sleeves</h1>
    <span id="orientation">Open spread</span>
  </header>
  <section class="stage" aria-label="Interactive negative film sleeve flipbook">
    <div class="book-rig">
      <div id="book" class="book" data-page-width="480" data-page-height="620">
        <article class="book-page binder-cover recto" data-density="hard" aria-label="Front cover">
          <div class="cover-type">
            <span>ARCHIVE / 001</span>
            <h2>NEGATIVE<br>ARCHIVE</h2>
            <p>{photo_count:,} photographs<br>{page_count} translucent sleeves</p>
          </div>
          <span class="cover-folio">35 MM · CONTACT FILE</span>
        </article>
        {opening_blank}
        {''.join(sleeves)}
        {closing_blank}
        <article class="book-page binder-cover verso" data-density="hard" aria-label="Back cover">
          <div class="back-label"><span>ARCHIVE / 001</span><strong>{photo_count:,}</strong><small>Photographs held in light.</small></div>
        </article>
      </div>
    </div>
  </section>
  <footer class="controls" aria-label="Book controls">
    <button id="previous" type="button" aria-label="Previous page">←</button>
    <div class="status" aria-live="polite"><span id="page-status">Cover</span><small><span id="interaction-hint">Drag to flip · Inner film edge to swap</span><button id="undo-strip-swap" type="button" hidden aria-label="Undo last strip exchange">Undo</button></small></div>
    <button id="next" type="button" aria-label="Next page">→</button>
  </footer>
</main>
<script src="vendor/page-flip.browser.js"></script>
<script src="strip-arrangement.js?v={asset_version}"></script>
<script src="flipbook.js?v={asset_version}"></script>
</body>
</html>
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Folder containing JPEG, PNG, or WebP photos (searched recursively)")
    parser.add_argument("--sequence", type=Path, help="Optional JSON with ordered_indices; otherwise use natural filename order")
    args = parser.parse_args()

    source = args.source.expanduser().resolve()
    if not source.is_dir():
        raise SystemExit(f"Photo folder not found: {source}")

    root = Path(__file__).resolve().parent
    photo_output = root / "assets" / "full-archive"
    sources = sorted(
        (path for path in source.rglob("*") if path.is_file() and path.suffix.casefold() in SUPPORTED
         and photo_output not in path.parents),
        key=lambda path: (natural_key(path), str(path.relative_to(source)).casefold()),
    )
    if not sources:
        raise SystemExit(f"No JPEG, PNG, or WebP photographs found in {source}")

    records = []
    for index, source_path in enumerate(sources, start=1):
        extension = ".jpg" if source_path.suffix.casefold() == ".jpeg" else source_path.suffix.casefold()
        destination = photo_output / f"archive-{index:04d}{extension}"
        records.append(
            {
                "index": index,
                "filename": source_path.name,
                "source": str(source_path),
                "destination": str(destination),
                "web_path": f"assets/full-archive/{destination.name}",
                "bytes": source_path.stat().st_size,
                "sha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
            }
        )

    sequence_path = args.sequence
    if sequence_path is not None:
        try:
            sequence = json.loads(sequence_path.expanduser().resolve().read_text(encoding="utf-8"))
            order = sequence["ordered_indices"]
            if not isinstance(order, list) or any(type(index) is not int for index in order):
                raise ValueError("ordered_indices must be an array of integers")
        except (OSError, ValueError, KeyError, TypeError) as error:
            raise SystemExit(f"Invalid sequence: {error}") from error
        if len(order) != len(records) or len(set(order)) != len(records):
            raise SystemExit("Semantic sequence must contain every source index exactly once")
        by_index = {int(record["index"]): record for record in records}
        if set(order) != set(by_index):
            raise SystemExit("Semantic sequence does not match the current photo folder")
        records = [by_index[index] for index in order]

    # Validate before writing anything. A same-size replacement is still a new photo.
    photo_output.mkdir(parents=True, exist_ok=True)
    for record in records:
        src, dst = Path(str(record["source"])), Path(str(record["destination"]))
        if not dst.exists() or hashlib.sha256(dst.read_bytes()).hexdigest() != record["sha256"]:
            shutil.copy2(src, dst)

    pages = [records[index : index + PAGE_CAPACITY] for index in range(0, len(records), PAGE_CAPACITY)]
    sleeves = [sleeve_markup(index, page) for index, page in enumerate(pages)]
    (root / "index.html").write_text(document(len(records), sleeves, len(sleeves)), encoding="utf-8")
    (root / "source-manifest.json").write_text(
        json.dumps(
            {
                "source": str(source),
                "photo_count": len(records),
                "page_capacity": PAGE_CAPACITY,
                "sleeve_count": len(pages),
                "sequence": str(sequence_path) if sequence_path else None,
                "records": records,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(json.dumps({"photos": len(records), "sleeves": len(sleeves), "output": str(root / 'index.html')}))


if __name__ == "__main__":
    main()

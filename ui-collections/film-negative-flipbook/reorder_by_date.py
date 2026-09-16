#!/usr/bin/env python3
"""Resequence the imported archive by camera capture time, without copying photos."""
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import json
from pathlib import Path
import shutil
from tempfile import mkdtemp

from PIL import Image

from build_archive import PAGE_CAPACITY, document, sleeve_markup


def capture_date(path):
    with Image.open(path) as image:
        root = image.getexif()
        exif = root.get_ifd(34665)
        for tag, subsecond, label in ((36867, 37521, 'DateTimeOriginal'), (36868, 37522, 'DateTimeDigitized')):
            raw = exif.get(tag) or root.get(tag)
            if not raw:
                continue
            try:
                date = datetime.strptime(str(raw).strip('\x00 '), '%Y:%m:%d %H:%M:%S')
            except ValueError:
                continue
            fraction = str(exif.get(subsecond) or root.get(subsecond) or '').strip('\x00 ')
            if fraction.isdigit():
                date = date.replace(microsecond=int(fraction[:6].ljust(6, '0')))
            return date, label
    # Export/modification timestamps are not evidence of when a photo was taken.
    return None, 'undated'


def reorder(root=None):
    root = Path(root or Path(__file__).parent).resolve()
    manifest_path = root / 'source-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    records = manifest['records']
    paths = [(root / record['web_path']).resolve() for record in records]
    if not records or any(not path.is_relative_to(root / 'assets' / 'full-archive') or not path.is_file() for path in paths):
        raise ValueError('The imported archive is empty or contains missing/out-of-scope photos.')
    indices = [record['index'] for record in records]
    if len(set(indices)) != len(indices):
        raise ValueError('Photo identifiers must be unique.')

    with ThreadPoolExecutor(max_workers=8) as pool:
        dates = list(pool.map(capture_date, paths))
    entries = [(date, {**record, 'captured_at': date.isoformat() if date else None, 'date_source': source})
               for record, (date, source) in zip(records, dates)]
    entries.sort(key=lambda item: (item[0] is None, item[0] or datetime.max, item[1]['index']))
    ordered = [record for _, record in entries]
    groups = [ordered[start:start + PAGE_CAPACITY] for start in range(0, len(ordered), PAGE_CAPACITY)]
    html = document(len(ordered), [sleeve_markup(i, group) for i, group in enumerate(groups)], len(groups))
    counts = Counter(record['date_source'] for record in ordered)
    known = [record['captured_at'] for record in ordered if record['captured_at']]
    sequence = {'order': 'capture-time', 'ordered_indices': [record['index'] for record in ordered],
                'date_sources': dict(counts), 'date_range': [known[0], known[-1]] if known else []}

    # Keep the previous generated arrangement recoverable; source images are never written.
    working = root / 'working'
    working.mkdir(exist_ok=True)
    backup = Path(mkdtemp(prefix='before-chronological-', dir=working))
    for name in ('index.html', 'source-manifest.json', 'chronological-sequence.json'):
        if (root / name).is_file():
            shutil.copy2(root / name, backup / name)
    manifest.update(records=ordered, sequence='chronological-sequence.json', order='capture-time')
    (root / 'index.html').write_text(html, encoding='utf-8')
    (root / 'chronological-sequence.json').write_text(json.dumps(sequence, indent=2), encoding='utf-8')
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    return {'photos': len(ordered), 'sleeves': len(groups), 'date_sources': dict(counts),
            'date_range': sequence['date_range'], 'backup': str(backup)}


if __name__ == '__main__':
    print(json.dumps(reorder(), ensure_ascii=False))

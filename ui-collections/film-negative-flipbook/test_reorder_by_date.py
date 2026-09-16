import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image

from reorder_by_date import capture_date, reorder


class ChronologyTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.assets = self.root / 'assets' / 'full-archive'
        self.assets.mkdir(parents=True)

    def photo(self, index, original=None, digitized=None, fraction=None):
        path = self.assets / f'{index}.jpg'
        exif = Image.Exif()
        exif[306] = '2026:09:10 12:00:00'
        if original: exif[36867] = original
        if digitized: exif[36868] = digitized
        if fraction: exif[37521] = fraction
        Image.new('RGB', (30, 20), '#879789').save(path, exif=exif)
        return {'index': index, 'filename': path.name, 'source': str(path),
                'web_path': path.relative_to(self.root).as_posix(), 'bytes': path.stat().st_size}

    def test_original_date_precedes_export_date_and_subseconds_are_preserved(self):
        record = self.photo(1, '2018:08:11 15:36:57', '2020:01:01 00:00:00', '123')
        date, source = capture_date(self.root / record['web_path'])
        self.assertEqual(date.isoformat(), '2018-08-11T15:36:57.123000')
        self.assertEqual(source, 'DateTimeOriginal')

    def test_invalid_original_uses_digitized_but_not_modification_time(self):
        one = self.photo(1, 'invalid', '2020:02:03 04:05:06')
        two = self.photo(2)
        self.assertEqual(capture_date(self.root / one['web_path'])[1], 'DateTimeDigitized')
        self.assertEqual(capture_date(self.root / two['web_path']), (None, 'undated'))

    def test_reordering_preserves_files_identifiers_and_previous_arrangement(self):
        records = [self.photo(1, '2023:02:03 04:05:06'), self.photo(2, '2018:01:02 03:04:05'),
                   self.photo(3), self.photo(4, '2018:01:02 03:04:05')]
        (self.root / 'source-manifest.json').write_text(json.dumps({'records': records}))
        (self.root / 'index.html').write_text('previous book')
        before = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in self.assets.iterdir()}
        result = reorder(self.root)
        after = json.loads((self.root / 'source-manifest.json').read_text())
        self.assertEqual([r['index'] for r in after['records']], [2, 4, 1, 3])
        self.assertEqual(after['records'][-1]['date_source'], 'undated')
        self.assertEqual((Path(result['backup']) / 'index.html').read_text(), 'previous book')
        self.assertEqual(before, {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in self.assets.iterdir()})
        html = (self.root / 'index.html').read_text()
        self.assertEqual(html.count('class="negative-frame'), 35)
        self.assertEqual(html.count('<button class="negative-frame"'), 4)
        self.assertLess(html.index('data-frame="0002"'), html.index('data-frame="0001"'))


if __name__ == '__main__':
    unittest.main()

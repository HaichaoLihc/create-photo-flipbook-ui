"""Exercise the importer in temporary folders; no personal photos are used."""
import contextlib
import io
import json
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path
from unittest.mock import patch

import build_archive as builder


def png(red=127, green=127, blue=127):
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', 1, 1, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(bytes([0, red, green, blue]))) + chunk(b'IEND', b''))


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='negative-sleeve-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.output = self.root / 'ui'
        self.source = self.root / 'photos'
        self.output.mkdir()
        self.source.mkdir()
        for name in ('styles.css', 'flipbook.js', 'strip-arrangement.js'):
            (self.output / name).write_text('/* fixture */')

    def run_import(self, *options):
        with patch.object(builder, '__file__', str(self.output / 'build_archive.py')), \
             patch.object(sys, 'argv', ['build_archive.py', str(self.source), *map(str, options)]), \
             contextlib.redirect_stdout(io.StringIO()):
            builder.main()
        return json.loads((self.output / 'source-manifest.json').read_text())

    def test_formats_natural_order_and_exact_copy(self):
        for name in ('photo10.PNG', 'photo2.JPEG', 'photo3.webp'):
            (self.source / name).write_bytes(png())
        nested = self.source / 'nested'
        nested.mkdir()
        (nested / 'photo1.jpg').write_bytes(png(12, 30, 48))
        manifest = self.run_import()
        self.assertEqual([r['filename'] for r in manifest['records']],
                         ['photo1.jpg', 'photo2.JPEG', 'photo3.webp', 'photo10.PNG'])
        self.assertEqual([Path(r['destination']).suffix for r in manifest['records']],
                         ['.jpg', '.jpg', '.webp', '.png'])
        for record in manifest['records']:
            self.assertEqual(Path(record['source']).read_bytes(), Path(record['destination']).read_bytes())
            self.assertEqual(len(record['sha256']), 64)

    def test_small_full_and_partial_books_keep_parity(self):
        for count in (1, 35, 36, 70, 73):
            records = [{'index': i, 'filename': f'{i}.png', 'web_path': f'{i}.png'}
                       for i in range(1, count + 1)]
            groups = [records[i:i + 35] for i in range(0, count, 35)]
            sleeves = [builder.sleeve_markup(i, group) for i, group in enumerate(groups)]
            html = builder.document(count, sleeves, len(sleeves))
            with self.subTest(count=count):
                self.assertEqual(html.count('data-density="hard"'), 2)
                self.assertEqual(html.count('<article ') % 2, 0)
                self.assertEqual(html.count('<button class="negative-frame"'), count)
                self.assertEqual(html.count('class="film-pocket"'), len(sleeves) * 7)

    def test_same_size_replacement_updates_copy_and_identity(self):
        source = self.source / 'photo.jpg'
        source.write_bytes(b'first')
        before = self.run_import()['records'][0]
        source.write_bytes(b'other')
        after = self.run_import()['records'][0]
        self.assertEqual(Path(after['destination']).read_bytes(), b'other')
        self.assertNotEqual(before['sha256'], after['sha256'])

    def test_sequence_is_explicit_and_invalid_sequence_writes_nothing(self):
        for index in (1, 2):
            (self.source / f'{index}.png').write_bytes(png())
        stale = self.output / 'semantic-sequence.json'
        stale.write_text('{"ordered_indices":[99]}')
        self.assertEqual([r['index'] for r in self.run_import()['records']], [1, 2])
        order = self.root / 'order.json'
        order.write_text('{"ordered_indices":[2,1]}')
        self.assertEqual([r['index'] for r in self.run_import('--sequence', order)['records']], [2, 1])
        previous_html = (self.output / 'index.html').read_bytes()
        for indices in ([1, 1], [1, 3], [1], [True, 2], '12'):
            order.write_text(json.dumps({'ordered_indices': indices}))
            with self.subTest(indices=indices), self.assertRaises(SystemExit):
                self.run_import('--sequence', order)
            self.assertEqual((self.output / 'index.html').read_bytes(), previous_html)

    def test_empty_source_is_rejected_without_output(self):
        with self.assertRaises(SystemExit):
            self.run_import()
        self.assertFalse((self.output / 'index.html').exists())
        self.assertFalse((self.output / 'assets').exists())

    def test_markup_escapes_names_and_protects_photo_identity(self):
        html = builder.frame_markup({'index': 1, 'filename': 'a"><script>.png',
                                     'web_path': 'a&b.png', 'sha256': '1234567890abcdef'}, 1)
        self.assertNotIn('<script>', html)
        self.assertIn('src="a&amp;b.png"', html)
        self.assertIn('data-photo-id="1234567890abcdef"', html)


if __name__ == '__main__':
    unittest.main()

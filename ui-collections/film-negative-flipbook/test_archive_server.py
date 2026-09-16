"""Synthetic fixtures only: no personal photos, model, or external service."""
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image

from archive_server import Archive, Handler, Search


class ArchiveServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        assets = self.root / 'assets' / 'full-archive'
        assets.mkdir(parents=True)
        records = []
        for index, color in enumerate(('red', 'green', 'blue'), 1):
            photo = assets / f'{index}.jpg'
            Image.new('RGB', (600, 400), color).save(photo)
            records.append({'index': index, 'filename': photo.name, 'source': str(photo),
                            'web_path': photo.relative_to(self.root).as_posix(), 'bytes': photo.stat().st_size})
        (self.root / 'source-manifest.json').write_text(json.dumps({'records': records}))
        (self.root / 'index.html').write_text('<!doctype html><title>Fixture</title>')
        self.archive = Archive(self.root)

    def start_server(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        server.archive = self.archive
        server.search = Search(self.archive)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        self.port = server.server_port
        self.server = server

    def request(self, path, method='GET', payload=None, headers=None):
        connection = HTTPConnection('127.0.0.1', self.port, timeout=3)
        try:
            body = json.dumps(payload) if payload is not None else None
            connection.request(method, path, body, headers or {})
            response = connection.getresponse()
            return response.status, response.read(), dict(response.getheaders())
        finally:
            connection.close()

    def test_manifest_cannot_reference_outside_assets(self):
        manifest = self.root / 'source-manifest.json'
        data = json.loads(manifest.read_text())
        data['records'][0]['web_path'] = 'index.html'
        manifest.write_text(json.dumps(data))
        with self.assertRaises(ValueError):
            Archive(self.root)

    def test_static_assets_and_private_files(self):
        self.start_server()
        code, body, headers = self.request('/api/status')
        self.assertEqual(code, 200)
        self.assertNotIn(str(self.root), body.decode())
        self.assertEqual(headers['Cache-Control'], 'no-store')
        for path in ('/', '/assets/full-archive/1.jpg'):
            self.assertEqual(self.request(path)[0], 200, path)
        for path in ('/source-manifest.json', '/archive_server.py', '/.search-cache/paths.json',
                     '/%2e%2e/index.html', '/api/catalog', '/api/export', '/api/thumb/0001'):
            self.assertEqual(self.request(path)[0], 404, path)

    def test_cross_origin_and_invalid_host_are_rejected(self):
        self.start_server()
        for headers in ({'Origin': 'https://example.org'}, {'Sec-Fetch-Site': 'cross-site'},
                        {'Host': 'example.org'}):
            self.assertEqual(self.request('/api/search?q=coast', headers=headers)[0], 403)

    def test_loading_and_invalid_api_requests(self):
        self.start_server()
        self.assertEqual(json.loads(self.request('/api/status')[1])['status'], 'unavailable')
        self.assertEqual(self.request('/api/search?q=coast')[0], 503)
        self.assertEqual(self.request('/api/search?q=')[0], 400)
        self.assertEqual(self.request('/api/search?q=' + 'a' * 161)[0], 400)
        for params in ('offset=-1', 'offset=abc', 'limit=0', 'limit=71', 'limit=', 'offset=1.5'):
            self.assertEqual(self.request('/api/search?q=coast&' + params)[0], 400)

    def test_search_reuses_engine_and_scopes_without_changing_original_index(self):
        engine_dir = self.root / 'engine'
        engine_dir.mkdir()
        module_file = engine_dir / 'photo_search_engine.py'
        module_file.touch()
        paths = [str(self.archive.records['0003']['file']), '/outside/archive.jpg',
                 str(self.archive.records['0001']['file'])]
        vectors = np.eye(3, dtype=np.float32)
        paths_file = engine_dir / 'paths.json'
        vectors_file = engine_dir / 'embeddings.npy'
        paths_file.write_text(json.dumps(paths))
        np.save(vectors_file, vectors)
        original = (paths_file.read_bytes(), vectors_file.read_bytes())
        calls = []

        class Engine:
            def __init__(self, base_dir):
                self.base_dir = base_dir

            def load(self):
                self.paths = json.loads((self.base_dir / 'paths.json').read_text())
                self.embeddings = np.load(self.base_dir / 'embeddings.npy')
                self.device = 'cpu'
                self.model = self

            def processor(self, **kwargs):
                calls.append(kwargs)
                return SimpleNamespace(to=lambda device: {})

            def get_text_features(self, **kwargs):
                import torch
                return torch.tensor([[.3, 0, .4]])

        search = Search(self.archive)
        search.engine_dir = search.index_dir = engine_dir
        module = SimpleNamespace(__file__=str(module_file), PhotoSearchEngine=Engine)
        with patch('archive_server.importlib.import_module', return_value=module), patch('sys.path', []):
            search.load()
        self.assertEqual(search.status, 'ready')
        self.assertEqual(search.count, 2)
        first = search.query(' coast ', limit=1)
        second = search.query('coast', offset=1, limit=1)
        self.assertEqual(first['photos'][0]['id'], '0001')
        self.assertAlmostEqual(first['photos'][0]['score'], .8)
        self.assertEqual(first['total'], 2)
        self.assertEqual(first['next_offset'], 1)
        self.assertEqual(second['photos'][0]['id'], '0003')
        self.assertAlmostEqual(second['photos'][0]['score'], .6)
        self.assertIsNone(second['next_offset'])
        self.assertEqual(calls, [{'text': ['coast'], 'padding': 'max_length', 'max_length': 64,
                                  'truncation': True, 'return_tensors': 'pt'}])
        self.assertEqual(original, (paths_file.read_bytes(), vectors_file.read_bytes()))
        scoped = np.load(search.engine.base_dir / 'embeddings.npy')
        np.testing.assert_array_equal(scoped, vectors[[0, 2]])

    def test_pagination_exceeds_200_and_caches_one_stable_ranking(self):
        self.start_server()
        search = self.server.search
        search.status = 'ready'
        matches = [{'id': str(i).zfill(4), 'score': 1 - i / 1000} for i in range(1, 264)]
        with patch.object(search, 'rank', return_value=matches) as rank:
            collected = []
            offset = 0
            while offset is not None:
                code, body, _ = self.request(f'/api/search?q=coast&offset={offset}&limit=35')
                self.assertEqual(code, 200)
                result = json.loads(body)
                self.assertEqual(result['total'], 263)
                collected.extend(result['photos'])
                offset = result['next_offset']
            self.assertEqual(collected, matches)
            self.assertEqual(search.query('coast', offset=999)['photos'], [])
            rank.assert_called_once_with('coast')
            for i in range(10):
                search.query(str(i))
            self.assertEqual(len(search.rankings), 8)
            self.assertNotIn('coast', search.rankings)

    def test_concurrent_pages_share_inference_and_empty_results_end(self):
        from concurrent.futures import ThreadPoolExecutor
        search = Search(self.archive)
        search.status = 'ready'
        with patch.object(search, 'rank', return_value=[]) as rank:
            with ThreadPoolExecutor(max_workers=4) as executor:
                results = list(executor.map(lambda _: search.query('nothing'), range(8)))
            rank.assert_called_once_with('nothing')
            self.assertTrue(all(r == {'photos': [], 'total': 0, 'next_offset': None} for r in results))


if __name__ == '__main__':
    unittest.main()

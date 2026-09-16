#!/usr/bin/env python3
"""Local in-book semantic search, reusing an installed PhotoSearchEngine."""
from __future__ import annotations

import argparse
from collections import OrderedDict
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib
import json
import mimetypes
import os
from pathlib import Path
import sys
import threading
from urllib.parse import parse_qs, unquote, urlsplit

ROOT = Path(__file__).resolve().parent


class Archive:
    def __init__(self, root=ROOT):
        self.root = Path(root).resolve()
        manifest = json.loads((self.root / 'source-manifest.json').read_text())
        self.records = {}
        self.by_source = {}
        for record in manifest['records']:
            path = (self.root / record['web_path']).resolve()
            if not path.is_relative_to(self.root / 'assets' / 'full-archive') or not path.is_file():
                raise ValueError('Rebuild the archive: an imported photo is missing or outside the archive.')
            item = {**record, 'id': str(record['index']).zfill(4), 'file': path}
            self.records[item['id']] = item
            self.by_source[str(Path(record['source']).resolve())] = item
        identity = [(r['id'], r.get('sha256', ''), r['filename'], r.get('bytes')) for r in self.records.values()]
        self.identity = hashlib.sha256(json.dumps(identity).encode()).hexdigest()[:20]
        self.allowed = {'index.html', 'styles.css', 'flipbook.js', 'strip-arrangement.js', 'archive-search.js',
                        'archive-search.css', 'film-inspector.js', 'film-inspector.css',
                        'style/film-perforations.svg', 'vendor/page-flip.browser.js'}
        self.allowed.update(r['web_path'] for r in self.records.values())


class Search:
    """Page a stable ranking using the existing engine's model and photo index."""
    def __init__(self, archive, engine_dir=None, index_dir=None):
        self.archive, self.engine = archive, None
        self.rankings = OrderedDict()
        self.lock = threading.Lock()
        self.status, self.message, self.count = 'unavailable', 'Start the search server with --engine-dir.', 0
        self.engine_dir = Path(engine_dir).expanduser().resolve() if engine_dir else None
        self.index_dir = Path(index_dir).expanduser().resolve() if index_dir else self.engine_dir
        if self.engine_dir:
            self.status, self.message = 'loading', 'Warming up local photo search…'
            threading.Thread(target=self.load, daemon=True).start()

    def load(self):
        try:
            import numpy as np
            if not (self.engine_dir / 'photo_search_engine.py').is_file():
                raise ValueError('PhotoSearchEngine is not installed in the configured directory.')
            paths = json.loads((self.index_dir / 'paths.json').read_text())
            vectors = np.load(self.index_dir / 'embeddings.npy', allow_pickle=False)
            if vectors.ndim != 2 or len(paths) != len(vectors) or not np.isfinite(vectors).all():
                raise ValueError('The photo-search index is invalid.')
            keep = [i for i, path in enumerate(paths) if str(Path(path).resolve()) in self.archive.by_source]
            if not keep:
                raise ValueError('This index does not cover the archive. Index its source folder first.')
            cache = self.archive.root / '.search-cache' / self.archive.identity
            cache.mkdir(parents=True, exist_ok=True)
            # Private scoped copy; the existing engine's global index stays unchanged.
            np.save(cache / 'embeddings.npy', vectors[keep], allow_pickle=False)
            (cache / 'paths.json').write_text(json.dumps([str(Path(paths[i]).resolve()) for i in keep]))
            sys.path.insert(0, str(self.engine_dir))
            module = importlib.import_module('photo_search_engine')
            if Path(module.__file__).resolve().parent != self.engine_dir:
                raise ValueError('A different photo-search engine is already imported.')
            os.environ.setdefault('HF_HUB_OFFLINE', '1')
            os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')
            engine = module.PhotoSearchEngine(base_dir=cache)
            engine.load()
            self.engine, self.count = engine, len(keep)
            self.status, self.message = 'ready', 'Local semantic search'
        except Exception as error:
            print(f'Photo search: {error}', file=sys.stderr, flush=True)
            self.status, self.message = 'unavailable', 'Search could not start. Check the engine and index configuration.'

    def rank(self, query):
        import numpy as np
        import torch
        import torch.nn.functional as F
        engine = self.engine
        # The engine's search() API caps count at 200. Reuse its exact text
        # encoding and cached embeddings, without changing that shared engine.
        inputs = engine.processor(text=[query], padding='max_length', max_length=64,
                                  truncation=True, return_tensors='pt').to(engine.device)
        with torch.inference_mode():
            embedding = engine.model.get_text_features(**inputs)
        if hasattr(embedding, 'pooler_output'):
            embedding = embedding.pooler_output
        vector = F.normalize(embedding, dim=-1)[0].cpu().float().numpy()
        with np.errstate(over='ignore', divide='ignore', invalid='ignore'):
            scores = engine.embeddings @ vector
        if not np.isfinite(scores).all():
            raise RuntimeError('Search produced invalid similarity scores.')
        best = {}
        for path, score in zip(engine.paths, scores):
            record = self.archive.by_source.get(str(Path(path).resolve()))
            if record and score >= 0:
                best[record['id']] = max(float(score), best.get(record['id'], -1))
        return sorted(({'id': key, 'score': score} for key, score in best.items()),
                      key=lambda item: (-item['score'], item['id']))

    def query(self, query, offset=0, limit=35):
        if not isinstance(query, str) or not query.strip() or len(query) > 160:
            raise ValueError('Describe a photo in 1–160 characters.')
        if type(offset) is not int or offset < 0 or type(limit) is not int or not 1 <= limit <= 70:
            raise ValueError('Use a nonnegative offset and a limit between 1 and 70.')
        if self.status != 'ready':
            raise RuntimeError(self.message)
        query = query.strip()
        with self.lock:
            if query not in self.rankings:
                self.rankings[query] = self.rank(query)
                if len(self.rankings) > 8:
                    self.rankings.popitem(last=False)
            self.rankings.move_to_end(query)
            matches = self.rankings[query]
            photos = matches[offset:offset + limit]
            end = offset + len(photos)
            return {'photos': photos, 'total': len(matches),
                    'next_offset': end if end < len(matches) else None}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def permitted(self):
        hosts = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
        host = self.headers.get('Host', '')
        return (host in hosts and self.headers.get('Sec-Fetch-Site') != 'cross-site'
                and self.headers.get('Origin', f'http://{host}') == f'http://{host}')

    def send(self, status, body, content_type='application/json; charset=utf-8'):
        if isinstance(body, dict):
            body = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        if not self.permitted():
            self.send(403, {'error': 'Local same-origin access only.'})
            return
        archive, search = self.server.archive, self.server.search
        url = urlsplit(self.path)
        path = unquote(url.path)
        try:
            if path == '/api/status':
                self.send(200, {'status': search.status, 'message': search.message, 'indexed': search.count})
            elif path == '/api/search':
                params = parse_qs(url.query, keep_blank_values=True)
                self.send(200, search.query(params.get('q', [''])[0],
                    offset=int(params.get('offset', ['0'])[0]), limit=int(params.get('limit', ['35'])[0])))
            else:
                relative = 'index.html' if path == '/' else path.lstrip('/')
                file = (archive.root / relative).resolve()
                if relative not in archive.allowed or not file.is_relative_to(archive.root) or not file.is_file():
                    self.send(404, {'error': 'Not found.'})
                    return
                self.send(200, file.read_bytes(), mimetypes.guess_type(str(file))[0] or 'application/octet-stream')
        except (KeyError, FileNotFoundError):
            self.send(404, {'error': 'Photo not found.'})
        except ValueError as error:
            self.send(400, {'error': str(error)})
        except RuntimeError as error:
            self.send(503, {'error': str(error)})
        except Exception as error:
            print(f'Request failed: {error}', file=sys.stderr, flush=True)
            self.send(500, {'error': 'Could not complete this request.'})

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4181)
    parser.add_argument('--engine-dir', default=os.environ.get('PHOTO_SEARCH_ENGINE_DIR'))
    parser.add_argument('--index-dir', default=os.environ.get('PHOTO_SEARCH_INDEX_DIR'))
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    server.archive = Archive()
    server.search = Search(server.archive, args.engine_dir, args.index_dir)
    print(f'Negative Archive → http://127.0.0.1:{args.port}/', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()

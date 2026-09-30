"""Local preview server for dist/ that never lets the browser cache (so edits show on refresh).

    python3 serve.py [port]
"""
import functools
import http.server
import os
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")
handler = functools.partial(NoCache, directory=root)
print(f"Serving {root} at http://localhost:{port}")
http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()

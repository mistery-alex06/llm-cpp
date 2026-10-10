#!/usr/bin/env python3
"""search_server.py — ricerca web locale per Altea (solo libreria standard).

Endpoint: GET http://127.0.0.1:8091/search?q=<testo>[&n=5]  ->  JSON
    [{"title": "...", "url": "...", "snippet": "..."}, ...]

Interroga DuckDuckGo (versione HTML, senza chiavi API). La query lascia il
computer solo quando la ricerca web è attiva nella UI.
"""
import html
import json
import os
import re
import subprocess
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("ALTEA_SEARCH_PORT", "8091"))
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.0 Safari/605.1.15"
)

TITLE_RE = re.compile(r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', re.S)
SNIPPET_RE = re.compile(r'class="result__snippet"[^>]*>(.*?)</a>', re.S)


def clean(s):
    s = re.sub(r"<[^>]+>", "", s or "")
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def real_url(href):
    href = html.unescape(href)
    if href.startswith("//"):
        href = "https:" + href
    q = urllib.parse.urlparse(href)
    if q.netloc.endswith("duckduckgo.com") and q.path.startswith("/l/"):
        target = urllib.parse.parse_qs(q.query).get("uddg", [""])[0]
        if target:
            return urllib.parse.unquote(target)
    return href


def search(query, n=5):
    # curl usa i certificati di sistema (il Python di python.org su macOS non li ha)
    r = subprocess.run(
        [
            "curl", "-s", "-m", "10", "-A", UA,
            "--data-urlencode", f"q={query}",
            "--data-urlencode", "kl=it-it",
            "https://html.duckduckgo.com/html/",
        ],
        capture_output=True,
    )
    if r.returncode != 0:
        raise OSError("curl fallito")
    page = r.stdout.decode("utf-8", "replace")
    out = []
    # un blocco per risultato: parte da ogni link del titolo
    blocks = re.split(r'(?=<a[^>]*class="result__a")', page)[1:]
    for b in blocks:
        t = TITLE_RE.search(b)
        if not t:
            continue
        url = real_url(t.group(1))
        if "duckduckgo.com/y.js" in url or "ad_provider" in url:
            continue  # annunci
        s = SNIPPET_RE.search(b)
        out.append(
            {"title": clean(t.group(2)), "url": url, "snippet": clean(s.group(1)) if s else ""}
        )
        if len(out) >= n:
            break
    return out


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, code, body=b"", ctype="application/json"):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        if url.path == "/health":
            return self._send(200, b"ok", "text/plain")
        if url.path != "/search":
            return self._send(404)
        q = urllib.parse.parse_qs(url.query)
        query = (q.get("q", [""])[0] or "").strip()[:300]
        try:
            n = max(1, min(8, int(q.get("n", ["5"])[0])))
        except ValueError:
            n = 5
        if not query:
            return self._send(400)
        try:
            results = search(query, n)
        except OSError:
            return self._send(502, b"[]")
        self._send(200, json.dumps(results, ensure_ascii=False).encode())


if __name__ == "__main__":
    print(f"Altea ricerca web su http://127.0.0.1:{PORT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()

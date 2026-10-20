#!/usr/bin/env python3
"""search_server.py — ricerca web locale per Banana (solo libreria standard).

Endpoint: GET http://127.0.0.1:8091/search?q=<testo>[&n=5]  ->  JSON
    [{"title": "...", "url": "...", "snippet": "..."}, ...]
          GET http://127.0.0.1:8091/fetch?url=<indirizzo>  ->  JSON
    {"title": "...", "url": "...", "text": "testo leggibile della pagina"}
          (usato per "riassumi <url>"; solo http/https, mai indirizzi locali o privati)

Interroga DuckDuckGo (versione HTML, senza chiavi API). La query lascia il
computer solo quando la ricerca web è attiva nella UI.
"""
import html
import ipaddress
import json
import os
import re
import socket
import subprocess
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("BANANA_SEARCH_PORT", "8091"))
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


DROP_RE = re.compile(
    r"<(script|style|noscript|svg|nav|header|footer|aside|form|iframe|template)\b.*?</\1>|<!--.*?-->",
    re.S | re.I,
)
BLOCK_RE = re.compile(r"</?(p|div|br|li|ul|ol|tr|h[1-6]|section|article|blockquote|pre|table)\b[^>]*>", re.I)
MAIN_RE = re.compile(r"<(article|main)\b[^>]*>(.*?)</\1>", re.S | re.I)
MAX_TEXT = 40000


def check_public(url):
    """Solo http/https verso indirizzi pubblici (niente rete locale)."""
    p = urllib.parse.urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        raise ValueError("indirizzo non valido")
    for info in socket.getaddrinfo(p.hostname, None):
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise ValueError("indirizzo non consentito")


def page_text(raw_html):
    """Estrae titolo e testo leggibile da una pagina HTML."""
    t = re.search(r"<title[^>]*>(.*?)</title>", raw_html, re.S | re.I)
    title = clean(t.group(1)) if t else ""
    body = DROP_RE.sub(" ", raw_html)
    main = max((m.group(2) for m in MAIN_RE.finditer(body)), key=len, default="")
    if len(clean(main)) > 800:
        body = main
    body = BLOCK_RE.sub("\n", body)
    body = re.sub(r"<[^>]+>", "", body)
    body = re.sub(r"\[(\d{1,3}|modifica|senza fonte)\]", "", body)  # note e [modifica] di Wikipedia
    lines = [re.sub(r"[ \t ]+", " ", html.unescape(l)).strip() for l in body.split("\n")]
    lines = [l for l in lines if len(l) >= 25 or (l and len(l) >= 3 and l[0].isupper() and not l.endswith("."))]
    text = "\n".join(lines)
    return title, text[:MAX_TEXT]


def fetch_page(url):
    check_public(url)
    r = subprocess.run(
        [
            "curl", "-sL", "-m", "15", "--max-filesize", "3000000", "--max-redirs", "5",
            "--proto", "=http,https", "--proto-redir", "=http,https",
            "-A", UA, "-w", "\n%{content_type}", url,
        ],
        capture_output=True,
    )
    if r.returncode != 0:
        raise OSError("download fallito")
    data, _, ctype = r.stdout.rpartition(b"\n")
    ctype = ctype.decode("ascii", "ignore").lower()
    if "pdf" in ctype:
        raise ValueError("pdf")
    if ctype and not any(k in ctype for k in ("html", "text", "xml")):
        raise ValueError("tipo di file non supportato")
    m = re.search(rb"charset=[\"']?([\w-]+)", data[:3000] + ctype.encode(), re.I)
    enc = m.group(1).decode() if m else "utf-8"
    try:
        page = data.decode(enc, "replace")
    except LookupError:
        page = data.decode("utf-8", "replace")
    return page_text(page)


def fetch_pdf(url):
    """Scarica un PDF (max 15 MB) da un indirizzo pubblico; il testo lo estrae la UI."""
    check_public(url)
    r = subprocess.run(
        [
            "curl", "-sL", "-m", "30", "--max-filesize", "15000000", "--max-redirs", "5",
            "--proto", "=http,https", "--proto-redir", "=http,https", "-A", UA, url,
        ],
        capture_output=True,
    )
    if r.returncode != 0:
        raise OSError("download fallito")
    if not r.stdout.startswith(b"%PDF"):
        raise ValueError("non è un PDF")
    return r.stdout


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
        q = urllib.parse.parse_qs(url.query)
        if url.path == "/fetch":
            target = (q.get("url", [""])[0] or "").strip()[:2000]
            try:
                title, text = fetch_page(target)
            except ValueError as e:
                return self._send(400, json.dumps({"error": str(e)}).encode())
            except OSError as e:
                return self._send(502, json.dumps({"error": str(e)}).encode())
            if len(text) < 200:
                return self._send(422, json.dumps({"error": "poco testo leggibile"}).encode())
            body = {"title": title, "url": target, "text": text}
            return self._send(200, json.dumps(body, ensure_ascii=False).encode())
        if url.path == "/pdf":
            target = (q.get("url", [""])[0] or "").strip()[:2000]
            try:
                data = fetch_pdf(target)
            except ValueError as e:
                return self._send(400, json.dumps({"error": str(e)}).encode())
            except OSError as e:
                return self._send(502, json.dumps({"error": str(e)}).encode())
            return self._send(200, data, "application/pdf")
        if url.path != "/search":
            return self._send(404)
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
    print(f"Banana ricerca web su http://127.0.0.1:{PORT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()

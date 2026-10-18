#!/usr/bin/env python3
"""Archivio locale di Banana: salva memoria, progetti e documenti in ~/Banana/data/.

Servizio solo locale (127.0.0.1:8092), usato dalla UI per non perdere i dati
se si cancellano i dati del browser.
  GET /store/<nome>   -> contenuto salvato (404 se assente)
  PUT /store/<nome>   -> salva il JSON ricevuto
  GET /health
Nomi ammessi: memory, projects, docs. Percorso modificabile con BANANA_DATA.
"""
import json
import os
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8092
DATA_DIR = os.path.expanduser(os.environ.get("BANANA_DATA", "~/Banana/data"))
NAMES = {"memory", "projects", "docs"}
MAX_BODY = 100 * 1024 * 1024
ALLOWED_ORIGINS = {
    "http://127.0.0.1:8080",
    "http://localhost:8080",
}

os.makedirs(DATA_DIR, exist_ok=True)


def sh(cmd):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=3).stdout
    except Exception:
        return ""


def system_stats():
    """RAM del modello, swap e memoria libera (macOS)."""
    llama_kb = 0
    for line in sh(["ps", "-axo", "rss=,comm="]).splitlines():
        parts = line.strip().split(None, 1)
        if len(parts) == 2 and parts[1].endswith("llama-server"):
            llama_kb += int(parts[0])
    swap = 0.0
    out = sh(["sysctl", "-n", "vm.swapusage"])  # total = 3072.00M  used = 1797.75M ...
    if "used" in out:
        try:
            swap = float(out.split("used =")[1].split("M")[0])
        except ValueError:
            pass
    page = 4096
    free_pages = 0
    for line in sh(["vm_stat"]).splitlines():
        if "page size of" in line:
            page = int(line.split("page size of")[1].split()[0])
        elif line.startswith(("Pages free", "Pages inactive", "Pages speculative")):
            free_pages += int(line.split(":")[1].strip().rstrip("."))
    total = int(sh(["sysctl", "-n", "hw.memsize"]).strip() or 0)
    return {
        "llamaMB": llama_kb / 1024,
        "swapUsedMB": swap,
        "freeMB": free_pages * page / 1048576,
        "memTotalMB": total / 1048576,
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _origin_ok(self):
        origin = self.headers.get("Origin")
        return origin is None or origin in ALLOWED_ORIGINS

    def _send(self, code, body=b"", ctype="application/json"):
        self.send_response(code)
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _name(self):
        parts = self.path.split("?")[0].strip("/").split("/")
        if len(parts) == 2 and parts[0] == "store" and parts[1] in NAMES:
            return parts[1]
        return None

    def do_OPTIONS(self):
        self._send(204 if self._origin_ok() else 403)

    def do_GET(self):
        if self.path.split("?")[0] == "/health":
            return self._send(200, b'{"ok":true}')
        if not self._origin_ok():
            return self._send(403)
        if self.path.split("?")[0] == "/stats":
            return self._send(200, json.dumps(system_stats()).encode())
        name = self._name()
        if not name:
            return self._send(404)
        path = os.path.join(DATA_DIR, name + ".json")
        if not os.path.exists(path):
            return self._send(404)
        with open(path, "rb") as f:
            self._send(200, f.read())

    def do_PUT(self):
        if not self._origin_ok():
            return self._send(403)
        name = self._name()
        if not name:
            return self._send(404)
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self._send(413)
        raw = self.rfile.read(length)
        try:
            json.loads(raw)
        except ValueError:
            return self._send(400)
        fd, tmp = tempfile.mkstemp(dir=DATA_DIR, suffix=".tmp")
        with os.fdopen(fd, "wb") as f:
            f.write(raw)
        os.replace(tmp, os.path.join(DATA_DIR, name + ".json"))
        self._send(200, b'{"ok":true}')


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()

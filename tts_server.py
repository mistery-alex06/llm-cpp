#!/usr/bin/env python3
"""tts_server.py — sintesi vocale locale per Altea (solo macOS).

Usa il comando `say` con le voci di sistema, comprese quelle Premium/Enhanced
(le stesse della "Voce di sistema" e molto più naturali di quelle esposte da Chrome).
Endpoint: GET http://127.0.0.1:8090/tts?text=...[&voice=Nome]  ->  audio WAV
Variabile d'ambiente ALTEA_VOICE per forzare una voce (es. "Federica (Premium)").
"""
import os
import re
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("ALTEA_TTS_PORT", "8090"))
FEMALE = ["federica", "emma", "paola", "alice", "elsa", "silvia", "carla"]


def italian_voices():
    out = subprocess.run(["say", "-v", "?"], capture_output=True, text=True).stdout
    voices = []
    for line in out.splitlines():
        m = re.match(r"^(.+?)\s{2,}it[_-]IT\b", line)
        if m:
            voices.append(m.group(1).strip())
    return voices


def quality(name):
    n = name.lower()
    return 2 if "premium" in n else 1 if ("enhanced" in n or "migliorata" in n) else 0


def pick_voice():
    forced = os.environ.get("ALTEA_VOICE")
    if forced:
        return forced
    voices = italian_voices()
    for fem in FEMALE:
        matches = sorted((v for v in voices if fem in v.lower()), key=quality, reverse=True)
        if matches:
            return matches[0]
    return voices[0] if voices else None


VOICE = pick_voice()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")

    def do_GET(self):
        url = urlparse(self.path)
        q = parse_qs(url.query)
        if url.path == "/health":
            self.send_response(200)
            self._cors()
            self.end_headers()
            self.wfile.write(("ok " + str(VOICE)).encode())
            return
        if url.path != "/tts":
            self.send_response(404)
            self.end_headers()
            return
        text = (q.get("text", [""])[0] or "").strip()[:1000]
        if not text:
            self.send_response(400)
            self.end_headers()
            return
        voice = q.get("voice", [VOICE])[0] or VOICE
        with tempfile.TemporaryDirectory() as d:
            wav = os.path.join(d, "a.wav")
            cmd = ["say", "-o", wav, "--file-format=WAVE", "--data-format=LEI16@22050"]
            if voice:
                cmd += ["-v", voice]
            cmd += ["-f", "-"]
            r = subprocess.run(cmd, input=text, text=True, capture_output=True)
            if r.returncode != 0 or not os.path.exists(wav):
                self.send_response(500)
                self._cors()
                self.end_headers()
                return
            data = open(wav, "rb").read()
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    print(f"Altea TTS su http://127.0.0.1:{PORT} - voce: {VOICE}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()

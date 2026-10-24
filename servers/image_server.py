#!/usr/bin/env python3
"""Immagini di Banana: servizio locale (127.0.0.1:8094) che usa stable-diffusion.cpp (solo CPU).

Modelli (installati da scripts/setup_images.sh in ~/Banana/image, o in $BANANA_IMAGE_DIR):
  sd-turbo : SD-Turbo, veloce (4 passaggi)
  sd15     : Stable Diffusion 1.5, più curato (20 passaggi), molto più lento

  GET  /health          -> {"ok": true, "modelli": {"sd-turbo": true, "sd15": false}}
  POST /generate        {"prompt": "...", "modello": "sd-turbo"}  -> {"id": "..."}
  GET  /job/<id>        -> {"stato", "passo", "passi", "file", "prompt_en", "errore"}
  GET  /image/<nome>.png

Un lavoro alla volta. Prima di disegnare il prompt viene tradotto in inglese con il modello di
testo piccolo (se Banana è attiva) e i modelli di testo vengono scaricati dalla RAM (8 GB non
bastano per entrambi): ricaricano da soli alla prossima domanda. Nessuna shell: il testo
dell'utente viaggia solo come argomento di sd-cli.
"""

import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8094
BASE = os.path.realpath(os.path.expanduser(os.environ.get("BANANA_IMAGE_DIR", "~/Banana/image")))
BIN = os.path.join(BASE, "bin", "sd-cli")
MODELS_DIR = os.path.join(BASE, "models")
OUT_DIR = os.path.join(BASE, "out")
LLAMA = os.environ.get("BANANA_LLAMA_URL", "http://127.0.0.1:8080")
ALLOWED_ORIGINS = {"http://127.0.0.1:8080", "http://localhost:8080"}
MAX_PROMPT = 500
MAX_KEEP = 200  # immagini conservate in out/
JOB_TTL = 3600
MAX_BODY = 8 * 1024

# nome -> (file, passaggi, cfg, prompt negativo, decodifica rapida con TAESD)
# TAESD (taesd.safetensors, 9 MB) decodifica in pochi secondi invece di ~2 minuti sulla CPU, con qualità
# un po' più bassa: lo usa solo SD-Turbo, dove conta la velocità; SD 1.5 usa il decodificatore completo.
MODELS = {
    "sd-turbo": ("sd-turbo.gguf", 4, 1.0, "", True),
    "sd15": ("sd15.gguf", 20, 7.0, "blurry, low quality, deformed, disfigured, extra limbs, watermark, text", False),
}
TAESD = os.path.join(MODELS_DIR, "taesd.safetensors")

TRANSLATE_SYSTEM = (
    "Traduci in inglese la richiesta dell'utente come prompt breve e descrittivo per un generatore "
    "di immagini (soggetto, ambiente, stile, luce). Rispondi solo con il prompt in inglese, senza virgolette."
)
JOBS = {}
JOBS_LOCK = threading.Lock()
RUN_LOCK = threading.Lock()  # un solo disegno alla volta
# Solo la barra dei passaggi ("2/4 - 20.1s/it"), non quella di caricamento dei pesi ("262/686 - 32MB/s")
PROGRESS_RE = re.compile(rb"(\d+)/(\d+)\s*-\s*[\d.]+\s*(?:s/it|it/s)")

os.makedirs(OUT_DIR, exist_ok=True)


def installed():
    return {k: os.path.isfile(os.path.join(MODELS_DIR, v[0])) for k, v in MODELS.items()}


def http_json(method, path, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(LLAMA + path, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read() or b"{}")


def model_entries():
    d = http_json("GET", "/models", timeout=5)
    return d.get("data") or d.get("models") or []


def translate(prompt):
    """Prompt in inglese tramite il modello piccolo di Banana; in caso di errore resta l'originale."""
    try:
        entries = model_entries()
        names = [m.get("id") or m.get("model") or m.get("name") for m in entries]
        names = [n for n in names if n and "omni" not in n.lower()]
        pick = next((n for n in names if "1.7b" in n.lower()), names[0] if names else None)
        if not pick:
            return prompt
        r = http_json(
            "POST",
            "/v1/chat/completions",
            {
                "model": pick,
                "stream": False,
                "max_tokens": 120,
                "temperature": 0.2,
                "messages": [{"role": "system", "content": TRANSLATE_SYSTEM}, {"role": "user", "content": prompt}],
            },
            timeout=120,
        )
        text = r["choices"][0]["message"]["content"]
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip().strip('"').strip()
        return text[:MAX_PROMPT] if text else prompt
    except Exception:  # noqa: BLE001 - la traduzione è un di più
        return prompt


def free_ram():
    """Scarica dalla RAM i modelli di testo (router di llama-server), se è attivo."""
    try:
        loaded = [
            m.get("id") or m.get("model") or m.get("name")
            for m in model_entries()
            if str((m.get("status") or {}).get("value", m.get("status"))).lower() == "loaded"
        ]
        for name in loaded:
            try:
                http_json("POST", "/models/unload", {"model": name}, timeout=20)
            except Exception:  # noqa: BLE001
                pass
        for _ in range(30):
            time.sleep(1)
            still = [
                m for m in model_entries()
                if str((m.get("status") or {}).get("value", m.get("status"))).lower() in ("loaded", "unloading")
            ]
            if not still:
                break
    except Exception:  # noqa: BLE001 - Banana spenta: niente da scaricare
        pass


def set_job(jid, **kw):
    with JOBS_LOCK:
        if jid in JOBS:
            JOBS[jid].update(kw)


def cleanup():
    now = time.time()
    with JOBS_LOCK:
        for k in [k for k, j in JOBS.items() if now - j["t"] > JOB_TTL and j["stato"] in ("pronto", "errore")]:
            del JOBS[k]
    files = sorted(
        (os.path.join(OUT_DIR, f) for f in os.listdir(OUT_DIR) if f.endswith(".png")), key=os.path.getmtime
    )
    for f in files[:-MAX_KEEP]:
        try:
            os.remove(f)
        except OSError:
            pass


def run_job(jid, prompt, model):
    file_name, steps, cfg, negative, fast_vae = MODELS[model]
    with RUN_LOCK:
        try:
            set_job(jid, stato="traduzione")
            prompt_en = translate(prompt)
            set_job(jid, prompt_en=prompt_en, stato="scarico")
            free_ram()
            out_name = uuid.uuid4().hex[:12] + ".png"
            out = os.path.join(OUT_DIR, out_name)
            cmd = [
                BIN, "-m", os.path.join(MODELS_DIR, file_name), "-p", prompt_en,
                "-o", out, "-W", "512", "-H", "512", "--steps", str(steps),
                "--cfg-scale", str(cfg), "--sampling-method", "euler_a", "-t", "4", "-s", "-1",
            ]
            if negative:
                cmd += ["-n", negative]
            if fast_vae and os.path.isfile(TAESD):
                cmd += ["--taesd", TAESD]
            set_job(jid, stato="caricamento", passo=0, passi=steps)
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            tail = b""
            while True:
                chunk = proc.stdout.read(128)
                if not chunk:
                    break
                tail = (tail + chunk)[-400:]
                m = None
                for m in PROGRESS_RE.finditer(tail):
                    pass
                if m:
                    set_job(jid, stato="disegno", passo=min(int(m.group(1)), int(m.group(2))), passi=int(m.group(2)))
            if proc.wait() != 0 or not os.path.isfile(out):
                raise RuntimeError("generazione non riuscita: " + tail.decode("utf-8", "replace")[-160:].strip())
            set_job(jid, stato="pronto", file=out_name, passo=steps)
            cleanup()
        except Exception as e:  # noqa: BLE001
            set_job(jid, stato="errore", errore=str(e)[:300])


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _cors(self):
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204 if self.headers.get("Origin") in ALLOWED_ORIGINS else 403)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/health":
            ready = os.path.isfile(BIN)
            mods = {k: (v and ready) for k, v in installed().items()}
            return self._json(200, {"ok": True, "modelli": mods})
        m = re.fullmatch(r"/job/([0-9a-f]{12})", path)
        if m:
            with JOBS_LOCK:
                job = JOBS.get(m.group(1))
                job = dict(job) if job else None
            if not job:
                return self._json(404, {"errore": "lavoro non trovato"})
            job.pop("t", None)
            return self._json(200, job)
        m = re.fullmatch(r"/image/([0-9a-f]{12}\.png)", path)
        if m:
            p = os.path.join(OUT_DIR, m.group(1))
            if not os.path.isfile(p):
                return self._json(404, {"errore": "immagine non trovata"})
            with open(p, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "max-age=31536000, immutable")
            self.end_headers()
            self.wfile.write(data)
            return
        self._json(404, {"errore": "non trovato"})

    def do_POST(self):
        if self.headers.get("Origin") not in ALLOWED_ORIGINS or self.path.split("?")[0] != "/generate":
            return self._json(403, {"errore": "origine non ammessa"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self._json(413, {"errore": "richiesta troppo grande"})
        try:
            req = json.loads(self.rfile.read(length))
            prompt = " ".join(str(req.get("prompt") or "").split())[:MAX_PROMPT]
            model = str(req.get("modello") or "sd-turbo")
        except ValueError:
            return self._json(400, {"errore": "JSON non valido"})
        if not prompt:
            return self._json(400, {"errore": "descrizione vuota"})
        if model not in MODELS:
            return self._json(400, {"errore": "modello sconosciuto"})
        if not os.path.isfile(BIN) or not installed()[model]:
            return self._json(409, {"errore": "modello non installato: esegui scripts/setup_images.sh"})
        with JOBS_LOCK:
            if sum(1 for j in JOBS.values() if j["stato"] not in ("pronto", "errore")) >= 3:
                return self._json(429, {"errore": "troppi disegni in coda"})
            jid = uuid.uuid4().hex[:12]
            JOBS[jid] = {"stato": "coda", "passo": 0, "passi": MODELS[model][1], "file": "", "prompt_en": "", "errore": "", "t": time.time()}
        threading.Thread(target=run_job, args=(jid, prompt, model), daemon=True).start()
        self._json(200, {"id": jid})


if __name__ == "__main__":
    print(f"Banana immagini su http://127.0.0.1:{PORT} (dati in {BASE})", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()

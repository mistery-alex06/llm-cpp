#!/usr/bin/env python3
"""Azioni di Banana sul computer: elenco chiuso di operazioni, tutte eseguite SOLO dopo
la conferma dell'utente nella UI. Servizio locale (127.0.0.1:8093).

Nessuna shell, nessun comando libero. File: solo dentro la cartella di lavoro
~/Banana/workspace (modificabile con BANANA_WORKSPACE).

  POST /action  {"azione": "...", ...}  ->  {"ok": true, "risultato": "..."} | {"ok": false, "errore": "..."}
  GET  /health

Azioni: elenca_file, leggi_file, scrivi_file, apri_file, apri_url.
Promemoria e timer (comandi diretti dell'utente, non del modello): promemoria_aggiungi,
promemoria_elenca, promemoria_annulla. Salvati in ~/Banana/data/reminders.json: sopravvivono
al riavvio. Alla scadenza: notifica di sistema + suono + voce.
"""
import json
import os
import subprocess
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8093
WORKSPACE = os.path.realpath(os.path.expanduser(os.environ.get("BANANA_WORKSPACE", "~/Banana/workspace")))
ALLOWED_ORIGINS = {"http://127.0.0.1:8080", "http://localhost:8080"}
MAX_READ = 20000
MAX_WRITE = 200 * 1024
MAX_BODY = 400 * 1024
# Estensioni apribili con l'app predefinita (niente eseguibili/script)
OPEN_EXT = {".md", ".txt", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".csv", ".json", ".html", ".docx", ".xlsx", ".pptx"}

os.makedirs(WORKSPACE, exist_ok=True)

# --- Promemoria e timer -------------------------------------------------------------------
DATA_DIR = os.path.expanduser(os.environ.get("BANANA_DATA", "~/Banana/data"))
REM_FILE = os.path.join(DATA_DIR, "reminders.json")
MAX_REMINDERS = 50
MAX_REM_TEXT = 200
REM_LOCK = threading.Lock()
REMINDERS = []  # [{"id", "t" (epoch s), "testo"}]


def rem_load():
    try:
        with open(REM_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [
            {"id": str(r["id"]), "t": float(r["t"]), "testo": str(r.get("testo", ""))[:MAX_REM_TEXT]}
            for r in data
            if isinstance(r, dict) and "id" in r and "t" in r
        ][:MAX_REMINDERS]
    except (OSError, ValueError, TypeError):
        return []


def rem_save():
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = REM_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(REMINDERS, f, ensure_ascii=False)
    os.replace(tmp, REM_FILE)


def rem_notify(msg):
    """Notifica di sistema + suono + voce. Il testo viaggia come argomento, mai dentro un comando."""
    try:
        if sys.platform == "darwin":
            subprocess.run(
                [
                    "osascript", "-e", "on run argv",
                    "-e", 'display notification (item 1 of argv) with title "Banana" subtitle "Promemoria" sound name "Glass"',
                    "-e", "end run", msg,
                ],
                check=False, timeout=15,
            )
            if subprocess.run(["say", "-v", "Alice", msg], check=False, timeout=60, capture_output=True).returncode != 0:
                subprocess.run(["say", msg], check=False, timeout=60)
        elif sys.platform.startswith("win"):
            subprocess.run(
                [
                    "powershell", "-NoProfile", "-Command",
                    "Add-Type -AssemblyName System.Windows.Forms; "
                    "[System.Windows.Forms.MessageBox]::Show($env:BANANA_MSG, 'Banana')",
                ],
                check=False, timeout=3600, env={**os.environ, "BANANA_MSG": msg},
            )
        else:
            subprocess.run(["notify-send", "Banana", msg], check=False, timeout=15)
    except (OSError, subprocess.SubprocessError):
        pass


def rem_scheduler():
    while True:
        now = time.time()
        with REM_LOCK:
            due = [r for r in REMINDERS if r["t"] <= now]
            if due:
                REMINDERS[:] = [r for r in REMINDERS if r["t"] > now]
                try:
                    rem_save()
                except OSError:
                    pass
        for r in due:
            late = now - r["t"] > 90
            msg = r["testo"] or "Il timer è scaduto"
            if late:
                msg += " (in ritardo: Banana era spenta)"
            threading.Thread(target=rem_notify, args=(msg,), daemon=True).start()
        time.sleep(1)


def rem_act(a, req):
    if a == "promemoria_elenca":
        with REM_LOCK:
            return json.dumps(sorted(REMINDERS, key=lambda r: r["t"]), ensure_ascii=False)
    if a == "promemoria_aggiungi":
        try:
            t = float(req.get("quando"))
        except (TypeError, ValueError):
            raise ActionError("orario non valido")
        now = time.time()
        if not (now - 60 < t < now + 366 * 86400):
            raise ActionError("orario fuori intervallo (da ora a un anno)")
        testo = str(req.get("testo") or "").strip()[:MAX_REM_TEXT]
        with REM_LOCK:
            if len(REMINDERS) >= MAX_REMINDERS:
                raise ActionError("troppi promemoria attivi (max 50)")
            r = {"id": uuid.uuid4().hex[:8], "t": t, "testo": testo}
            REMINDERS.append(r)
            rem_save()
        return json.dumps(r, ensure_ascii=False)
    # promemoria_annulla: un id, oppure "tutti"
    rid = str(req.get("id") or "")
    with REM_LOCK:
        before = len(REMINDERS)
        REMINDERS[:] = [] if rid == "tutti" else [r for r in REMINDERS if r["id"] != rid]
        rem_save()
        return str(before - len(REMINDERS))



class ActionError(Exception):
    pass


def safe_path(rel, must_exist=False):
    rel = (rel or "").strip()
    if not rel or "\x00" in rel:
        raise ActionError("percorso mancante")
    p = os.path.realpath(os.path.join(WORKSPACE, rel))
    if p != WORKSPACE and not p.startswith(WORKSPACE + os.sep):
        raise ActionError("percorso fuori dalla cartella di lavoro")
    if must_exist and not os.path.exists(p):
        raise ActionError("file non trovato")
    return p


def open_with_system(target):
    if sys.platform == "darwin":
        subprocess.run(["open", target], check=False, timeout=10)
    elif sys.platform.startswith("win"):
        os.startfile(target)  # noqa: S606 (target validato prima)
    else:
        subprocess.run(["xdg-open", target], check=False, timeout=10)


def act(req):
    a = req.get("azione")
    if a == "elenca_file":
        base = safe_path(req.get("percorso") or ".") if req.get("percorso") not in (None, "", ".") else WORKSPACE
        if not os.path.isdir(base):
            raise ActionError("cartella non trovata")
        out = []
        for name in sorted(os.listdir(base))[:200]:
            full = os.path.join(base, name)
            out.append(name + ("/" if os.path.isdir(full) else f" ({os.path.getsize(full)} byte)"))
        return "\n".join(out) or "(cartella vuota)"
    if a == "leggi_file":
        p = safe_path(req.get("percorso"), True)
        if not os.path.isfile(p) or os.path.getsize(p) > 1024 * 1024:
            raise ActionError("non è un file di testo leggibile (max 1 MB)")
        with open(p, "r", encoding="utf-8", errors="replace") as f:
            text = f.read(MAX_READ + 1)
        return text[:MAX_READ] + ("\n[...troncato]" if len(text) > MAX_READ else "")
    if a == "scrivi_file":
        p = safe_path(req.get("percorso"))
        content = req.get("contenuto")
        if not isinstance(content, str) or len(content.encode()) > MAX_WRITE:
            raise ActionError("contenuto mancante o troppo grande (max 200 KB)")
        if os.path.isdir(p):
            raise ActionError("il percorso è una cartella")
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)
        return f"scritto {os.path.relpath(p, WORKSPACE)} ({len(content)} caratteri)"
    if a == "apri_file":
        p = safe_path(req.get("percorso"), True)
        if os.path.splitext(p)[1].lower() not in OPEN_EXT:
            raise ActionError("tipo di file non apribile")
        open_with_system(p)
        return f"aperto {os.path.relpath(p, WORKSPACE)}"
    if a == "apri_url":
        url = (req.get("url") or "").strip()
        if not (url.startswith("https://") or url.startswith("http://")) or " " in url:
            raise ActionError("solo indirizzi http/https")
        open_with_system(url)
        return f"aperto {url}"
    if a in ("promemoria_aggiungi", "promemoria_elenca", "promemoria_annulla"):
        return rem_act(a, req)
    raise ActionError("azione non consentita")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, code, obj=None):
        body = json.dumps(obj if obj is not None else {}).encode()
        self.send_response(code)
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204 if self.headers.get("Origin") in ALLOWED_ORIGINS else 403)

    def do_GET(self):
        if self.path.split("?")[0] == "/health":
            return self._send(200, {"ok": True, "cartella": WORKSPACE})
        self._send(404)

    def do_POST(self):
        # Solo dalla UI di Banana: l'Origin deve essere presente e ammesso
        if self.headers.get("Origin") not in ALLOWED_ORIGINS or self.path.split("?")[0] != "/action":
            return self._send(403, {"ok": False, "errore": "origine non ammessa"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self._send(413, {"ok": False, "errore": "richiesta troppo grande"})
        try:
            req = json.loads(self.rfile.read(length))
            if not isinstance(req, dict):
                raise ValueError
        except ValueError:
            return self._send(400, {"ok": False, "errore": "JSON non valido"})
        try:
            self._send(200, {"ok": True, "risultato": act(req)})
        except ActionError as e:
            self._send(200, {"ok": False, "errore": str(e)})
        except Exception as e:  # noqa: BLE001
            self._send(200, {"ok": False, "errore": f"errore: {e}"})


if __name__ == "__main__":
    REMINDERS[:] = rem_load()
    threading.Thread(target=rem_scheduler, daemon=True).start()
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()

#!/bin/bash
# banana_linux.sh — avvio di Banana su Linux con un solo comando.
#   Avvia il server (se non è già attivo), apre Banana nel browser e, quando
#   premi Ctrl+C o chiudi il terminale, spegne il server che ha avviato.
# Uso: bash scripts/banana_linux.sh        (oppure dall'icona creata da install_linux.sh)

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL="${BANANA_URL:-http://127.0.0.1:8080}"
LOG="${TMPDIR:-/tmp}/banana.log"
SERVER_PID=""

stop_server() {
	if [ -n "$SERVER_PID" ]; then
		pkill -P "$SERVER_PID" 2>/dev/null
		kill "$SERVER_PID" 2>/dev/null
	fi
}
trap 'stop_server; exit 0' TERM INT HUP

up() { curl -s -m 2 "$URL/health" >/dev/null 2>&1; }

open_browser() {
	# Finestra dedicata (senza barra degli indirizzi) se c'è un browser Chromium, altrimenti quello predefinito
	for b in google-chrome google-chrome-stable chromium chromium-browser brave-browser microsoft-edge; do
		if command -v "$b" >/dev/null 2>&1; then
			"$b" --app="$URL" >/dev/null 2>&1 &
			return
		fi
	done
	if command -v xdg-open >/dev/null 2>&1; then
		xdg-open "$URL" >/dev/null 2>&1 &
	else
		echo "Apri $URL nel browser."
	fi
}

for cmd in curl python3; do
	command -v "$cmd" >/dev/null 2>&1 || { echo "Errore: manca '$cmd' (installalo con il gestore di pacchetti)."; exit 1; }
done

if up; then
	echo "Banana è già in esecuzione."
else
	echo "Avvio il server… (log: $LOG)"
	bash "$DIR/run_qwen_server.sh" >"$LOG" 2>&1 &
	SERVER_PID=$!
	for _ in $(seq 1 90); do
		up && break
		kill -0 "$SERVER_PID" 2>/dev/null || { echo "Il server si è fermato: vedi $LOG"; exit 1; }
		sleep 1
	done
	up || { echo "Il server non risponde: vedi $LOG"; stop_server; exit 1; }
fi

open_browser
echo "Banana su $URL"

if [ -n "$SERVER_PID" ]; then
	echo "Ctrl+C per fermare il server."
	wait "$SERVER_PID"
fi

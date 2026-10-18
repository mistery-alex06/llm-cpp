#!/bin/bash
# banana_launcher.sh — avvia il server, apre Banana in una finestra dedicata di Chrome
# e, quando la finestra viene chiusa, spegne il server. Usato da Banana.app (make_app.sh).

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="http://127.0.0.1:8080"
LOG="/tmp/banana.log"
STARTED=0

stop_server() {
    if [ "$STARTED" = "1" ]; then
        pkill -f "llama.cpp/build/bin/llama-server" 2>/dev/null
    fi
}
trap 'stop_server; exit 0' TERM INT HUP

server_up() { curl -s -m 2 -o /dev/null "$URL/health"; }

if ! server_up; then
    cd "$DIR" && nohup bash run_qwen_server.sh >"$LOG" 2>&1 &
    STARTED=1
    for _ in $(seq 1 60); do server_up && break; sleep 1; done
fi

if ! server_up; then
    osascript -e 'display alert "Banana" message "Il server non è partito. Controlla /tmp/banana.log"'
    stop_server
    exit 1
fi

# Finestra dedicata (stesso profilo Chrome: chat e memoria restano le stesse)
open -na "Google Chrome" --args --app="$URL"

count_windows() {
    osascript -e 'tell application "Google Chrome" to count (windows whose URL of active tab contains "127.0.0.1:8080")' 2>/dev/null || echo "-1"
}

# Aspetta che compaia la finestra
for _ in $(seq 1 30); do
    [ "$(count_windows)" -gt 0 ] 2>/dev/null && break
    sleep 1
done

# Resta in attesa finché esiste almeno una finestra di Banana
while true; do
    [ "$(count_windows)" = "0" ] && break
    sleep 3
done

stop_server

#!/bin/bash
# run_qwen_server.sh — avvia llama-server con Qwen3-4B, esponendo:
#   - Web UI pronta su http://localhost:8080
#   - API OpenAI-compatible su http://localhost:8080/v1/chat/completions
#
# Uso:
#   ./run_qwen_server.sh            → porta 8080 di default
#   ./run_qwen_server.sh --port 9090

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL="$DIR/Qwen3-4B-Q4_K_M.gguf"
BIN="$DIR/llama.cpp/build/bin/llama-server"

if [ ! -f "$MODEL" ]; then
    echo "Errore: modello non trovato in $MODEL"
    exit 1
fi

if [ ! -x "$BIN" ]; then
    echo "Errore: binario llama-server non trovato/compilato in $BIN"
    exit 1
fi

# -ngl 0     : CPU only (evita contese GPU/Metal su questo Mac Intel/8GB RAM)
# -c 4096    : contesto (spazio per i risultati della ricerca web; 2048 se la RAM scarseggia)
# -t 4       : usa tutti e 4 i core disponibili
# --reasoning off : thinking disattivato di default (risposte molto più rapide)
# --host 127.0.0.1 --port 8080 : accessibile solo in locale
echo "Avvio server su http://127.0.0.1:8080 (Ctrl+C per fermare)"

# Ricerca web locale (pulsante "Web" nella UI), nessuna chiave API
if [ -f "$DIR/search_server.py" ]; then
    python3 "$DIR/search_server.py" >/tmp/altea-search.log 2>&1 &
    SEARCH_PID=$!
    trap 'kill $SEARCH_PID 2>/dev/null' EXIT
fi
"$BIN" --models-dir "$DIR" --models-max 1 -ngl 0 -c 4096 -t 4 --reasoning off --reasoning-budget 0 --no-mmproj-offload --host 127.0.0.1 --port 8080 "$@"

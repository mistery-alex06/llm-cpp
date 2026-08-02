#!/bin/bash
# run_qwen.sh — avvia una chat interattiva con Qwen3-4B via llama.cpp
#
# Uso:
#   ./run_qwen.sh                → chat interattiva
#   ./run_qwen.sh -p "prompt"    → singola risposta e uscita

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL="$DIR/Qwen3-4B-Q4_K_M.gguf"
BIN="$DIR/llama.cpp/build/bin/llama-cli"

if [ ! -f "$MODEL" ]; then
    echo "Errore: modello non trovato in $MODEL"
    exit 1
fi

if [ ! -x "$BIN" ]; then
    echo "Errore: binario llama-cli non trovato/compilato in $BIN"
    exit 1
fi

# -ngl 0     : CPU only (niente Metal, evita problemi di contesa GPU su questo Mac Intel/8GB RAM)
# -c 2048    : contesto ridotto per limitare l'uso di RAM
# -t 4       : usa tutti e 4 i core disponibili
"$BIN" -m "$MODEL" -ngl 0 -c 2048 -t 4 "$@"

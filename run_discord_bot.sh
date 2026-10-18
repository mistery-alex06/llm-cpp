#!/bin/bash
# run_discord_bot.sh — avvia il bot Discord di Banana (serve llama-server già avviato).
# Configurazione in ~/Banana/discord.json (vedi README, sezione "Banana su Discord").
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$DIR/discord_bot.py" "$@"

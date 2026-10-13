#!/bin/bash
# run_discord_bot.sh — avvia il bot Discord di Altea (serve llama-server già avviato).
# Configurazione in ~/Altea/discord.json (vedi README, sezione "Altea su Discord").
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$DIR/discord_bot.py" "$@"

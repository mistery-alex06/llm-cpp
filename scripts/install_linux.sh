#!/bin/bash
# install_linux.sh — aggiunge Banana al menu delle applicazioni (file .desktop).
# Uso: bash scripts/install_linux.sh            installa
#      bash scripts/install_linux.sh --remove   rimuove
# Rieseguilo solo se sposti la cartella llm.

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
FILE="$APPS/banana.desktop"

if [ "$1" = "--remove" ]; then
	rm -f "$FILE"
	echo "Rimosso: $FILE"
	exit 0
fi

mkdir -p "$APPS"
cat > "$FILE" <<EOF
[Desktop Entry]
Type=Application
Name=Banana
Comment=IA locale in italiano
Exec=bash "$DIR/scripts/banana_linux.sh"
Icon=$DIR/assets/logo-512.png
Terminal=true
Categories=Utility;
EOF
chmod +x "$FILE"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" 2>/dev/null
echo "Creato: $FILE (cerca \"Banana\" nel menu delle applicazioni)"

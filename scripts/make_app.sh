#!/bin/bash
# make_app.sh — genera ~/Desktop/Banana.app (avvio con un clic).
#   Doppio clic su Banana.app: avvia il server, apre Banana in una finestra
#   dedicata e, alla chiusura della finestra, spegne il server.
# Uso: bash scripts/make_app.sh   (da rieseguire solo se sposti la cartella llm)
# La prima volta macOS chiede i permessi per la cartella Desktop e per
# controllare Google Chrome: vanno accettati.

set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$HOME/Desktop/Banana.app"
TMP="$(mktemp -d)"

rm -rf "$APP"

# --- Applet (necessario perché macOS conceda i permessi alla app) ---
cat > "$TMP/banana.applescript" <<'AS'
on run
	set appPath to POSIX path of (path to me)
	do shell script "bash " & quoted form of (appPath & "Contents/Resources/launcher.sh") & " >/tmp/banana-launcher.log 2>&1"
end run
AS
osacompile -o "$APP" "$TMP/banana.applescript"

# --- Launcher (eseguito dall'applet) ---
cat > "$APP/Contents/Resources/launcher.sh" <<'LAUNCHER'
#!/bin/bash
DIR="__DIR__"
URL="http://127.0.0.1:8080"
LOG="/tmp/banana.log"
STARTED=0

stop_server() {
	if [ "$STARTED" = "1" ]; then pkill -x llama-server 2>/dev/null; fi
}
trap 'stop_server; exit 0' TERM INT HUP

if ! curl -s -m 2 "$URL/health" >/dev/null 2>&1; then
	STARTED=1
	nohup bash "$DIR/run_qwen_server.sh" >"$LOG" 2>&1 &
	for _ in $(seq 1 60); do
		curl -s -m 2 "$URL/health" >/dev/null 2>&1 && break
		sleep 1
	done
fi

open -na "Google Chrome" --args --app="$URL"

# Finestre di Banana aperte in Chrome (-1 = non determinabile)
count_windows() {
	osascript -e 'tell application "Google Chrome"
		set n to 0
		repeat with w in windows
			try
				if (URL of active tab of w) starts with "http://127.0.0.1:8080" then set n to n + 1
			end try
		end repeat
		return n
	end tell' 2>/dev/null || echo -1
}

# Attende che la finestra compaia
seen=0
for _ in $(seq 1 30); do
	c=$(count_windows)
	if [ "$c" -gt 0 ] 2>/dev/null; then seen=1; break; fi
	sleep 1
done

# Finché la finestra resta aperta
if [ "$seen" = "1" ]; then
	gone=0
	while [ "$gone" -lt 2 ]; do
		sleep 3
		c=$(count_windows)
		if [ "$c" = "-1" ]; then break; fi   # permesso negato: non spegnere nulla
		if [ "$c" = "0" ]; then gone=$((gone+1)); else gone=0; fi
	done
	[ "$gone" -ge 2 ] && stop_server
fi
exit 0
LAUNCHER
sed -i '' "s|__DIR__|$DIR|" "$APP/Contents/Resources/launcher.sh"

# --- Icona (ritaglio quadrato da assets/sfondo_AI.jpg) ---
if [ -f "$DIR/assets/sfondo_AI.jpg" ]; then
	sips -s format png -c 1440 1440 "$DIR/assets/sfondo_AI.jpg" --out "$TMP/sq.png" >/dev/null
	ICONSET="$TMP/Banana.iconset"; mkdir "$ICONSET"
	for s in 16 32 128 256 512; do
		sips -z $s $s "$TMP/sq.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
		d=$((s*2))
		sips -z $d $d "$TMP/sq.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
	done
	iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/applet.icns"
fi
rm -rf "$TMP"

/usr/libexec/PlistBuddy -c "Set :CFBundleName Banana" "$APP/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :NSAppleEventsUsageDescription string 'Banana controlla quando chiudi la sua finestra per spegnere il server.'" "$APP/Contents/Info.plist" 2>/dev/null || true
touch "$APP"
echo "Creata: $APP"

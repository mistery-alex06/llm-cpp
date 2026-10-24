#!/bin/bash
# setup_images.sh — installa la generazione di immagini di Banana (una sola volta).
#   - compila stable-diffusion.cpp (solo CPU)
#   - scarica due modelli quantizzati (GGUF, ~3,8 GB in tutto) e un decodificatore leggero (9 MB):
#       sd-turbo : SD-Turbo, veloce (1-4 passaggi)   — licenza Stability AI (uso non commerciale)
#       sd15     : Stable Diffusion 1.5, più curato  — licenza CreativeML OpenRAIL-M
# Tutto finisce in ~/Banana/image (o in $BANANA_IMAGE_DIR). Riesegui lo script per riprendere un
# download interrotto o per aggiornare. Servono git, cmake e un compilatore C++ (Xcode CLT su macOS).
# Uso: bash scripts/setup_images.sh

set -e
BASE="${BANANA_IMAGE_DIR:-$HOME/Banana/image}"
SRC="$BASE/src"
BIN="$BASE/bin"
MODELS="$BASE/models"
mkdir -p "$BIN" "$MODELS" "$BASE/out"

# 1. Programma
if [ ! -x "$BIN/sd-cli" ]; then
	[ -d "$SRC/.git" ] || git clone --depth 1 --recursive https://github.com/leejet/stable-diffusion.cpp "$SRC"
	# Solo CPU: Metal va in timeout sulla GPU integrata dei Mac Intel (ggml lo attiva da solo su macOS)
	cmake -S "$SRC" -B "$SRC/build-cpu" -DCMAKE_BUILD_TYPE=Release -DSD_METAL=OFF -DGGML_METAL=OFF
	cmake --build "$SRC/build-cpu" --config Release -j"$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)"
	for n in sd-cli sd; do
		if [ -x "$SRC/build-cpu/bin/$n" ]; then cp "$SRC/build-cpu/bin/$n" "$BIN/sd-cli"; break; fi
	done
	[ -x "$BIN/sd-cli" ] || { echo "Errore: programma non trovato dopo la compilazione."; exit 1; }
fi

# 2. Modelli (download riprendibile)
fetch() { # nome file, indirizzo
	[ -s "$MODELS/$1" ] && return 0
	echo "Scarico $1…"
	curl -fL -C - --retry 3 -o "$MODELS/$1.part" "$2"
	mv "$MODELS/$1.part" "$MODELS/$1"
}
fetch sd-turbo.gguf "https://huggingface.co/Green-Sky/SD-Turbo-GGUF/resolve/main/sd_turbo-f16-q8_0.gguf"
fetch sd15.gguf "https://huggingface.co/second-state/stable-diffusion-v1-5-GGUF/resolve/main/stable-diffusion-v1-5-pruned-emaonly-Q8_0.gguf"

# Decodificatore leggero (9 MB): SD-Turbo passa da ~5 a ~2 minuti per immagine
fetch taesd.safetensors "https://huggingface.co/madebyollin/taesd/resolve/main/diffusion_pytorch_model.safetensors"

echo "Pronto: $BIN/sd-cli e i modelli in $MODELS"

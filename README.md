# Altea (llm-cpp)

IA locale in C++ che gira interamente sul tuo computer: chat da terminale e interfaccia web, basate su [llama.cpp](https://github.com/ggml-org/llama.cpp) e modelli Qwen3 in formato GGUF.

Sviluppata e testata su Mac Intel, 8 GB di RAM, solo CPU.

## Indice

1. [Cosa fa](#cosa-fa)
2. [Come funziona](#come-funziona)
3. [Requisiti](#requisiti)
4. [Installazione](#installazione)
5. [Avvio](#avvio)
6. [Scelta del modello](#scelta-del-modello)
7. [Prestazioni su poca RAM](#prestazioni-su-poca-ram)
8. [Struttura della cartella](#struttura-della-cartella)
9. [Roadmap](#roadmap)

## Cosa fa

- Risponde alle domande in locale: nessun dato lascia il computer e non serve internet (dopo il download dei modelli).
- Due modi d'uso:
  - **Interfaccia web** su `http://127.0.0.1:8080`, con cronologia delle conversazioni, impostazioni, selettore modello e tema personalizzato blu-oro.
  - **Chat da terminale**, con il programma `./llm` oppure con `run_qwen.sh`.
- Supporta il ragionamento di Qwen3 (blocchi `<think>`). Scrivendo `/no_think` all'inizio del messaggio il modello risponde senza ragionare, molto più in fretta.
- Tre modelli selezionabili dalla UI: Qwen3-4B (più capace, più lento), Qwen3-1.7B (più veloce) e Qwen2.5-Omni-3B (multimodale: accetta immagini e audio; scaricalo da huggingface.co/ggml-org/Qwen2.5-Omni-3B-GGUF, file Q4_K_M + mmproj Q8_0, in una cartella `Qwen2.5-Omni-3B/`).
- Memoria automatica: Altea estrae da sola i fatti personali duraturi dai tuoi messaggi e li ricorda nelle chat successive. Comandi manuali opzionali: `/ricorda <testo>`, `/memoria`, `/dimentica <n|tutto>`. Salvata nel browser.

## Come funziona

```
main.cpp  ──────────────►  libllama / libggml  ◄──── llama-server ◄──── browser
(chat da terminale)         (motore llama.cpp)       (API + Web UI)      127.0.0.1:8080
                                   │
                                   ▼
                          modelli .gguf (Qwen3)
```

- **`main.cpp`**: programma C++ che si collega direttamente alle librerie `libllama` e `libggml`. Carica il modello, applica il chat template, genera le risposte token per token e le mostra in streaming.
- **`llama.cpp/`**: copia completa del progetto llama.cpp inclusa nella repo. Fornisce il motore di inferenza e `llama-server`.
- **`llama-server`**: server locale con API compatibile OpenAI (`/v1/chat/completions`) e interfaccia web incorporata. Parte in *router mode*: legge tutti i `.gguf` presenti nella cartella e carica il modello scelto quando serve. Ne tiene in memoria uno alla volta.
- **Interfaccia web**: la UI di llama.cpp (SvelteKit, in `llama.cpp/tools/ui/`) con tema personalizzato in `src/app.css` e sfondo `static/bg-ship.jpg`. I file della UI vengono incorporati nel binario `llama-server` in fase di compilazione.
- **`src/` e `include/`**: tokenizer, matrici e transformer scritti da zero (progetto iniziale). Non vengono più usati per l'inferenza.
- **`web/index.html`**: prima pagina web sperimentale, non usata dal server attuale.

## Requisiti

| Strumento | Uso |
|---|---|
| macOS (testato su Intel) | piattaforma di sviluppo |
| Compilatore C++17 (`g++`/`clang++`) | compilare `main.cpp` |
| CMake | compilare llama.cpp |
| Node.js e npm | compilare la UI web |
| ~2,5 GB di spazio per il modello 4B (~1,1 GB per l'1.7B) | pesi dei modelli |

## Installazione

Tutti i comandi si eseguono dalla cartella principale `llm/`.

**1. Compila llama.cpp** (motore, server e UI web):

```bash
cd llama.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release -DLLAMA_BUILD_UI=ON
cmake --build build --config Release -j4
cd ..
```

**2. Scarica i modelli** e mettili nella cartella `llm/` (non sono inclusi nella repo, per il limite di 100 MB di GitHub):

- [Qwen3-4B-Q4_K_M.gguf](https://huggingface.co/unsloth/Qwen3-4B-GGUF/tree/main)
- [Qwen3-1.7B-Q4_K_M.gguf](https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/tree/main)

**3. (Facoltativo) Compila la chat da terminale `./llm`:**

```bash
g++ -std=c++17 -O2 main.cpp -I llama.cpp/include -I llama.cpp/ggml/include \
    -L llama.cpp/build/bin -lllama -lggml \
    -Wl,-rpath,@executable_path/llama.cpp/build/bin -o llm
```

## Avvio

| Cosa vuoi fare | Comando |
|---|---|
| Avviare l'interfaccia web | `./run_qwen_server.sh` poi apri `http://127.0.0.1:8080` |
| Usare un'altra porta | `./run_qwen_server.sh --port 9090` |
| Chat da terminale (programma C++) | `./llm` |
| Chat da terminale con un modello specifico | `./llm /percorso/modello.gguf` |
| Chat da terminale (llama-cli) | `./run_qwen.sh` |
| Singola risposta e uscita | `./run_qwen.sh -p "Ciao, chi sei?" -n 60 -st` |
| Fermare il server | `Ctrl+C` nel terminale, oppure `pkill -f llama-server` |

`./llm` cerca `Qwen3-4B-Q4_K_M.gguf` nella cartella corrente e in quelle superiori. `run_qwen.sh` usa sempre il 4B.

### Ricompilare la UI dopo averla modificata

```bash
cd llama.cpp/tools/ui && npm install && npm run build
cd ../../build && cmake --build . --target llama-server -j4
```

Poi riavvia il server. Se la pagina non cambia, svuota la cache del browser (le risorse hanno cache lunga e c'è un service worker).

## Scelta del modello

Nell'interfaccia web il modello attivo è l'etichetta accanto al pulsante di invio, nel riquadro dei messaggi: cliccandola scegli tra i modelli presenti in `llm/`. Qualsiasi `.gguf` aggiunto alla cartella compare nella lista. Il cambio richiede qualche secondo di caricamento.

| Modello | Velocità indicativa su questo Mac | Quando usarlo |
|---|---|---|
| Qwen3-1.7B | ~15 token/s | domande veloci, compiti semplici |
| Qwen3-4B | ~2-5 token/s | ragionamento e compiti complessi |

## Prestazioni su poca RAM

Il server parte con `-ngl 0 -c 2048 -t 4`: solo CPU, contesto di 2048 token, 4 thread. È una configurazione prudente per evitare lo swap su un Mac da 8 GB.

- Chiudi le applicazioni pesanti (browser, IDE) prima di avviare.
- Per risposte più rapide, usa il modello 1.7B e/o `/no_think` all'inizio del messaggio.

## Struttura della cartella

```
llm/
├── main.cpp                chat da terminale collegata a libllama
├── run_qwen_server.sh      avvia llama-server (UI web, router mode)
├── run_qwen.sh             avvia llama-cli (chat da terminale)
├── llama.cpp/              llama.cpp completo (motore, server, UI web)
├── src/, include/          tokenizer, matrici, transformer custom (storico)
├── web/index.html          prima pagina web sperimentale (non usata)
├── Qwen3-*.gguf            modelli (non tracciati da git)
└── sfondo_AI.jpg           immagine originale dello sfondo della UI
```

## Roadmap

- [x] Tokenizer, matrici, forward pass e Softmax custom
- [x] CLI interattiva
- [x] Setup llama.cpp con Qwen3-4B (`run_qwen.sh`)
- [x] Interfaccia web (llama-server e Web UI, `run_qwen_server.sh`)
- [x] Personalizzazione della UI (tema blu-oro, contorni, sfondo dedicato)
- [x] Integrazione nativa con llama.cpp in `main.cpp`
- [x] Secondo modello e selettore nella UI (router mode)
- [x] Memoria persistente (`/ricorda`, `/dimentica`, `/memoria` nella UI)

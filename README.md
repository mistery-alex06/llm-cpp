# Altea (llm-cpp)

Altea è un'IA locale in C++ che gira interamente sul tuo computer: chat da terminale e interfaccia web, basate su [llama.cpp](https://github.com/ggml-org/llama.cpp) e modelli Qwen in formato GGUF.

Sviluppata e testata su Mac Intel, 8 GB di RAM, solo CPU.

## Indice

1. [Cosa fa](#cosa-fa)
2. [Come funziona](#come-funziona)
3. [Requisiti](#requisiti)
4. [Installazione](#installazione)
5. [Avvio](#avvio)
6. [Uso di Altea](#uso-di-altea)
7. [Scelta del modello](#scelta-del-modello)
8. [Prestazioni su poca RAM](#prestazioni-su-poca-ram)
9. [Personalizzare Altea](#personalizzare-altea)
10. [Struttura della cartella](#struttura-della-cartella)
11. [Roadmap](#roadmap)

## Cosa fa

- Risponde alle domande in locale: nessun dato lascia il computer e non serve internet (dopo il download dei modelli).
- Parla **italiano** e si esprime **al femminile** (è "Altea").
- **Tre modelli** selezionabili dalla UI: Qwen3-4B (più capace), Qwen3-1.7B (più veloce) e Qwen2.5-Omni-3B (multimodale).
- **Immagini e audio** in ingresso con Qwen2.5-Omni-3B.
- **Memoria persistente**: ricorda da sola i fatti personali duraturi che le dici e li usa nelle chat successive.
- **Lettura ad alta voce** delle risposte con un pulsante.
- **Ragionamento** attivabile dal menu per tutti i modelli (spento di default per risposte più rapide).
- **Avvio con un clic** su macOS: `Altea.app`.
- Due modi d'uso:
  - **Interfaccia web** su `http://127.0.0.1:8080`, con cronologia delle conversazioni, impostazioni, selettore modello e tema personalizzato blu-oro.
  - **Chat da terminale**, con il programma `./llm` oppure con `run_qwen.sh`.

## Come funziona

```
main.cpp  ──────────────►  libllama / libggml  ◄──── llama-server ◄──── browser / Altea.app
(chat da terminale)         (motore llama.cpp)       (API + Web UI)      127.0.0.1:8080
                                   │
                                   ▼
                    modelli .gguf (Qwen3, Qwen2.5-Omni)
```

- **`main.cpp`**: programma C++ che si collega direttamente alle librerie `libllama` e `libggml`. Carica il modello, applica il chat template, genera le risposte token per token e le mostra in streaming.
- **`llama.cpp/`**: copia completa del progetto llama.cpp inclusa nella repo. Fornisce il motore di inferenza e `llama-server`.
- **`llama-server`**: server locale con API compatibile OpenAI (`/v1/chat/completions`) e interfaccia web incorporata. Parte in *router mode*: legge tutti i `.gguf` presenti nella cartella (e nelle sottocartelle con modello + `mmproj`) e carica il modello scelto quando serve. Ne tiene in memoria uno alla volta.
- **Interfaccia web**: la UI di llama.cpp (SvelteKit, in `llama.cpp/tools/ui/`), personalizzata: tema in `src/app.css`, sfondo `static/bg-ship.jpg`, testi in italiano, nome Altea. I file della UI vengono incorporati nel binario `llama-server` in fase di compilazione.
- **Memoria** (`llama.cpp/tools/ui/src/lib/utils/altea-memory.ts`): i fatti sono salvati nel `localStorage` del browser e aggiunti al system prompt di ogni richiesta, insieme all'identità di Altea (italiano, femminile). Dopo ogni risposta, se il messaggio sembra contenere informazioni personali, il modello stesso estrae i fatti duraturi da salvare.
- **`tts_server.py`**: servizio locale (`127.0.0.1:8090`) che trasforma il testo in audio con le voci di macOS; avviato e fermato insieme al server.
- **`Altea.app`**: generata da `make_app.sh`. Avvia il server, apre una finestra Chrome dedicata e spegne il server quando la finestra viene chiusa.
- **`src/` e `include/`**: tokenizer, matrici e transformer scritti da zero (progetto iniziale). Non vengono più usati per l'inferenza.
- **`web/index.html`**: prima pagina web sperimentale, non usata dal server attuale.

## Requisiti

| Strumento | Uso |
|---|---|
| macOS (testato su Intel) | piattaforma di sviluppo |
| Compilatore C++17 (`g++`/`clang++`) | compilare `main.cpp` |
| CMake | compilare llama.cpp |
| Node.js e npm | compilare la UI web |
| Google Chrome | finestra di `Altea.app` (il resto funziona con qualsiasi browser) |
| ~2,5 GB per il 4B, ~1,1 GB per l'1.7B, ~3,6 GB per Omni-3B | pesi dei modelli |

## Installazione

Tutti i comandi si eseguono dalla cartella principale `llm/`.

**1. Compila llama.cpp** (motore, server e UI web):

```bash
cd llama.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release -DLLAMA_BUILD_UI=ON
cmake --build build --config Release -j4
cd ..
```

**2. Scarica i modelli.** Non sono inclusi nella repo (limite di 100 MB di GitHub, e sono esclusi da `.gitignore`).

| Modello | Download | Dove metterlo |
|---|---|---|
| Qwen3-4B | [Qwen3-4B-Q4_K_M.gguf](https://huggingface.co/unsloth/Qwen3-4B-GGUF/tree/main) | `llm/Qwen3-4B-Q4_K_M.gguf` |
| Qwen3-1.7B | [Qwen3-1.7B-Q4_K_M.gguf](https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/tree/main) | `llm/Qwen3-1.7B-Q4_K_M.gguf` |
| Qwen2.5-Omni-3B (multimodale) | [ggml-org/Qwen2.5-Omni-3B-GGUF](https://huggingface.co/ggml-org/Qwen2.5-Omni-3B-GGUF/tree/main): servono **due** file, `Qwen2.5-Omni-3B-Q4_K_M.gguf` e `mmproj-Qwen2.5-Omni-3B-Q8_0.gguf` | entrambi nella cartella `llm/Qwen2.5-Omni-3B/` |

Il file `mmproj` è la parte che interpreta immagini e audio: senza di esso Omni accetta solo testo.

**3. (Facoltativo) Compila la chat da terminale `./llm`:**

```bash
g++ -std=c++17 -O2 main.cpp -I llama.cpp/include -I llama.cpp/ggml/include \
    -L llama.cpp/build/bin -lllama -lggml \
    -Wl,-rpath,@executable_path/llama.cpp/build/bin -o llm
```

**4. (Facoltativo, macOS) Crea l'app con un clic:**

```bash
bash make_app.sh
```

## Avvio

| Cosa vuoi fare | Comando |
|---|---|
| **Avvio con un clic (macOS)** | doppio clic su `Altea.app` (sul Desktop, creata da `make_app.sh`) |
| Avviare l'interfaccia web | `./run_qwen_server.sh` poi apri `http://127.0.0.1:8080` |
| Avviare con il ragionamento sempre attivo | `./run_qwen_server.sh --reasoning on` |
| Usare un'altra porta | `./run_qwen_server.sh --port 9090` |
| Chat da terminale (programma C++) | `./llm` |
| Chat da terminale con un modello specifico | `./llm /percorso/modello.gguf` |
| Chat da terminale (llama-cli) | `./run_qwen.sh` |
| Singola risposta e uscita | `./run_qwen.sh -p "Ciao, chi sei?" -n 60 -st` |
| Fermare il server | `Ctrl+C` nel terminale, oppure `pkill -x llama-server` |

`./llm` cerca `Qwen3-4B-Q4_K_M.gguf` nella cartella corrente e in quelle superiori. `run_qwen.sh` usa sempre il 4B.

### Altea.app

- Doppio clic: avvia il server se non è già attivo, aspetta che risponda e apre Altea in una finestra senza barra del browser.
- Chiudendo la finestra il server si spegne dopo pochi secondi e libera la RAM. Se il server era già stato avviato a mano, non viene spento.
- Usa il tuo profilo Chrome, quindi chat e memoria sono le stesse del browser.
- **Prima apertura:** macOS chiede il permesso per la cartella Desktop e per controllare Google Chrome. Vanno accettati; se neghi il secondo, il server non si spegne più da solo.
- Se sposti la cartella `llm/`, rigenera l'app con `bash make_app.sh`.

### Ricompilare la UI dopo averla modificata

```bash
cd llama.cpp/tools/ui && npm install && npm run build
cd ../../build && cmake --build . --target llama-server -j4
```

Poi riavvia il server. Se la pagina non cambia, svuota la cache del browser (le risorse hanno cache lunga e c'è un service worker).

## Uso di Altea

### Memoria

Altea ricorda da sola le informazioni personali che le dici (nome, studi, lavoro, preferenze...). Ogni messaggio che sembra contenere dati personali provoca una breve chiamata aggiuntiva al modello, in background, per estrarre i fatti.

| Comando | Effetto |
|---|---|
| `/ricorda <testo>` | salva un fatto a mano |
| `/memoria` | elenca i fatti salvati |
| `/dimentica <n>` | cancella il fatto numero *n* |
| `/dimentica tutto` | svuota la memoria |

La memoria è salvata nel browser (`localStorage`): cancellando i dati del sito o cambiando browser si perde. Contiene al massimo 50 voci. Un modello piccolo può estrarre fatti imprecisi: controlla con `/memoria` e correggi con `/dimentica`.

### Ragionamento

- Spento di default (`--reasoning off`), per risposte molto più rapide.
- Si attiva dal menu **+** → *Ragionamento*, con tutti e tre i modelli.
- Su Qwen3 è il ragionamento nativo, mostrato in un riquadro separato (`<think>`).
- Su Qwen2.5-Omni, che non lo supporta nativamente, viene chiesto ad Altea nel prompt di ragionare passo per passo: il ragionamento compare nel testo della risposta.
- `/no_think` all'inizio del messaggio forza la risposta immediata sui Qwen3.

### Lettura ad alta voce

Quando una risposta è completa, sotto il messaggio compare un pulsante **microfono**: premilo per far leggere la risposta ad Altea, premilo di nuovo (ora è un quadrato) per interrompere. Markdown, codice e link non vengono letti.

- **Come funziona:** `run_qwen_server.sh` avvia insieme al server un piccolo servizio locale, `tts_server.py` (porta `8090`), che usa il comando `say` di macOS. Così Altea parla con le voci di sistema **Premium/Enhanced**, molto più naturali di quelle esposte da Chrome. Si spegne insieme al server. Se non è raggiungibile, la UI ripiega sulla sintesi vocale del browser (più robotica).
- **Voce:** sceglie da sola una voce italiana femminile (Federica, Emma, Paola, Alice...) nella qualità migliore installata. Per forzarne una: `ALTEA_VOICE="Emma (Premium)" ./run_qwen_server.sh`. L'elenco si vede con `say -v '?' | grep it_IT`.
- **Più voci:** da Impostazioni di Sistema > Accessibilità > Contenuto letto > Voce di sistema > Gestisci voci, scarica le versioni *Premium* o *Enhanced* italiane.
- **Siri:** le voci di Siri non sono utilizzabili dalle app; le voci Premium usano la stessa tecnologia e sono la scelta più vicina.

### Immagini e audio

Seleziona **Qwen2.5-Omni-3B** nel selettore del modello, poi usa **+** → *Aggiungi file*. Con gli altri modelli il caricamento di immagini e audio è disattivato. Il video non è stato testato.

## Scelta del modello

Nell'interfaccia web il modello attivo è l'etichetta accanto al pulsante di invio, nel riquadro dei messaggi: cliccandola scegli tra i modelli presenti in `llm/`. Qualsiasi `.gguf` aggiunto alla cartella compare nella lista. Il cambio richiede qualche secondo di caricamento.

| Modello | Velocità indicativa su questo Mac | Quando usarlo |
|---|---|---|
| Qwen3-1.7B | ~15 token/s | domande veloci, compiti semplici |
| Qwen3-4B | ~2-5 token/s | ragionamento e compiti complessi |
| Qwen2.5-Omni-3B | più lento dell'1.7B; primo caricamento ~1 min | immagini e audio |

## Prestazioni su poca RAM

Il server parte con questi parametri (in `run_qwen_server.sh`):

| Parametro | Significato |
|---|---|
| `--models-dir . --models-max 1` | router mode, un solo modello in RAM alla volta |
| `-ngl 0` | solo CPU (evita contese con la GPU su Mac Intel/8 GB) |
| `-c 2048` | contesto di 2048 token |
| `-t 4` | 4 thread |
| `--reasoning off --reasoning-budget 0` | niente ragionamento di default |
| `--no-mmproj-offload` | il file di visione/audio resta sulla CPU (altrimenti Omni non si carica: cerca 4,3 GB sulla GPU) |

Consigli:

- Chiudi le applicazioni pesanti (browser, IDE) prima di avviare.
- Per risposte più rapide usa il modello 1.7B e lascia il ragionamento spento.
- Se il contesto da 2048 token si riempie (conversazioni lunghe, immagini), apri una nuova chat.

## Personalizzare Altea

| Cosa | Dove |
|---|---|
| Identità, lingua e genere di Altea | costante `PERSONA` in `llama.cpp/tools/ui/src/lib/utils/altea-memory.ts` |
| Logica della memoria | stesso file e `llama.cpp/tools/ui/src/lib/stores/chat.svelte.ts` |
| Saluto iniziale | `llama.cpp/tools/ui/src/lib/components/app/chat/ChatScreen/ChatScreenGreeting.svelte` |
| Nome dell'app | `llama.cpp/tools/ui/src/lib/constants/app.ts` |
| Tema, colori, sfondo | `llama.cpp/tools/ui/src/app.css` e `static/bg-ship.jpg` |
| Parametri del server | `run_qwen_server.sh` |

Dopo ogni modifica alla UI serve [ricompilare](#ricompilare-la-ui-dopo-averla-modificata) e riavviare il server. Nel `app.css`, per lo sfondo: non aggiungere `position: relative` a `aside` e `[data-slot='input-area']`, altrimenti l'immagine finisce sopra i contenuti.

## Struttura della cartella

```
llm/
├── main.cpp                chat da terminale collegata a libllama
├── run_qwen_server.sh      avvia llama-server (UI web, router mode)
├── run_qwen.sh             avvia llama-cli (chat da terminale)
├── make_app.sh             genera Altea.app sul Desktop
├── tts_server.py           sintesi vocale locale (macOS, comando say) per il pulsante microfono
├── llama.cpp/              llama.cpp completo (motore, server, UI web)
├── src/, include/          tokenizer, matrici, transformer custom (storico)
├── web/index.html          prima pagina web sperimentale (non usata)
├── Qwen3-*.gguf            modelli Qwen3 (non tracciati da git)
├── Qwen2.5-Omni-3B/        modello multimodale + mmproj (non tracciato da git)
└── sfondo_AI.jpg           immagine originale dello sfondo e dell'icona
```

## Roadmap

### Completato

- [x] Tokenizer, matrici, forward pass e Softmax custom
- [x] CLI interattiva
- [x] Setup llama.cpp con Qwen3-4B (`run_qwen.sh`)
- [x] Interfaccia web (llama-server e Web UI, `run_qwen_server.sh`)
- [x] Personalizzazione della UI (tema blu-oro, contorni, sfondo dedicato)
- [x] Integrazione nativa con llama.cpp in `main.cpp`
- [x] Secondo modello e selettore nella UI (router mode)
- [x] Memoria persistente, manuale e automatica
- [x] App con un clic (`Altea.app`, `make_app.sh`)
- [x] Identità di Altea: risposte in italiano, al femminile; UI principale tradotta
- [x] Ragionamento spento di default, attivabile dal menu per tutti i modelli
- [x] Modello multimodale Qwen2.5-Omni-3B (immagini e audio)

### Prossimi obiettivi

| Priorità | Obiettivo | Note |
|---|---|---|
| **In corso (prossima)** | **Voce** | 1) pulsante microfono sotto ogni risposta per farla leggere ad alta voce (text-to-speech); 2) dettatura dei messaggi (speech-to-text) |
| Alta | Scelta automatica del modello | domande semplici al 1.7B, complesse al 4B |
| Alta | Documenti locali (RAG) | rispondere su PDF e appunti, con citazione della fonte |
| Alta | Ricerca web | Altea cerca online e cita le fonti (tool/MCP) |
| Media | Memoria su file | non legata al browser, condivisa tra browser e backup |
| Media | Esporta/importa | chat e memoria in un file di backup |
| Media | Traduzione completa della UI | Impostazioni e messaggi d'errore inclusi |
| Media | Analisi video | estrazione di fotogrammi da dare a Omni |
| Bassa | Azioni sul computer | comandi con conferma esplicita dell'utente |
| Bassa | Personalizzazione del modello | fine-tuning leggero (LoRA) su stile e conoscenze |
| Bassa | Benchmark e quantizzazioni | confronto velocità/qualità per ottimizzare su 8 GB di RAM |
| Bassa | Launcher per Windows/Linux | equivalente di `Altea.app` |

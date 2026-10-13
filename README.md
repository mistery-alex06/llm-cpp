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

- Risponde alle domande in locale: nessun dato lascia il computer e non serve internet (dopo il download dei modelli). Solo se attivi il pulsante *Web*, la tua domanda viene inviata a DuckDuckGo per la ricerca.
- Parla **italiano** e si esprime **al femminile** (è "Altea").
- **Tre modelli** selezionabili dalla UI: Qwen3-4B (più capace), Qwen3-1.7B (più veloce) e Qwen2.5-Omni-3B (multimodale).
- **Immagini e audio** in ingresso con Qwen2.5-Omni-3B.
- **Documenti locali (RAG)**: carichi PDF e file di testo e Altea risponde citando file e pagina (pulsante *Doc*).
- **Ricerca web** opzionale (pulsante *Web*): cerca online e risponde citando le fonti, senza chiavi API.
- **Memoria persistente**: ricorda da sola i fatti personali duraturi che le dici e li usa nelle chat successive.
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
- **`search_server.py`**: servizio locale (`127.0.0.1:8091`) che interroga DuckDuckGo (HTML, via `curl`) e restituisce i primi risultati; avviato e fermato insieme al server.
- **`store_server.py`**: servizio locale (`127.0.0.1:8092`) che salva memoria, progetti e documenti anche in `~/Altea/data/` (`memory.json`, `projects.json`, `docs.json`); avviato e fermato insieme al server, accetta solo richieste dalla UI locale.
- **Documenti (RAG)** (`llama.cpp/tools/ui/src/lib/utils/altea-docs.svelte.ts`): i file caricati vengono spezzati in estratti da ~700 caratteri e salvati nel browser (IndexedDB). A ogni domanda una ricerca BM25 per parole chiave, senza modelli di embedding, sceglie gli estratti più pertinenti, che vengono aggiunti al prompt.
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
| **Avvio con un clic (Windows)** | doppio clic su `Altea.bat` (serve llama.cpp compilato, vedi sotto) |
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

### Altea su Windows

- Compila llama.cpp con CMake (Visual Studio Build Tools) con gli stessi comandi di sopra; `llama-server.exe` finisce in `llama.cpp\build\bin\Release\`.
- Python 3 (comando `py` o `python`) serve per ricerca web e archivio su file; senza, Altea parte lo stesso ma senza quelle funzioni. La ricerca usa `curl.exe`, incluso in Windows 10/11.
- **`Altea.bat`**: avvia il server, apre Altea in una finestra senza barra (Edge, oppure Chrome) e spegne il server alla chiusura. Usa il profilo del browser, quindi chat e memoria restano le stesse.
- `run_qwen_server.ps1`: solo il server (`powershell -ExecutionPolicy Bypass -File run_qwen_server.ps1`).
- Non testato su Windows (sviluppato su Mac). Se la chiusura della finestra non viene rilevata, il launcher chiede di premere Invio per spegnere il server. Le statistiche RAM/swap nella barra superiore sono pensate per macOS e su Windows possono risultare vuote.

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

### Ricerca web

Il pulsante **Web**, accanto al **+** nel riquadro dei messaggi, attiva la ricerca (si illumina quando è attiva e il suo stato viene ricordato).

- Con la ricerca attiva, ogni domanda viene prima cercata su DuckDuckGo; i primi 5 risultati (titolo, estratto, indirizzo) e la data di oggi vengono passati ad Altea, che risponde citando le fonti con [1], [2] e un elenco finale «Fonti».
- Serve la connessione a internet. Se la ricerca non riesce, Altea lo dice e risponde con ciò che sa.
- Non usa il tool-calling dei modelli (inaffidabile sui modelli piccoli): la ricerca la fa sempre la UI, quindi funziona con tutti e tre i modelli.
- Ogni ricerca aggiunge circa 500 token di contesto alla domanda; per questo il contesto è di 4096 token. I risultati valgono solo per la domanda corrente.
- Altea può sbagliare a interpretare i risultati: controlla le fonti per informazioni importanti.
- I comandi che iniziano con `/` non attivano la ricerca.

### Documenti locali (RAG)

Il pulsante **Doc**, accanto a **Web**, apre la libreria dei documenti.

- **Aggiungi documento**: PDF e file di testo (`.txt`, `.md`, `.csv`, codice...). Il testo viene estratto e diviso in estratti; resta nel browser (IndexedDB) e non viene inviato a nessuno.
- Ogni domanda cerca gli estratti più pertinenti (fino a 4, ~2600 caratteri) e li passa ad Altea, che risponde citando file e pagina, es. *(manuale.pdf, p. 3)*. Se la risposta non è nei documenti, lo dice.
- L'interruttore *Usa i documenti nelle risposte* li attiva o disattiva senza cancellarli; il cestino rimuove un documento.
- La ricerca è per parole chiave: funziona meglio se la domanda usa le stesse parole del testo. Le scansioni (PDF di sole immagini) non hanno testo e non vengono lette.
- Compatibile con la ricerca web: se sono attivi entrambi, Altea riceve estratti dei documenti e risultati web.
- Sono documenti nel browser: cancellando i dati del sito si perdono.

### Ricerca nelle chat passate

Il pulsante **Storico** (accanto ad *Auto*) fa cercare ad Altea anche nelle tue altre conversazioni. A ogni domanda, una ricerca per parole chiave (BM25, tutto in locale) sceglie fino a 3 messaggi pertinenti di altre chat e li passa ad Altea, che li usa solo se servono e cita il titolo della chat.

- Cerca in tutte le chat tranne quella corrente (un estratto per chat); se non c'è nulla di pertinente non aggiunge niente.
- L'indice si costruisce al primo uso e si aggiorna ogni ~45 secondi; con molte chat il primo avvio può richiedere un attimo.
- Funziona meglio se la domanda usa le stesse parole della conversazione cercata. Disattivato di default.
- Compatibile con Web e Doc: se sono attivi insieme, Altea riceve tutte le fonti.

### Appunti da lezione

Nella finestra **Doc**, il cappello accanto a ogni documento apre lo studio:

| Passo | Cosa fa |
|---|---|
| **Da pagina** | sceglie da dove iniziare; Altea prende circa 3000 caratteri (qualche pagina) alla volta |
| **Riassunto** | punti elenco con concetti e formule principali |
| **Flashcard** | 8 coppie domanda/risposta (`D:` / `R:`) |
| **Quiz** | 5 domande a risposta multipla con risposta corretta e spiegazione |

Il testo dell'estratto viene inserito direttamente nel messaggio (senza ricerca per parole chiave), quindi la risposta si basa solo su quella parte: per continuare imposta la pagina successiva. Con **Auto** attivo la richiesta va al Qwen3-4B, più accurato del 1.7B.

### Barra superiore

Sopra la chat, tra le due barre laterali (solo su schermo largo):

| Elemento | Cosa fa |
|---|---|
| **Ruolo** | Altea, Tutor Polimi, Revisore di codice, Traduttore, Ultra-sintetico: aggiunge un'istruzione al prompt di sistema, vale per tutte le chat |
| **Comandi rapidi** | *Riassumi, Traduci, Spiega, Correggi, Quiz*: inseriscono un modello di richiesta nel messaggio |
| **Stato** | modello caricato, velocità dell'ultima risposta (token/s), RAM del modello, swap e memoria libera, indicatori di Web e Archivio |

RAM e swap arrivano da `store_server.py` (endpoint `/stats`), che li legge dal sistema; si aggiornano ogni 6 secondi.

### Progetti

Barra laterale **destra** (icona cartella), speculare a quella delle chat: raggruppa più chat sullo stesso argomento.

| Azione | Come |
|---|---|
| Creare un progetto | *Nuovo progetto* |
| Chat nuova nel progetto | **+** accanto al progetto |
| Aggiungere una chat esistente | aprila, poi *Aggiungi/Sposta la chat corrente* dentro il progetto |
| Istruzioni e memoria | matita: istruzioni del progetto e fatti da ricordare; Altea aggiunge da sola i fatti emersi dalle chat (obiettivi, decisioni, scadenze), modificabili a mano |
| Documenti del progetto | nella matita: *Aggiungi documento* (PDF o testo); li usano solo le chat del progetto, mentre quelli del pulsante *Doc* restano globali |
| Collegamento tra chat | istruzioni, memoria e titoli delle altre chat del progetto sono passati ad Altea in ogni chat del progetto |

I progetti sono salvati nel browser (`localStorage`) e inclusi nel backup *Importa/Esporta*. Eliminare un progetto non elimina le chat.

### Analisi video

llama.cpp non legge i video: quando ne alleghi uno (*+* → *Video*, o trascinandolo) Altea lo trasforma nel browser in **3-6 fotogrammi** (JPEG, in ordine, lato massimo 448 px, uno ogni ~5 s) più l'**audio** (WAV mono 16 kHz, primi 30 s; assente oltre i 5 minuti di video o se silenzioso). Poi scrivi la domanda (es. *cosa succede in questo video?*).

- Serve il modello **Qwen2.5-Omni** (immagini e audio). Con **Auto** attivo puoi allegare immagini, audio e video anche se è selezionato un altro modello: all'invio Altea passa da sola a Omni.
- È un campionamento, non una visione continua: azioni brevi tra due fotogrammi possono sfuggire.
- Con 4096 token di contesto 6 fotogrammi e 30 s di audio occupano buona parte del contesto: usa video brevi.
- Tutto avviene sul Mac; il video non viene inviato a nessuno. Limite 500 MB.

### Memoria su file

Memoria, progetti e documenti vengono copiati automaticamente in `~/Altea/data/` (cambiabile con la variabile `ALTEA_DATA`). All'apertura, se il browser è vuoto (dati cancellati, altro browser) o il file è più recente, Altea li ricarica dal file; altrimenti aggiorna il file. Se il servizio non è attivo, tutto funziona come prima solo nel browser. Le conversazioni restano nel browser: per queste usa l'esportazione ZIP.

### Azioni sul computer

Pulsante **Azioni: on/off** nella barra superiore (spento di default; anche `/azioni`). Con le azioni attive Altea può proporre, alla fine di una risposta, un blocco ` ```azione {json} ``` ` che la UI mostra in una finestra di conferma: **non succede nulla finché non premi Consenti**.

| Azione | Cosa fa |
|---|---|
| `elenca_file` | elenca i file della cartella di lavoro |
| `leggi_file` | legge un file di testo (max 20.000 caratteri; il contenuto torna ad Altea) |
| `scrivi_file` | crea o sovrascrive un file (max 200 KB; la conferma mostra il contenuto) |
| `apri_file` | apre un file con l'app predefinita (solo documenti, immagini, PDF: mai script o eseguibili) |
| `apri_url` | apre un indirizzo http/https nel browser |

Sicurezza: i file sono confinati in `~/Altea/workspace` (cambiabile con `ALTEA_WORKSPACE`; i percorsi fuori cartella e i symlink che escono vengono rifiutati); non esiste esecuzione di comandi; il servizio `actions_server.py` (porta 8093, solo locale) accetta richieste solo dalla UI di Altea. Limite pratico: i modelli piccoli (1.7B/4B) rispettano il formato in modo irregolare, quindi a volte il blocco non viene generato o è malformato (in quel caso non succede nulla). Chiedi in modo esplicito, ad esempio "scrivi un file appunti.md con questo riassunto".

### Temi e dimensione del testo

Pulsante **Tema** nella barra superiore (in alto a destra, accanto al modello caricato), 9 temi. Chiari: **Chiaro**, **Seppia** (carta color sabbia, con sfondo virato seppia), **Lavanda**, **Menta**. Scuri: **Scuro** (predefinito, blu-oro), **Mezzanotte** (indaco), **Foresta** (verde), **Oceano** (ciano), **Grafite** (grigio caldo con accento arancio). Sotto, la dimensione del testo: Piccolo / Normale / Grande. Le scelte sono salvate nel browser. Per aggiungere un tema: tavolozza `html.palette-<nome>` in `app.css` e voce in `altea-theme.svelte.ts`.

### Aspetto

Font: interfaccia in **Plus Jakarta Sans**, risposte di Altea in **Lora** (serif dal tratto calligrafico, a metà tra corsivo e sans), codice in monospazio. Entrambi i font sono variabili e inclusi nella build (`@fontsource-variable/...`): funzionano offline. Per cambiarlo, installa un altro pacchetto `@fontsource-variable/...` e aggiorna `@import` e `--font-sans` in `llama.cpp/tools/ui/src/app.css`.

### Stima del tempo di risposta

Mentre Altea scrive, la barra superiore mostra "~N s rimasti". La stima usa la lunghezza media e la velocità (tok/s) delle ultime 5 risposte e il testo già generato; compare dopo la prima risposta della sessione. È solo un ordine di grandezza: non include l'elaborazione iniziale del prompt e sbaglia se la risposta è insolitamente breve o lunga.

### Menu comandi `/`

Scrivendo `/` come primo carattere nella casella di testo si apre una tendina con i comandi; continuando a scrivere la lista si filtra. Frecce per scegliere, Invio o Tab per confermare, Esc per chiudere.

| Comando | Effetto |
|---|---|
| `/riassumi` `/traduci` `/spiega` `/correggi` `/quiz` | inserisce il modello di richiesta nella casella |
| `/nuova` | nuova chat |
| `/memoria` | apre il pannello Memoria |
| `/esporta` | scarica la chat in Markdown |
| `/web` `/auto` `/avviso` | attiva/disattiva ricerca web, scelta automatica, avviso a fine risposta |
| `/ruolo-altea` `/ruolo-tutor` `/ruolo-codice` `/ruolo-traduttore` `/ruolo-sintetico` | cambia ruolo |

### Pannello Memoria

Pulsante **Memoria** nella barra superiore: elenca i fatti che Altea ricorda in tutte le chat (max 50). Puoi aggiungerne, modificarli, eliminarli o cancellare tutto; le modifiche valgono dal messaggio successivo e vengono salvate anche su file. La memoria dei singoli progetti si gestisce dalla barra dei progetti.

### Avviso a fine risposta

Pulsante **Avviso: on/off** nella barra superiore. Quando una risposta finisce e la finestra non è in primo piano, Altea emette un suono breve e una notifica di sistema (il browser chiede il permesso la prima volta). Con la finestra in primo piano non fa nulla.

### Esporta chat in Markdown

Pulsante **Esporta .md** nella barra superiore (attivo con una chat aperta). Scarica `<titolo>_<data>.md` con solo titolo, `## Domanda` e `## Risposta`: niente metadati, allegati o ragionamento interno. Esporta il ramo visualizzato.

### Backup (esporta/importa)

*Impostazioni* → *Importa/Esporta*:

| Cosa | Formato | Note |
|---|---|---|
| Conversazioni | ZIP di JSONL | importazione con unione alle esistenti |
| Memoria e documenti (Doc) | JSON (`altea_backup_AAAA-MM-GG.json`) | importazione senza duplicati |
| Impostazioni | JSON | chiavi sensibili escluse di default |

Usalo per spostare Altea su un altro browser o prima di cancellare i dati del sito.

### Scelta automatica del modello

Il pulsante **Auto** (accanto a *Doc*) sceglie il modello per ogni messaggio:

| Messaggio | Modello |
|---|---|
| Domanda breve/semplice | Qwen3-1.7B (veloce) |
| Testo lungo, codice, spiegazioni/analisi/calcoli, o con Web/Doc attivi | Qwen3-4B |
| Immagini, audio o video allegati | Qwen2.5-Omni-3B |

Cambiare modello richiede qualche secondo di caricamento (ne resta uno solo in RAM). Disattivato di default; la scelta si ricorda nel browser.

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
| `-c 4096` | contesto di 4096 token (2048 se la RAM scarseggia) |
| `-t 4` | 4 thread |
| `--reasoning off --reasoning-budget 0` | niente ragionamento di default |
| `-fa on` | Flash Attention: generazione ~40% più veloce nel benchmark |
| `--cache-type-k/v q8_0` | cache KV quantizzata: meno RAM, stessa velocità |
| `--cache-ram 1024` | limita a 1 GB la cache dei prompt (predefinito 8 GB) |
| `--sleep-idle-seconds 600` | scarica il modello dopo 10 minuti di inattività e libera la RAM |
| `--no-mmproj-offload` | il file di visione/audio resta sulla CPU (altrimenti Omni non si carica: cerca 4,3 GB sulla GPU) |

Consigli:

- Chiudi le applicazioni pesanti (browser, IDE) prima di avviare.
- Per risposte più rapide usa il modello 1.7B e lascia il ragionamento spento.
- Se il contesto da 4096 token si riempie (conversazioni lunghe, immagini), apri una nuova chat.

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
├── search_server.py        ricerca web locale (DuckDuckGo) per il pulsante Web
├── store_server.py         archivio su file (~/Altea/data) per memoria, progetti, documenti
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
- [x] Modello predefinito all'apertura: Qwen3-1.7B
- [x] Ricerca web con fonti citate (pulsante *Web*)
- [x] Documenti locali (RAG) con citazione di file e pagina (pulsante *Doc*)
- [x] Traduzione completa della UI in italiano
- [x] Scelta automatica del modello (pulsante *Auto*)### Prossimi obiettivi
- [x] Esporta/importa: conversazioni, memoria e documenti
- [x] Progetti: barra laterale destra con chat, istruzioni e memoria condivise| Priorità | Obiettivo | Note |
- [x] Memoria su file (`~/Altea/data`)
- [x] Barra superiore: ruoli, comandi rapidi e stato del sistema
- [x] Analisi video (fotogrammi e audio estratti nel browser)
- [x] Appunti da lezione: riassunti, flashcard e quiz dai documenti
- [x] Ricerca nelle chat passate (pulsante *Storico*)
|---|---|---|
| Bassa | Azioni sul computer | comandi con conferma esplicita dell'utente |
| Bassa | Personalizzazione del modello | fine-tuning leggero (LoRA) su stile e conoscenze |
| Bassa | Benchmark e quantizzazioni | confronto velocità/qualità per ottimizzare su 8 GB di RAM |
| Bassa | Launcher per Windows/Linux | equivalente di `Altea.app` |

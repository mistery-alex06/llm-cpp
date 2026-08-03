llm-cpp

Un'architettura LLM sperimentale e minimale scritta in **C++ puro**, sviluppata da zero per gestire tokenizzazione, calcolo matriciale e inferenza neurale senza dipendenze esterne.

---

Moduli Principali
- Motore di inferenza: `main.cpp` collega direttamente `libllama` (llama.cpp), caricando il modello Qwen3-4B e generando risposte reali token per token, con supporto al chat template e al reasoning (`<think>`).
- Tokenizer/Matrix/Transformer custom: implementazione originale del progetto (embedding, forward pass, Softmax), mantenuta in `src/` come base storica non più usata per l'inferenza in `main.cpp`.
- REPL Loop: Interfaccia interattiva da riga di comando per chattare col modello in tempo reale.
- llama.cpp: Copia vendored del progetto [llama.cpp](https://github.com/ggml-org/llama.cpp), ora collegata nativamente (non più solo riferimento).

---

Compilazione ed Esecuzione

Per compilare il motore reale (collegato a llama.cpp) ed avviare la chat interattiva dal terminale:

```bash
g++ -std=c++17 -O2 main.cpp -I llama.cpp/include -I llama.cpp/ggml/include \
    -L llama.cpp/build/bin -lllama -lggml \
    -Wl,-rpath,@executable_path/llama.cpp/build/bin -o llm
./llm
```

Di default cerca `Qwen3-4B-Q4_K_M.gguf` nella cartella corrente (o superiore); in alternativa passa il percorso come argomento: `./llm /percorso/modello.gguf`.

> Nota: `llama.cpp/build/` deve essere già compilato (vedi sotto) prima di questo comando, perché fornisce `libllama`/`libggml`. File di build e pesi dei modelli (`*.gguf`) restano esclusi via `.gitignore`.

---

Chat con Qwen3-4B (via llama.cpp)

È incluso uno script pronto per avviare una chat interattiva con il modello `Qwen3-4B-Q4_K_M.gguf` (da scaricare separatamente, non incluso nella repo per via del limite di 100MB di GitHub):

```bash
./run_qwen.sh
```

Oppure per una singola risposta non interattiva:

```bash
./run_qwen.sh -p "Ciao, chi sei?" -n 60 -st
```

> Nota hardware: su macchine con RAM limitata (8GB), lo script gira in modalità CPU-only (`-ngl 0`) con contesto ridotto (`-c 2048`) per evitare thrashing di memoria. Chiudere applicazioni pesanti (browser, IDE) prima dell'avvio migliora sensibilmente le prestazioni.

---

Roadmap
- [x] Tokenizer di base
- [x] Motore di calcolo matriciale (Matrix)
- [x] Forward pass e Softmax
- [x] CLI interattiva
- [x] Setup base llama.cpp + Qwen3-4B (CLI standalone, script `run_qwen.sh`)
- [x] Interfaccia web (llama-server + Web UI integrata, script `run_qwen_server.sh`)
- [x] Personalizzazione interfaccia web (tema blu-oro marmorizzato, ricami bianchi, sfondo dedicato)
- [x] Integrazione avanzata con llama.cpp (chiamata diretta da `main.cpp`, link nativo a `libllama`)
- [ ] Sistema di memoria persistente cross-sessione

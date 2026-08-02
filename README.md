llm-cpp

Un'architettura LLM sperimentale e minimale scritta in **C++ puro**, sviluppata da zero per gestire tokenizzazione, calcolo matriciale e inferenza neurale senza dipendenze esterne.

---

Moduli Principali
- Tokenizer Custom: Gestisce la codifica e decodifica dei token testuali.
- Matrix Engine: Implementazione nativa delle strutture dati e delle operazioni matriciali (`Matrix`).
- Transformer Core: Modello con layer di embedding, logica di forward pass, Softmax e generazione dei logits.
- REPL Loop: Interfaccia interattiva da riga di comando per testare l'inferenza in tempo reale.
- llama.cpp: Copia vendored del progetto [llama.cpp](https://github.com/ggml-org/llama.cpp), inclusa come riferimento per la roadmap di integrazione avanzata.

---

Compilazione ed Esecuzione

Per compilare il progetto ed avviare la chat interattiva dal terminale:

```bash
g++ -std=c++17 main.cpp src/matrix.cpp src/tokenizer.cpp src/transformer.cpp -Iinclude -o llm
./llm
```

> Nota: la cartella `llama.cpp/` è inclusa nella repo come riferimento per lo sviluppo futuro, ma non è ancora collegata al codice sorgente principale (`main.cpp` e i moduli in `src/`). File di build (`build/`) e pesi dei modelli (`*.gguf`) sono esclusi via `.gitignore`.

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
- [ ] Personalizzazione interfaccia web (branding, UI su misura)
- [ ] Integrazione avanzata con llama.cpp (chiamata diretta da `main.cpp`)

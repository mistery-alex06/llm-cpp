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

Roadmap
- [x] Tokenizer di base
- [x] Motore di calcolo matriciale (Matrix)
- [x] Forward pass e Softmax
- [x] CLI interattiva
- [ ] Integrazione avanzata con llama.cpp

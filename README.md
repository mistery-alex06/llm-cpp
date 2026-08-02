llm-cpp

Un'architettura LLM sperimentale e minimale scritta in **C++ puro**, sviluppata da zero per gestire tokenizzazione, calcolo matriciale e inferenza neurale senza dipendenze esterne.

---

Moduli Principali
- Tokenizer Custom: Gestisce la codifica e decodifica dei token testuali.
- Matrix Engine: Implementazione nativa delle strutture dati e delle operazioni matriciali (`Matrix`).
- Transformer Core: Modello con layer di embedding, logica di forward pass, Softmax e generazione dei logits.
- REPL Loop: Interfaccia interattiva da riga di comando per testare l'inferenza in tempo reale.

---

Compilazione ed Esecuzione

Per compilare il progetto ed avviare la chat interattiva dal terminale:

```bash
g++ -std=c++17 main.cpp src/matrix.cpp src/tokenizer.cpp src/transformer.cpp -Iinclude -o llm
./llm
```
Roadmap
- [x] Tokenizer di base
- [x] Motore di calcolo matriciale (Matrix)
- [x] Forward pass e Softmax
- [x] CLI interattiva
- [x] Integrazione avanzata con llama.cpp

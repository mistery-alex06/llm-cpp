<p align="center"><img src="assets/logo-512.png" width="140" alt="Logo di Banana"></p>

# Banana (llm-cpp)

Banana è un'IA locale in C++ che gira interamente sul tuo computer: chat da terminale e interfaccia web in italiano, basate su [llama.cpp](https://github.com/ggml-org/llama.cpp) e modelli Qwen in formato GGUF. Sviluppata e testata su Mac Intel, 8 GB di RAM, solo CPU.

![Licenza MIT](https://img.shields.io/badge/licenza-MIT-green?style=flat-square) ![100% locale](https://img.shields.io/badge/100%25-locale-blueviolet?style=flat-square) ![C++](https://img.shields.io/badge/C%2B%2B-llama.cpp-00599C?style=flat-square) ![Lingua](https://img.shields.io/badge/lingua-italiano-orange?style=flat-square)

[![Documentazione: Wiki](https://img.shields.io/badge/%F0%9F%93%96%20Documentazione-Wiki-2563eb?style=for-the-badge)](https://github.com/mistery-alex06/llm-cpp/wiki)

> ## 📖 La documentazione completa è nella [Wiki](https://github.com/mistery-alex06/llm-cpp/wiki)
> Installazione, avvio su macOS e Windows, tutte le funzioni, comandi, temi, azioni sul computer, bot Discord e roadmap. Qui sotto trovi solo l'essenziale.
>
> **[Apri la Wiki →](https://github.com/mistery-alex06/llm-cpp/wiki)**

## In breve

- Risponde in locale, in italiano e al femminile; tre modelli (Qwen3-1.7B, Qwen3-4B, Qwen2.5-Omni-3B).
- Ricerca web opzionale, documenti locali (RAG), memoria persistente, progetti, immagini, audio e video.
- Interfaccia web con temi, comandi `/` (scrivi `/help`), azioni sul computer con conferma, bot Discord.
- Avvio con un clic su macOS (`Banana.app`) e Windows (`Banana.bat`).

## Anteprima


| Menu dei comandi `/` | Tema Lavanda | Tema Seppia |
|---|---|---|
| <img src="docs/img/comandi.png" width="300"> | <img src="docs/img/tema-lavanda.png" width="300"> | <img src="docs/img/tema-seppia.png" width="300"> |

| Tema Oceano | Tema Foresta |
|---|---|
| <img src="docs/img/tema-oceano.png" width="300"> | <img src="docs/img/tema-foresta.png" width="300"> |

## Come è fatta

```mermaid
flowchart TB
  U([Tu]) --> UI
  DC([Discord]) --> BOT[Bot Discord]
  subgraph PC[Il tuo computer - tutto in locale]
    UI[Interfaccia web SvelteKit<br/>chat, temi, comandi /, memoria, progetti]
    BOT
    SRV[llama-server<br/>router, porta 8080]
    subgraph AUX[Servizi ausiliari]
      SEARCH[search_server 8091<br/>ricerca web]
      STORE[store_server 8092<br/>documenti e RAG]
      ACT[actions_server 8093<br/>azioni con conferma]
    end
    subgraph MOD[Modelli GGUF su CPU]
      M1[Qwen3-1.7B default]
      M2[Qwen3-4B]
      M3[Qwen2.5-Omni-3B]
    end
    WS[(Workspace ~/Banana/workspace)]
  end
  UI -->|API OpenAI| SRV
  BOT -->|API OpenAI| SRV
  UI --> SEARCH
  UI --> STORE
  UI -->|dopo il tuo Consenti| ACT
  SRV --> M1
  SRV --> M2
  SRV --> M3
  ACT --> WS
```

Approfondimenti: [Come funziona](https://github.com/mistery-alex06/llm-cpp/wiki/Come-funziona) · [Interfaccia](https://github.com/mistery-alex06/llm-cpp/wiki/Interfaccia) · [Azioni sul computer](https://github.com/mistery-alex06/llm-cpp/wiki/Azioni-sul-computer) · [Discord](https://github.com/mistery-alex06/llm-cpp/wiki/Discord) · [Modelli e prestazioni](https://github.com/mistery-alex06/llm-cpp/wiki/Modelli-e-prestazioni)

## Avvio rapido

```bash
# 1. compila llama.cpp (motore, server e UI web)
cd llama.cpp && cmake -B build -DCMAKE_BUILD_TYPE=Release -DLLAMA_BUILD_UI=ON
cmake --build build --config Release -j4 && cd ..

# 2. scarica almeno un modello .gguf nella cartella llm/ (vedi Installazione nella wiki)

# 3. avvia il server e apri http://127.0.0.1:8080
./run_qwen_server.sh
```

## 📖 Documentazione nella [Wiki](https://github.com/mistery-alex06/llm-cpp/wiki)

| Pagina | Contenuto |
|---|---|
| [Installazione](https://github.com/mistery-alex06/llm-cpp/wiki/Installazione) | requisiti, compilazione, modelli |
| [Avvio](https://github.com/mistery-alex06/llm-cpp/wiki/Avvio) | macOS, Windows, terminale |
| [Uso di Banana](https://github.com/mistery-alex06/llm-cpp/wiki/Uso-di-Banana) | memoria, ricerca web, documenti, video, backup |
| [Interfaccia](https://github.com/mistery-alex06/llm-cpp/wiki/Interfaccia) | barra superiore, progetti, comandi, temi |
| [Azioni sul computer](https://github.com/mistery-alex06/llm-cpp/wiki/Azioni-sul-computer) | azioni con conferma e sicurezza |
| [Discord](https://github.com/mistery-alex06/llm-cpp/wiki/Discord) | bot Discord |
| [Modelli e prestazioni](https://github.com/mistery-alex06/llm-cpp/wiki/Modelli-e-prestazioni) | scelta del modello e parametri |
| [Sviluppo](https://github.com/mistery-alex06/llm-cpp/wiki/Sviluppo) | personalizzazione, struttura, roadmap |

# Altea (llm-cpp)

Altea è un'IA locale in C++ che gira interamente sul tuo computer: chat da terminale e interfaccia web in italiano, basate su [llama.cpp](https://github.com/ggml-org/llama.cpp) e modelli Qwen in formato GGUF. Sviluppata e testata su Mac Intel, 8 GB di RAM, solo CPU.

[![Documentazione: Wiki](https://img.shields.io/badge/%F0%9F%93%96%20Documentazione-Wiki-2563eb?style=for-the-badge)](https://github.com/mistery-alex06/llm-cpp/wiki)

> ## 📖 La documentazione completa è nella [Wiki](https://github.com/mistery-alex06/llm-cpp/wiki)
> Installazione, avvio su macOS e Windows, tutte le funzioni, comandi, temi, azioni sul computer, bot Discord e roadmap. Qui sotto trovi solo l'essenziale.
>
> **[Apri la Wiki →](https://github.com/mistery-alex06/llm-cpp/wiki)**

## In breve

- Risponde in locale, in italiano e al femminile; tre modelli (Qwen3-1.7B, Qwen3-4B, Qwen2.5-Omni-3B).
- Ricerca web opzionale, documenti locali (RAG), memoria persistente, progetti, immagini, audio e video.
- Interfaccia web con temi, comandi `/` (scrivi `/help`), azioni sul computer con conferma, bot Discord.
- Avvio con un clic su macOS (`Altea.app`) e Windows (`Altea.bat`).

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
| [Uso di Altea](https://github.com/mistery-alex06/llm-cpp/wiki/Uso-di-Altea) | memoria, ricerca web, documenti, video, backup |
| [Interfaccia](https://github.com/mistery-alex06/llm-cpp/wiki/Interfaccia) | barra superiore, progetti, comandi, temi |
| [Azioni sul computer](https://github.com/mistery-alex06/llm-cpp/wiki/Azioni-sul-computer) | azioni con conferma e sicurezza |
| [Discord](https://github.com/mistery-alex06/llm-cpp/wiki/Discord) | bot Discord |
| [Modelli e prestazioni](https://github.com/mistery-alex06/llm-cpp/wiki/Modelli-e-prestazioni) | scelta del modello e parametri |
| [Sviluppo](https://github.com/mistery-alex06/llm-cpp/wiki/Sviluppo) | personalizzazione, struttura, roadmap |

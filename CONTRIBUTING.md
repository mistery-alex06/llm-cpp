# Contribuire a Banana

## Flusso di lavoro

1. **Issue**: ogni idea, bug o miglioria ha una issue con un'etichetta (`feature`, `bug`, `docs`, `idea`).
2. **Branch**: un branch per lavoro, partendo da `main` aggiornato.
   - `feat/<nome>` per le funzioni, `fix/<nome>` per i bug, `docs/<nome>` per README e wiki.
3. **Pull request** verso `main`:
   - titolo breve in italiano;
   - nella descrizione `Closes #N`, così la issue si chiude da sola al merge;
   - cosa cambia e come l'hai provato.
4. **Merge in squash**: `main` resta con un commit per funzione.
5. **Release**: quando si uniscono più PR si crea un tag (`v1.1`, `v1.2`, …) con le note.

## Prima di aprire la PR

- UI: `npm run build` in `llama.cpp/tools/ui` senza errori, poi ricostruire `llama-server` (vedi [wiki: Sviluppo](https://github.com/mistery-alex06/llm-cpp/wiki/Sviluppo)).
- Nessun dato personale: niente token, chat o file di `~/Banana/` nei commit.
- Se cambia il comportamento, aggiorna la wiki (repo separata `llm-cpp.wiki`).

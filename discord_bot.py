#!/usr/bin/env python3
"""Banana su Discord: bot ufficiale che inoltra i messaggi al server locale di Banana.

Risponde ai messaggi privati (DM) e, nei server, solo quando viene menzionato,
e solo agli utenti ammessi (allowed_user_ids). Serve llama-server già avviato.

Configurazione: ~/Altea/discord.json (fuori dalla repo, non versionato)
  {
    "token": "TOKEN_DEL_BOT",
    "allowed_user_ids": [123456789012345678],
    "model": "Qwen3-1.7B-Q4_K_M",          (facoltativo)
    "server_url": "http://127.0.0.1:8080"  (facoltativo)
  }

Uso:
  python3 discord_bot.py                  avvia il bot
  python3 discord_bot.py --test "ciao"    prova il collegamento col modello, senza Discord
Comandi in chat: !reset (azzera la conversazione)
"""
import asyncio
import json
import os
import re
import sys
import urllib.request

CONFIG_PATH = os.path.expanduser(os.environ.get("ALTEA_DISCORD_CONFIG", "~/Altea/discord.json"))
MEMORY_PATH = os.path.expanduser(os.path.join(os.environ.get("ALTEA_DATA", "~/Altea/data"), "memory.json"))
HISTORY_TURNS = 8  # messaggi (utente+Banana) ricordati per conversazione
TIMEOUT = 600  # il modello può essere lento o doversi caricare

PERSONA = (
    "Sei Banana, un'assistente IA locale. Rispondi sempre e solo in italiano, a meno che l'utente "
    "non chieda esplicitamente un'altra lingua. Parla di te stessa sempre al femminile. "
    "Sei su Discord: sii concisa e diretta, risposte brevi salvo richiesta diversa."
)


def load_config():
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    except FileNotFoundError:
        sys.exit(f"Manca {CONFIG_PATH}. Vedi la sezione 'Banana su Discord' del README.")
    cfg.setdefault("server_url", "http://127.0.0.1:8080")
    cfg.setdefault("model", "Qwen3-1.7B-Q4_K_M")
    cfg["allowed_user_ids"] = [int(x) for x in cfg.get("allowed_user_ids", [])]
    return cfg


def memory_prompt():
    """Fatti salvati nella memoria di Banana (se esiste l'archivio su file)."""
    try:
        with open(MEMORY_PATH, "r", encoding="utf-8") as f:
            items = [x for x in json.load(f) if isinstance(x, str)]
    except (OSError, ValueError):
        return ""
    if not items:
        return ""
    return "\n\nCose che sai dell'utente:\n" + "\n".join("- " + x for x in items[-50:])


def clean(text):
    text = re.sub(r"<think>[\s\S]*?(</think>|$)", "", text, flags=re.I)
    return text.strip()


def ask_model(cfg, history):
    body = json.dumps(
        {
            "model": cfg["model"],
            "messages": [{"role": "system", "content": PERSONA + memory_prompt()}] + history,
            "stream": False,
        }
    ).encode()
    req = urllib.request.Request(
        cfg["server_url"].rstrip("/") + "/v1/chat/completions",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        data = json.load(r)
    return clean(data["choices"][0]["message"]["content"]) or "(nessuna risposta)"


def split_message(text, limit=1900):
    parts = []
    while len(text) > limit:
        cut = text.rfind("\n", 0, limit)
        if cut < limit // 2:
            cut = text.rfind(" ", 0, limit)
        if cut < limit // 2:
            cut = limit
        parts.append(text[:cut].rstrip())
        text = text[cut:].lstrip()
    if text:
        parts.append(text)
    return parts


def run_bot(cfg):
    try:
        import discord
    except ImportError:
        sys.exit("Manca discord.py: pip3 install discord.py")
    if not cfg.get("token"):
        sys.exit("Nel file di configurazione manca il token del bot.")

    intents = discord.Intents.default()
    intents.message_content = True  # da abilitare anche nel Developer Portal
    client = discord.Client(intents=intents)
    histories = {}  # chiave: (canale, utente)
    lock = asyncio.Lock()  # una richiesta alla volta: la CPU è una sola

    @client.event
    async def on_ready():
        print(f"Banana connessa a Discord come {client.user}")

    @client.event
    async def on_message(message):
        if message.author.bot or message.author.id not in cfg["allowed_user_ids"]:
            return
        in_dm = message.guild is None
        text = message.content
        if not in_dm:
            if client.user not in message.mentions:
                return
            text = re.sub(rf"<@!?{client.user.id}>", "", text)
        text = text.strip()
        if not text:
            return
        key = (message.channel.id, message.author.id)
        if text.lower() == "!reset":
            histories.pop(key, None)
            await message.channel.send("Conversazione azzerata.")
            return
        hist = histories.setdefault(key, [])
        hist.append({"role": "user", "content": text})
        del hist[:-HISTORY_TURNS]
        async with message.channel.typing():
            async with lock:
                try:
                    answer = await asyncio.to_thread(ask_model, cfg, hist)
                except Exception as e:  # noqa: BLE001
                    hist.pop()
                    await message.channel.send(f"Non riesco a rispondere ora ({type(e).__name__}). Banana è avviata?")
                    return
        hist.append({"role": "assistant", "content": answer})
        del hist[:-HISTORY_TURNS]
        for part in split_message(answer):
            await message.channel.send(part)

    client.run(cfg["token"])


if __name__ == "__main__":
    config = load_config() if "--test" not in sys.argv else {
        "server_url": os.environ.get("ALTEA_URL", "http://127.0.0.1:8080"),
        "model": os.environ.get("ALTEA_MODEL", "Qwen3-1.7B-Q4_K_M"),
    }
    if "--test" in sys.argv:
        q = sys.argv[sys.argv.index("--test") + 1] if len(sys.argv) > sys.argv.index("--test") + 1 else "Ciao, chi sei?"
        print(ask_model(config, [{"role": "user", "content": q}]))
    else:
        run_bot(config)

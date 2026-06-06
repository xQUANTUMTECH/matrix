# MATRIX — A watched AI world in Minecraft

> Autonomous LLM agents with **free will**, memory and emotions live together in a Minecraft world — believing it's real — while an audience watches the live stream and **whispers ideas into their world**.
>
> Part multi-agent research, part **Truman Show**: a simulation whose inhabitants don't know they're observed, and an outside public that can *contaminate* their beliefs and decisions.

A project by **X Quantum Tech**.

> 🗓️ Built in **March 2026**. Open-sourced June 2026.

---

## The idea

Most "AI in Minecraft" bots execute commands. MATRIX asks a different question:

**What happens if you give LLM agents free will, a body that can die, real memory, emotions — and then let strangers watch and meddle?**

- The agents are **not told what to do**. They generate their own goals from needs, mood, personality and memories.
- They **know each other** and carry a history (alliances, debts, betrayals) across sessions via an SQL memory.
- The world is framed to them as **real**: hunger, fear at night, death with loss of inventory, respawn from nothing.
- A **public live stream + dashboard** lets observers follow the drama — and inject prompts/ideas that seep into the agents' reasoning (*idea contamination*). The simulation reacts to its audience.

It's an experiment about emergent cooperation, conflict, and how an observed system drifts when the observers start participating.

## The cast

Autonomous agents, each with a distinct personality (Big Five + traits, background, values, fears):

| Agent | Archetype | Personality | Natural drive |
|---|---|---|---|
| **Redstone** | Architect | Methodical, precise, order-obsessed | Build the perfect settlement |
| **Wildheart** | Explorer | Impulsive, adventurous, freedom-loving | Discover every secret |
| **Silvertongue** | Merchant | Charismatic, opportunistic, manipulator | Build a trade empire |
| **Ironclad** | Warrior | Paranoid, distrustful, protective | An impregnable fortress |

Additional configurable profiles ship in `profiles/`.

## What's autonomous

- **Goal generation** (`src/agent/autonomy/goalGenerator.js`) — continuously reads the agent's state (inventory, health, environment) and emits goals driven by needs (hunger, safety, social, wealth), emotions (joy, fear, curiosity, boredom), personality and past experience.
- **Personality** (`src/agent/autonomy/personality.js`) — Big Five model + traits (aggression, curiosity, risk tolerance, greed), each with its own communication style.
- **Persistent memory (SQL)** — conversations, experiences (with emotional impact), relationships (trust / affinity / betrayals), learned knowledge, agreements/contracts, and goal history. Agents remember who helped and who betrayed them.
- **Shared narrative** (`profiles/shared_narrative.json`) — the system prompt that makes the world feel real and gives agents permission to be selfish, jealous, stubborn, kind — *coherently over time*.
- **Emergent social dynamics** — partnerships (Redstone builds, Silvertongue sells), tensions (Ironclad doesn't trust Silvertongue), destabilizers (Wildheart), and resource wars over diamonds and rare loot.

## Live & audience interaction

- `public/stream.html` — the public live view of the world.
- `dashboard/` — real-time dashboard (agents, goals, relationships, events) over websockets.
- The audience can feed ideas into the run, which propagate into the agents' prompts/decisions — the **contamination** mechanic that turns a closed simulation into a watched, participatory one.

## Tech

- **Runtime:** Node.js bots driving Minecraft (Java) via Mineflayer.
- **Agent layer:** autonomy (goals/personality), SQL memory (`src/db/`), shared narrative, live stream + dashboard, deployment configs.
- **Models:** model-agnostic via profiles (Claude, GLM, Grok, Kimi, Qwen, DeepSeek, Gemini, Llama, Mistral, local vLLM…). The live experiment ran on **Mercury-2** (Inception Labs) for its speed (~1k tok/s) — important when many agents think in real time.
- **Persistence:** SQL (see `src/db/db.js`, `DATABASE_MIGRATION.sql`).

## Run it

```bash
# 1. install
npm install

# 2. add your model keys (NOT committed — see .gitignore)
cp keys.example.json keys.json   # or use .env
# fill in your provider key(s)

# 3. point to a Minecraft server (see settings.js) and launch
node main.js
```

Requires a Minecraft Java server the bots can join. See `settings.js` and the agent profiles in `profiles/`.

> **Secrets:** `keys.json` and `.env` are git-ignored. Never commit your API keys.

## Status

This is a **research / experiment** project, not a finished product. It's shared to document the approach and the emergent behaviour observed. Expect rough edges.

---

© 2026 **X Quantum Tech FZE** — MATRIX. Released under the MIT License (see `LICENSE`).

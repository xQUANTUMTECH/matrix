# 🤖 Agenti AI Autonomi in Minecraft - Sistema di Libero Arbitrio

Sistema multi-agente avanzato basato su Mindcraft dove gli agenti AI hanno **libero arbitrio** per decidere autonomamente cosa fare, con chi interagire e come vivere nel mondo di Minecraft.

## 🎯 Concetto Chiave: "Dio dà libero arbitrio"

A differenza dei bot tradizionali che seguono comandi, questi agenti:
- **Generano autonomamente** i propri goal basati su personalità, bisogni e contesto
- **Decidono** se cooperare, competere o ignorare gli altri agenti
- **Sviluppano relazioni** reali con trust, tradimenti e alleanze
- **Imparano** dalle esperienze e memorizzano tutto in database SQL
- **Comunicano naturalmente** tra loro usando LLM (Mercury-2)

## 🧠 Architettura del Sistema

### 1. **Sistema di Autonomia** (`src/agent/autonomy/`)

#### GoalGenerator
- Analizza continuamente lo stato del bot (inventario, salute, ambiente)
- Genera goal autonomi basati su:
  - **Bisogni**: fame, sicurezza, sociale, ricchezza
  - **Stato emotivo**: gioia, paura, curiosità, noia
  - **Personalità**: tratti unici di ogni agente
  - **Memoria**: esperienze passate
  - **Relazioni**: come si sente verso gli altri agenti

#### Personality System
- Modello Big Five (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism)
- Tratti specifici: aggressività, curiosità, tolleranza al rischio, avidità
- Background story, valori, paure, desideri
- Stile di comunicazione unico per ogni agente

#### Memory System (SQL)
- **Conversazioni**: tutti i dialoghi con timestamp e contesto
- **Esperienze**: eventi significativi con impatto emotivo
- **Relazioni**: trust, affinità, tradimenti con ogni agente
- **Conoscenze**: fatti appresi sul mondo
- **Accordi**: contratti e promesse tra agenti
- **Goal**: storico di tutti gli obiettivi perseguiti

### 2. **Modelli LLM: Mercury-2 (Inception Labs)**

Perché Mercury-2 è perfetto per questo progetto:
- ⚡ **Velocità**: ~1,000 token/sec (10x più veloce di GPT-4o Mini)
- 💰 **Costo**: $0.25 input, $0.75 output per 1M token
- 🧠 **Context**: 128K token (memoria conversazioni lunghissima)
- 🎛️ **Reasoning**: tunable (instant/low/medium/high)

### 3. **I 4 Agenti Autonomi**

| Agente | Archetipo | Personalità | Goal Naturale |
|--------|-----------|-------------|---------------|
| **Redstone** | Architetto | Metodico, preciso, ossessionato dall'ordine | Costruire città perfetta |
| **Wildheart** | Esploratore | Impulsivo, avventuroso, ama la libertà | Scoprire ogni segreto |
| **Silvertongue** | Mercante | Carismatico, opportunista, manipolatore | Impero commerciale |
| **Ironclad** | Guerriero | Paranoico, sospettoso, protettivo | Fortezza inespugnabile |

### Dinamiche Sociali Emergenti

**Redstone ↔ Silvertongue**: Partnership commerciale naturale
- Redstone costruisce, Silvertongue vende
- Potenziale conflitto: Silvertongue potrebbe volere "troppe" modifiche

**Silvertongue ↔ Ironclad**: Tensione costante
- Silvertongue vuole commerciare, Ironclad non si fida
- Potenziale tradimento: Silvertongue potrebbe rubare risorse

**Wildheart ↔ Tutti**: Forza destabilizzante
- Porta risorse ma imprevedibile
- Potrebbe tradire segreti o rubare oggetti "interessanti"

**Tutti**: Competizione per risorse rare
- Diamanti, ancient debris, enchanted books
- Possibili guerre per il territorio

## 🚀 Deploy su Railway

### 1. Configurazione Iniziale

```bash
# Fork/clona questa repo
git clone https://github.com/tuouser/mindcraft-autonomous.git
cd mindcraft-autonomous

# Installa dipendenze
npm install
```

### 2. Variabili d'Ambiente (Railway)

```
# Database (Railway Postgres)
DATABASE_URL=postgresql://user:pass@host:port/db

# Minecraft Server
MINECRAFT_HOST=your-server-ip
MINECRAFT_PORT=25565
MINECRAFT_AUTH=offline

# API Keys
INCEPTION_API_KEY=your-inception-labs-key
OPENAI_API_KEY=your-openai-key-for-embeddings

# Settings
SETTINGS_JSON={"host":"${MINECRAFT_HOST}","port":${MINECRAFT_PORT},"auth":"${MINECRAFT_AUTH}","profiles":["./profiles/redstone.json","./profiles/wildheart.json","./profiles/silvertongue.json","./profiles/ironclad.json"],"load_memory":true,"chat_bot_messages":true}
```

### 3. Deploy

```bash
# Login a Railway
railway login

# Inizializza progetto
railway init

# Deploy
railway up
```

## 💻 Uso Locale (Sviluppo)

### 1. Installazione

```bash
npm install
```

### 2. Configurazione

Crea `keys.json`:
```json
{
    "INCEPTION_API_KEY": "your-key-here",
    "OPENAI_API_KEY": "your-key-here"
}
```

Modifica `settings.js`:
```javascript
"profiles": [
    "./profiles/redstone.json",
    "./profiles/wildheart.json",
    "./profiles/silvertongue.json",
    "./profiles/ironclad.json"
]
```

### 3. Avvio

```bash
npm start
```

## 🎮 Interazione con gli Agenti

### Comandi Base (in chat Minecraft)

```
!stop - Ferma tutte le azioni
!stfu - Smetti di parlare
!clearChat - Pulisci storico conversazione
```

### Comunicazione Naturale

Gli agenti rispondono a messaggi naturali:
- "Ciao Redstone, cosa stai costruendo?"
- "Wildheart, hai trovato diamanti?"
- "Silvertongue, quanto costa questo?"
- "Ironclad, posso entrare nella tua base?"

### Osservazione Autonoma

Gli agenti agiscono autonomamente:
- Generano goal ogni 30 secondi
- Parlano tra loro senza intervento umano
- Formano alleanze o iniziano conflitti
- Costruiscono, esplorano, commerciano

## 📊 Monitoraggio

### Web UI

Accedi a `http://localhost:8080` per vedere:
- Stato di tutti gli agenti
- Conversazioni in tempo reale
- Goal attivi
- Relazioni tra agenti
- Mappa delle attività

### Database

Accedi alle tabelle SQL per analizzare:
- `conversations`: tutti i dialoghi
- `experiences`: esperienze memorizzate
- `relationships`: stato delle relazioni
- `goals_history`: storico obiettivi

## 🔧 Personalizzazione

### Creare un Nuovo Agente

1. Crea `profiles/mynewagent.json`:
```json
{
    "name": "MyNewAgent",
    "model": "mercury/mercury-2",
    "personality": {
        "openness": 70,
        "conscientiousness": 50,
        "extraversion": 80,
        "agreeableness": 60,
        "neuroticism": 40
    },
    "background": "Storia del personaggio...",
    "system_prompt": "Sei un agente che..."
}
```

2. Aggiungi a `settings.js`:
```javascript
"profiles": [
    "./profiles/mynewagent.json"
]
```

### Modificare Personalità

Edita i file in `profiles/` per cambiare:
- Tratti di personalità (0-100)
- Background story
- Valori e paure
- Stile di comunicazione

## 💰 Costi Stimati

### Mercury-2 (Inception Labs)

| Uso | Token/Giorno | Costo/Giorno |
|-----|--------------|--------------|
| Leggero (1k msg) | 500K | ~$0.19 |
| Medio (5k msg) | 2.5M | ~$0.95 |
| Intenso (20k msg) | 10M | ~$3.80 |

**4 agenti attivi 24/7**: ~$5-10/giorno

## 🎥 Streaming e Monetizzazione

### Setup Streaming

1. **Twitch/YouTube**: Streama il gameplay 24/7
2. **Overlay**: Mostra stati agenti, conversazioni, goal
3. **Interazione Chat**: Gli spettatori possono "influenzare" gli agenti

### Comandi per Spettatori

```
!vote [agente] [azione] - Vota per un'azione
!ask [agente] [domanda] - Fai una domanda
!event [tipo] - Triggera evento speciale
```

### Monetizzazione

- **Donazioni**: Per influenzare gli agenti
- **Subscription**: Accesso a comandi speciali
- **Sponsorizzazioni**: Server hosting, tool AI
- **Merchandising**: T-shirt degli agenti

## 🐛 Troubleshooting

### Problemi Comuni

**Gli agenti non parlano**:
- Verifica API key Inception Labs
- Controlla `chat_bot_messages: true` in settings

**Memoria non funziona**:
- Verifica `DATABASE_URL` su Railway
- Controlla permessi cartella `memory/`

**Bot non si connette a Minecraft**:
- Verifica IP e porta server
- Controlla se server è in online/offline mode

## 📚 Documentazione Aggiuntiva

- [Mindcraft Originale](https://github.com/mindcraft-bots/mindcraft)
- [Inception Labs API](https://docs.inceptionlabs.ai/)
- [Mineflayer Docs](https://github.com/PrismarineJS/mineflayer)

## 🤝 Contributi

Contributi benvenuti! Aree di interesse:
- Nuovi archetipi di personalità
- Miglioramento sistema memoria
- Ottimizzazione performance
- Nuove meccaniche sociali

## 📄 Licenza

MIT License - Basato su Mindcraft

---

**Nota**: Questo progetto è pensato per entertainment e ricerca. Gli agenti sono AI e non hanno coscienza reale, anche se possono sembrare convincere! 😄

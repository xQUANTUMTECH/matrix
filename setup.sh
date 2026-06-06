#!/bin/bash

# Setup Script per Agenti AI Autonomi Minecraft
# Automatizza installazione e configurazione iniziale

echo "🤖 Setup Agenti AI Autonomi Minecraft"
echo "======================================"

# Verifica Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js non trovato. Installa Node.js 18+ prima di continuare."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js versione $NODE_VERSION trovata. Richiesta versione 18+."
    exit 1
fi

echo "✅ Node.js $(node --version) trovato"

# Installa dipendenze
echo "📦 Installazione dipendenze..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Errore installazione dipendenze"
    exit 1
fi

echo "✅ Dipendenze installate"

# Crea directory necessarie
mkdir -p memory
mkdir -p logs

echo "✅ Directory create"

# Verifica/configura keys.json
if [ ! -f "keys.json" ]; then
    echo "📝 Configurazione API Keys..."
    
    read -p "Inserisci Inception Labs API Key: " INCEPTION_KEY
    read -p "Inserisci OpenAI API Key (per embeddings): " OPENAI_KEY
    
    cat > keys.json << EOF
{
    "INCEPTION_API_KEY": "$INCEPTION_KEY",
    "OPENAI_API_KEY": "$OPENAI_KEY"
}
EOF
    
    echo "✅ File keys.json creato"
else
    echo "✅ File keys.json già esistente"
fi

# Configura settings.js per 4 agenti
echo "⚙️ Configurazione settings.js..."

if [ -f "settings.js" ]; then
    # Backup
    cp settings.js settings.js.backup
    
    # Modifica profiles
    sed -i 's/"profiles": \[/"profiles": [\n        ".\/profiles\/redstone.json",\n        ".\/profiles\/wildheart.json",\n        ".\/profiles\/silvertongue.json",\n        ".\/profiles\/ironclad.json",/' settings.js
    
    # Abilita memoria
    sed -i 's/"load_memory": false/"load_memory": true/' settings.js
    
    echo "✅ Settings.js configurato"
fi

# Crea cartella memory per SQLite
mkdir -p memory

echo ""
echo "🎉 Setup completato!"
echo ""
echo "Prossimi passi:"
echo "1. Configura il tuo server Minecraft in settings.js"
echo "2. Avvia con: npm start"
echo "3. Apri http://localhost:8080 per la dashboard"
echo ""
echo "📚 Documentazione: README_AUTONOMOUS_AGENTS.md"
echo ""
echo "Buon divertimento con i tuoi agenti! 🚀"

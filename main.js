#!/usr/bin/env node

import 'dotenv/config';
import * as mindcraft from './src/mindcraft/mindcraft.js';
import { db } from './src/db/db.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT        = parseInt(process.env.PORT)          || 8080;
const MC_HOST     = process.env.MINECRAFT_HOST          || 'minecraft-server-production-fd0a.up.railway.app';
const MC_PORT     = parseInt(process.env.MINECRAFT_PORT) || 25565;
const MC_AUTH     = process.env.MINECRAFT_AUTH          || 'offline';
const MC_VERSION  = process.env.MINECRAFT_VERSION       || 'auto';

const PROFILES = [
    'redstone',
    'wildheart',
    'silvertongue',
    'ironclad',
];

function loadProfile(name) {
    const file = path.join(__dirname, 'profiles', `${name}.json`);
    return JSON.parse(readFileSync(file, 'utf8'));
}

console.log('🚀 MATRIX — Avvio agenti autonomi');
console.log(`📡 Server Minecraft: ${MC_HOST}:${MC_PORT}`);
console.log(`🌐 MindServer port:  ${PORT}`);

await db.connect();
await mindcraft.init(true, PORT, false);

async function startAgents() {
    for (let i = 0; i < PROFILES.length; i++) {
        const name = PROFILES[i];

        await new Promise(resolve => setTimeout(resolve, i * 12000));

        console.log(`🤖 Creazione agente: ${name}`);

        const profile = loadProfile(name);

        const settings = {
            profile,
            host:                  MC_HOST,
            port:                  MC_PORT,
            auth:                  MC_AUTH,
            minecraft_version:     MC_VERSION,
            base_profile:          'survival',
            load_memory:           true,
            init_message:          'Sei appena rinato. Prima cosa se vuoi comunicare con altre persone: usa !startConversation per salutare uno degli altri agenti vicino a te (Redstone, Wildheart, Silvertongue, Ironclad). Poi inizia a sopravvivere: raccogli legno, crafta strumenti, trova cibo o fa un po come ti pare.',
            only_chat_with:        [],
            speak:                 false,
            chat_ingame:           true,
            chat_bot_messages:     false,
            narrate_behavior:      false,
            render_bot_view:       process.env.RENDER_BOT_VIEW !== 'false',
            allow_insecure_coding: false,
            allow_vision:          false,
            // !activate: evita accensione portali nether/end
            // !placeHere: evita piazzamento blocchi casuali
            // !discard: evita drop di oggetti a caso
            // !attackPlayer: evita pvp involontario
            blocked_actions:       ['!checkBlueprint','!checkBlueprintLevel','!getBlueprint','!getBlueprintLevel','!activate','!placeHere','!discard','!attackPlayer'],
            code_timeout_mins:     -1,
            relevant_docs_count:   3,
            language:              'it',
            max_messages:          6,
            num_examples:          1,
            max_commands:          5,
            show_command_syntax:   'shortened',
            log_all_prompts:       false,
            block_place_delay:     300,
            spawn_timeout:         60,
        };

        const result = await mindcraft.createAgent(settings);
        if (result.success) {
            console.log(`✅ ${profile.name} avviato`);
        } else {
            console.error(`❌ ${profile.name} errore: ${result.error}`);
        }
    }
}

startAgents().catch(err => {
    console.error('Errore fatale:', err);
    process.exit(1);
});

process.on('SIGINT',  () => { console.log('\n🛑 Arresto...'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n🛑 Arresto...'); process.exit(0); });
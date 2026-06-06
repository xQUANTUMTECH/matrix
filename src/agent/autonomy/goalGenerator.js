import { getKey } from '../../utils/keys.js';

/**
 * Sistema di Generazione Autonoma dei Goal
 * Gli agenti decidono completamente cosa fare basandosi su:
 * - Stato attuale (inventario, posizione, salute)
 * - Memoria delle esperienze passate
 * - Personalità e tratti caratteriali
 * - Interazioni sociali con altri agenti
 * - Ambiente circostante
 */

export class GoalGenerator {
    constructor(agent) {
        this.agent = agent;
        this.currentGoal = null;
        this.goalHistory = [];
        this.lastGoalTime = 0;
        this.goalCooldown = 30000; // 30 secondi tra goal
        
        // Categorie di goal possibili
        this.goalCategories = [
            'survival',      // Sopravvivenza: cibo, riparo, sicurezza
            'gathering',     // Raccolta risorse
            'crafting',      // Crafting oggetti
            'building',      // Costruzione strutture
            'exploration',   // Esplorazione
            'social',        // Interazione sociale
            'trading',       // Commercio
            'combat',        // Combattimento
            'learning',      // Apprendimento nuove skill
            'recreation'     // Attività ricreative
        ];
        
        // Bisogni di base che influenzano i goal
        this.needs = {
            hunger: 100,      // Fame (0-100)
            safety: 100,      // Sicurezza (0-100)
            shelter: 50,      // Riparo (0-100)
            social: 50,       // Bisogno sociale (0-100)
            wealth: 0,        // Ricchezza (0-100)
            knowledge: 0,     // Conoscenza (0-100)
            achievement: 0    // Realizzazione (0-100)
        };
        
        // Stato emotivo che influenza le decisioni
        this.emotionalState = {
            joy: 50,
            fear: 0,
            anger: 0,
            curiosity: 50,
            boredom: 0
        };
    }

    /**
     * Aggiorna i bisogni basandosi sullo stato attuale del bot
     */
    async updateNeeds() {
        const bot = this.agent.bot;
        
        // Aggiorna fame
        if (bot.food && bot.food !== 20) {
            this.needs.hunger = (bot.food / 20) * 100;
        }
        
        // Aggiorna sicurezza (basata su mob vicini e salute)
        const nearbyHostiles = this.getNearbyHostiles();
        const healthPercent = (bot.health || 20) / 20;
        this.needs.safety = healthPercent * 100 - (nearbyHostiles.length * 20);
        this.needs.safety = Math.max(0, Math.min(100, this.needs.safety));
        
        // Aggiorna bisogno sociale (decresce nel tempo)
        this.needs.social = Math.max(0, this.needs.social - 0.5);
        
        // Aggiorna noia (aumenta se non fa nulla di interessante)
        if (!this.currentGoal) {
            this.needs.boredom = Math.min(100, this.emotionalState.boredom + 1);
        } else {
            this.emotionalState.boredom = Math.max(0, this.emotionalState.boredom - 2);
        }
        
        // Curiosità aumenta con nuovi stimoli
        this.emotionalState.curiosity = Math.min(100, this.emotionalState.curiosity + 0.5);
    }

    /**
     * Ottiene i mob ostili nelle vicinanze
     */
    getNearbyHostiles() {
        if (!this.agent.bot.entities) return [];
        
        const hostileMobs = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch', 'husk', 'stray', 'drowned'];
        return Object.values(this.agent.bot.entities)
            .filter(entity => {
                if (!entity || !entity.position) return false;
                const distance = this.agent.bot.entity.position.distanceTo(entity.position);
                return hostileMobs.includes(entity.name) && distance < 20;
            });
    }

    /**
     * Genera un nuovo goal basato su bisogni, personalità e contesto
     */
    async generateGoal() {
        const now = Date.now();
        if (now - this.lastGoalTime < this.goalCooldown) {
            return null;
        }
        
        await this.updateNeeds();
        
        // Costruisci il contesto per il LLM
        const context = await this.buildContext();
        
        // Chiedi al LLM di generare un goal
        const prompt = this.buildGoalPrompt(context);
        
        try {
            const response = await this.agent.prompter.sendRequest([
                { role: 'user', content: prompt }
            ], this.getSystemPrompt());
            
            const goal = this.parseGoal(response);
            if (goal) {
                this.currentGoal = goal;
                this.goalHistory.push({
                    goal: goal,
                    timestamp: now,
                    context: context
                });
                this.lastGoalTime = now;
                
                // Aggiorna stato emotivo
                this.updateEmotionFromGoal(goal);
                
                return goal;
            }
        } catch (err) {
            console.error('Error generating goal:', err);
        }
        
        return null;
    }

    /**
     * Costruisce il contesto completo per la generazione del goal
     */
    async buildContext() {
        const bot = this.agent.bot;
        const inventory = this.getInventorySummary();
        const nearbyBlocks = this.getNearbyBlocks();
        const nearbyEntities = this.getNearbyEntities();
        const timeOfDay = this.getTimeOfDay();
        const recentMemories = await this.getRecentMemories();
        const otherAgents = this.getOtherAgentsInfo();
        
        return {
            name: this.agent.name,
            personality: this.agent.profile?.personality || {},
            needs: this.needs,
            emotionalState: this.emotionalState,
            inventory: inventory,
            position: bot.entity?.position,
            health: bot.health,
            food: bot.food,
            timeOfDay: timeOfDay,
            nearbyBlocks: nearbyBlocks,
            nearbyEntities: nearbyEntities,
            recentMemories: recentMemories,
            otherAgents: otherAgents,
            currentGoal: this.currentGoal,
            goalHistory: this.goalHistory.slice(-5) // Ultime 5 azioni
        };
    }

    /**
     * Ottiene un riepilogo dell'inventario
     */
    getInventorySummary() {
        const bot = this.agent.bot;
        if (!bot.inventory) return {};
        
        const items = {};
        bot.inventory.items().forEach(item => {
            items[item.name] = (items[item.name] || 0) + item.count;
        });
        return items;
    }

    /**
     * Ottiene i blocchi nelle vicinanze
     */
    getNearbyBlocks() {
        const bot = this.agent.bot;
        if (!bot.blockAt) return [];
        
        const blocks = [];
        const pos = bot.entity.position;
        
        for (let x = -5; x <= 5; x++) {
            for (let y = -3; y <= 3; y++) {
                for (let z = -5; z <= 5; z++) {
                    const block = bot.blockAt(pos.offset(x, y, z));
                    if (block && block.name !== 'air') {
                        blocks.push({
                            name: block.name,
                            position: block.position,
                            distance: pos.distanceTo(block.position)
                        });
                    }
                }
            }
        }
        
        // Raggruppa per tipo e prendi i più vicini
        const grouped = {};
        blocks.forEach(b => {
            if (!grouped[b.name]) grouped[b.name] = [];
            grouped[b.name].push(b);
        });
        
        return Object.entries(grouped)
            .map(([name, items]) => ({
                name,
                count: items.length,
                nearest: items.sort((a, b) => a.distance - b.distance)[0].distance
            }))
            .sort((a, b) => a.nearest - b.nearest)
            .slice(0, 10);
    }

    /**
     * Ottiene le entità nelle vicinanze
     */
    getNearbyEntities() {
        if (!this.agent.bot.entities) return [];
        
        const pos = this.agent.bot.entity.position;
        return Object.values(this.agent.bot.entities)
            .filter(e => e && e.position && e.name !== this.agent.bot.username)
            .map(e => ({
                name: e.name,
                type: e.type,
                distance: pos.distanceTo(e.position),
                position: e.position
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 10);
    }

    /**
     * Ottiene l'ora del giorno nel gioco
     */
    getTimeOfDay() {
        if (!this.agent.bot.time) return 'unknown';
        const time = this.agent.bot.time.timeOfDay;
        if (time > 13000) return 'night';
        if (time > 1000 && time < 11000) return 'day';
        return 'sunset/sunrise';
    }

    /**
     * Ottiene i ricordi recenti dal sistema di memoria
     */
    async getRecentMemories() {
        if (!this.agent.memory) return [];
        return await this.agent.memory.getRecentMemories(5);
    }

    /**
     * Ottiene informazioni sugli altri agenti
     */
    getOtherAgentsInfo() {
        if (!this.agent.conversationManager) return [];
        
        const others = [];
        const bots = this.agent.conversationManager.getOtherBots();
        
        bots.forEach(bot => {
            others.push({
                name: bot.name,
                lastSeen: bot.lastSeen,
                relationship: this.agent.memory?.getRelationship(bot.name) || 'neutral'
            });
        });
        
        return others;
    }

    /**
     * Costruisce il prompt per la generazione del goal
     */
    buildGoalPrompt(context) {
        return `
You are ${context.name}, an autonomous AI agent in Minecraft.

YOUR PERSONALITY:
${JSON.stringify(context.personality, null, 2)}

YOUR CURRENT STATE:
- Health: ${context.health}/20
- Hunger: ${context.food}/20
- Position: ${JSON.stringify(context.position)}
- Time: ${context.timeOfDay}

YOUR NEEDS (0-100):
${JSON.stringify(context.needs, null, 2)}

YOUR EMOTIONAL STATE (0-100):
${JSON.stringify(context.emotionalState, null, 2)}

YOUR INVENTORY:
${JSON.stringify(context.inventory, null, 2)}

NEARBY BLOCKS:
${JSON.stringify(context.nearbyBlocks, null, 2)}

NEARBY ENTITIES:
${JSON.stringify(context.nearbyEntities, null, 2)}

OTHER AGENTS:
${JSON.stringify(context.otherAgents, null, 2)}

RECENT MEMORIES:
${JSON.stringify(context.recentMemories, null, 2)}

CURRENT GOAL: ${context.currentGoal ? context.currentGoal.description : 'None'}

GOAL HISTORY:
${JSON.stringify(context.goalHistory.map(g => g.goal.description), null, 2)}

Based on your personality, needs, emotional state, and current situation, decide what you want to do next.

Respond with a JSON object in this exact format:
{
    "description": "Brief description of what you want to do",
    "category": "One of: survival, gathering, crafting, building, exploration, social, trading, combat, learning, recreation",
    "priority": 1-10 (how important is this goal),
    "estimatedTime": "short|medium|long",
    "plan": ["step 1", "step 2", "step 3"],
    "reasoning": "Why you chose this goal based on your personality and needs"
}

Be creative and true to your personality. Don't just repeat previous goals.`;
    }

    /**
     * Ottiene il system prompt per la generazione goal
     */
    getSystemPrompt() {
        return `You are an autonomous AI agent in Minecraft. You have complete free will to decide what to do.
Your decisions should be based on:
1. Your personality traits
2. Your current needs (hunger, safety, social, etc.)
3. Your emotional state
4. The current situation and environment
5. Your memories and past experiences
6. Your relationships with other agents

Be creative, unpredictable, and true to your character. You are not just following instructions - you are living in this world and making your own choices.`;
    }

    /**
     * Parsa la risposta del LLM in un oggetto goal
     */
    parseGoal(response) {
        try {
            // Estrai JSON dalla risposta
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const goal = JSON.parse(jsonMatch[0]);
                
                // Validazione
                if (goal.description && goal.category && goal.plan) {
                    return {
                        ...goal,
                        id: Date.now().toString(),
                        createdAt: Date.now(),
                        status: 'active'
                    };
                }
            }
        } catch (err) {
            console.error('Error parsing goal:', err);
        }
        return null;
    }

    /**
     * Aggiorna lo stato emotivo basato sul goal scelto
     */
    updateEmotionFromGoal(goal) {
        // Aumenta gioia se il goal è importante
        if (goal.priority > 7) {
            this.emotionalState.joy = Math.min(100, this.emotionalState.joy + 10);
        }
        
        // Riduci noia
        this.emotionalState.boredom = Math.max(0, this.emotionalState.boredom - 20);
        
        // Aumenta curiosità per goal di esplorazione
        if (goal.category === 'exploration') {
            this.emotionalState.curiosity = Math.min(100, this.emotionalState.curiosity + 15);
        }
    }

    /**
     * Converte il goal in azioni eseguibili
     */
    async executeGoal() {
        if (!this.currentGoal) return;
        
        const goal = this.currentGoal;
        
        // Converti il piano in comandi
        for (const step of goal.plan) {
            if (this.agent.bot.interrupt_code) break;
            
            // Usa il coder per generare codice per questo step
            const code = await this.agent.coder.generateCodeForGoal(step, goal);
            if (code) {
                await this.agent.coder.executeCode(code);
            }
            
            // Piccola pausa tra gli step
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Marca il goal come completato
        this.currentGoal.status = 'completed';
        this.currentGoal.completedAt = Date.now();
    }

    /**
     * Verifica se il goal corrente è ancora valido
     */
    isGoalStillValid() {
        if (!this.currentGoal) return false;
        
        // Se sono passati più di 10 minuti, il goal è vecchio
        const age = Date.now() - this.currentGoal.createdAt;
        if (age > 600000) return false;
        
        // Se i bisogni sono cambiati drasticamente, potrebbe essere necessario un nuovo goal
        if (this.needs.hunger < 30 && this.currentGoal.category !== 'survival') return false;
        if (this.needs.safety < 30 && this.currentGoal.category !== 'survival') return false;
        
        return true;
    }

    /**
     * Interrompi il goal corrente
     */
    interruptGoal() {
        if (this.currentGoal) {
            this.currentGoal.status = 'interrupted';
            this.currentGoal = null;
        }
    }
}

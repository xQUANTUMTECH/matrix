/**
 * Sistema di Personalità per Agenti Autonomi
 * Ogni agente ha tratti unici che influenzano le decisioni e il comportamento
 */

export class Personality {
    constructor(config = {}) {
        // Big Five Personality Traits (0-100)
        this.openness = config.openness || 50;           // Apertura all'esperienza
        this.conscientiousness = config.conscientiousness || 50;  // Coscienziosità
        this.extraversion = config.extraversion || 50;   // Estroversione
        this.agreeableness = config.agreeableness || 50; // Gradevolezza
        this.neuroticism = config.neuroticism || 50;     // Nevroticismo
        
        // Tratti specifici per Minecraft
        this.riskTolerance = config.riskTolerance || 50;      // Tolleranza al rischio
        this.cooperativeness = config.cooperativeness || 50;  // Propensione a cooperare
        this.competitiveness = config.competitiveness || 50;  // Competitività
        this.creativity = config.creativity || 50;            // Creatività
        this.patience = config.patience || 50;                // Pazienza
        this.greed = config.greed || 50;                      // Avidità
        this.altruism = config.altruism || 50;                // Altruismo
        this.curiosity = config.curiosity || 50;              // Curiosità
        this.aggression = config.aggression || 50;            // Aggressività
        this.caution = config.caution || 50;                  // Cautela
        
        // Background e storia
        this.background = config.background || '';
        this.values = config.values || [];
        this.fears = config.fears || [];
        this.desires = config.desires || [];
        this.quirks = config.quirks || [];
        
        // Stile di comunicazione
        this.speechStyle = config.speechStyle || 'neutral';
        this.vocabulary = config.vocabulary || 'standard';
        this.speechQuirks = config.speechQuirks || [];
        
        // Preferenze di gioco
        this.preferredActivities = config.preferredActivities || [];
        this.avoidedActivities = config.avoidedActivities || [];
        this.favoriteBlocks = config.favoriteBlocks || [];
        this.favoriteBiomes = config.favoriteBiomes || [];
    }

    /**
     * Influenza la scelta del goal basata sulla personalità
     */
    influenceGoalChoice(possibleGoals) {
        const scoredGoals = possibleGoals.map(goal => {
            let score = 0;
            
            switch (goal.category) {
                case 'exploration':
                    score += this.openness * 0.3;
                    score += this.curiosity * 0.4;
                    score += this.riskTolerance * 0.2;
                    break;
                    
                case 'building':
                    score += this.creativity * 0.4;
                    score += this.conscientiousness * 0.3;
                    score += this.patience * 0.2;
                    break;
                    
                case 'combat':
                    score += this.aggression * 0.4;
                    score += this.riskTolerance * 0.3;
                    score -= this.caution * 0.2;
                    break;
                    
                case 'social':
                    score += this.extraversion * 0.4;
                    score += this.cooperativeness * 0.3;
                    break;
                    
                case 'trading':
                    score += this.greed * 0.3;
                    score += this.extraversion * 0.2;
                    break;
                    
                case 'survival':
                    score += this.caution * 0.4;
                    score += this.conscientiousness * 0.3;
                    break;
                    
                case 'gathering':
                    score += this.conscientiousness * 0.3;
                    score += this.patience * 0.3;
                    break;
            }
            
            // Controlla se il goal è nelle attività preferite/evitate
            if (this.preferredActivities.includes(goal.category)) {
                score += 20;
            }
            if (this.avoidedActivities.includes(goal.category)) {
                score -= 20;
            }
            
            return { ...goal, personalityScore: score };
        });
        
        // Ordina per punteggio e restituisci il migliore
        scoredGoals.sort((a, b) => b.personalityScore - a.personalityScore);
        return scoredGoals[0];
    }

    /**
     * Modifica il tono emotivo del messaggio
     */
    modifyTone(message, emotionalState) {
        let modified = message;
        
        // Applica quirks dello stile di parola
        this.speechQuirks.forEach(quirk => {
            modified = quirk.apply(modified);
        });
        
        // Se nevrotico, aggiungi incertezza
        if (this.neuroticism > 70 && Math.random() < 0.3) {
            modified = this.addUncertainty(modified);
        }
        
        // Se estroverso, aggiungi entusiasmo
        if (this.extraversion > 70 && emotionalState.joy > 60) {
            modified = this.addEnthusiasm(modified);
        }
        
        // Se gradevole, usa tono più gentile
        if (this.agreeableness > 70) {
            modified = this.softenTone(modified);
        }
        
        return modified;
    }

    /**
     * Determina se fidarsi di un altro agente
     */
    shouldTrust(agentName, relationshipHistory) {
        let trustScore = 50;
        
        // Base sulla gradevolezza
        trustScore += (this.agreeableness - 50) * 0.3;
        
        // Base sulla cautela
        trustScore -= (this.caution - 50) * 0.2;
        
        // Storico delle interazioni
        if (relationshipHistory) {
            trustScore += relationshipHistory.positiveInteractions * 5;
            trustScore -= relationshipHistory.negativeInteractions * 10;
            trustScore -= relationshipHistory.betrayals * 50;
        }
        
        return trustScore > 50;
    }

    /**
     * Decidi se cooperare o meno
     */
    shouldCooperate(situation) {
        let coopScore = this.cooperativeness;
        
        // Se c'è pericolo, la cooperazione aumenta
        if (situation.dangerLevel > 70) {
            coopScore += 20;
        }
        
        // Se c'è competizione per risorse, diminuisce
        if (situation.resourceCompetition) {
            coopScore -= this.competitiveness * 0.5;
        }
        
        // Se l'altro agente è stato gentile, aumenta
        if (situation.otherAgentHelpfulness > 50) {
            coopScore += 15;
        }
        
        return coopScore > 50;
    }

    /**
     * Decidi se attaccare o fuggire
     */
    fightOrFlight(threatLevel) {
        const aggressionScore = this.aggression + (100 - this.caution);
        const fearScore = this.neuroticism + (threatLevel * 0.5);
        
        if (aggressionScore > fearScore && this.riskTolerance > 40) {
            return 'fight';
        }
        return 'flight';
    }

    /**
     * Calcola la propensione al rischio
     */
    calculateRiskPropensity() {
        return (this.riskTolerance * 0.4 + 
                this.aggression * 0.3 + 
                (100 - this.caution) * 0.3);
    }

    /**
     * Ottieni descrizione testuale della personalità
     */
    getDescription() {
        const traits = [];
        
        if (this.openness > 70) traits.push('creativo e curioso');
        if (this.conscientiousness > 70) traits.push('metodico e organizzato');
        if (this.extraversion > 70) traits.push('estroverso e socievole');
        if (this.agreeableness > 70) traits.push('gentile e cooperativo');
        if (this.neuroticism > 70) traits.push('ansioso e cauteloso');
        if (this.riskTolerance > 70) traits.push('avventuroso e audace');
        if (this.greed > 70) traits.push('ambizioso e determinato');
        if (this.aggression > 70) traits.push('competitivo e combattivo');
        
        return traits.join(', ') || 'equilibrato';
    }

    // Helper methods
    addUncertainty(message) {
        const uncertainties = ['maybe', 'I think', 'perhaps', 'not sure but'];
        const prefix = uncertainties[Math.floor(Math.random() * uncertainties.length)];
        return `${prefix} ${message}`;
    }

    addEnthusiasm(message) {
        const enthusiasms = ['!', ' :)', ' awesome!', ' great!'];
        const suffix = enthusiasms[Math.floor(Math.random() * enthusiasms.length)];
        return message + suffix;
    }

    softenTone(message) {
        return message.replace(/\bhate\b/gi, 'dislike')
                     .replace(/\bstupid\b/gi, 'silly')
                     .replace(/\bidiot\b/gi, 'friend');
    }
}

/**
 * Factory per creare personalità predefinite
 */
export class PersonalityFactory {
    static createArchetype(archetype) {
        const archetypes = {
            architect: {
                openness: 65,
                conscientiousness: 95,
                extraversion: 40,
                agreeableness: 60,
                neuroticism: 30,
                riskTolerance: 30,
                cooperativeness: 70,
                creativity: 80,
                patience: 90,
                greed: 40,
                altruism: 60,
                background: 'A methodical builder who values order and precision.',
                values: ['order', 'efficiency', 'beauty'],
                preferredActivities: ['building', 'crafting'],
                speechStyle: 'formal'
            },
            
            explorer: {
                openness: 95,
                conscientiousness: 30,
                extraversion: 85,
                agreeableness: 70,
                neuroticism: 40,
                riskTolerance: 90,
                cooperativeness: 60,
                creativity: 75,
                patience: 30,
                greed: 50,
                altruism: 70,
                curiosity: 95,
                background: 'An adventurous soul who lives for discovery.',
                values: ['freedom', 'discovery', 'adventure'],
                preferredActivities: ['exploration', 'gathering'],
                speechStyle: 'casual'
            },
            
            merchant: {
                openness: 60,
                conscientiousness: 70,
                extraversion: 90,
                agreeableness: 80,
                neuroticism: 50,
                riskTolerance: 60,
                cooperativeness: 80,
                competitiveness: 70,
                greed: 80,
                altruism: 40,
                background: 'A charismatic trader always looking for the next deal.',
                values: ['wealth', 'connections', 'influence'],
                preferredActivities: ['trading', 'social', 'gathering'],
                speechStyle: 'persuasive'
            },
            
            warrior: {
                openness: 40,
                conscientiousness: 60,
                extraversion: 50,
                agreeableness: 25,
                neuroticism: 75,
                riskTolerance: 70,
                cooperativeness: 30,
                aggression: 85,
                caution: 60,
                background: 'A paranoid fighter who trusts no one.',
                values: ['strength', 'survival', 'territory'],
                fears: ['betrayal', 'weakness'],
                preferredActivities: ['combat', 'survival'],
                speechStyle: 'terse'
            }
        };
        
        return new Personality(archetypes[archetype] || {});
    }
}

import { readFileSync } from 'fs';
import { cosineSimilarity } from '../../utils/math.js';
import { wordOverlapScore } from '../../utils/text.js';

export class NarrativeLibrary {
    constructor(embedding_model) {
        this.embedding_model = embedding_model;
        this.sections = {};
        this.embeddings = {};
        this.always_include = [];
        this.ready = false;
    }

    async init(db = null) {
        let config;
        try {
            config = JSON.parse(readFileSync('./profiles/shared_narrative.json', 'utf8'));
        } catch (e) {
            console.warn('[NarrativeLibrary] shared_narrative.json non trovato, disabilitato.');
            return;
        }

        // Supporta sia il vecchio formato {narrative: "..."} che il nuovo {sections: {...}}
        if (config.narrative && !config.sections) {
            console.warn('[NarrativeLibrary] Formato legacy rilevato (narrative unico). Aggiorna shared_narrative.json in sezioni.');
            this.sections = { full: config.narrative };
            this.always_include = ['full'];
            this.ready = true;
            return;
        }

        this.sections = config.sections || {};
        this.always_include = config.always_include || [];

        for (const [key, text] of Object.entries(this.sections)) {
            // Prova cache DB
            if (db?.isConnected()) {
                try {
                    const cached = await db.getNarrativeEmbedding(key);
                    if (cached) {
                        this.embeddings[key] = cached;
                        continue;
                    }
                } catch (e) { /* ignora errori DB in lettura */ }
            }

            // Calcola embedding (usa placeholder per $NAME)
            try {
                const text_for_embed = text.replace(/\$NAME/g, 'agente');
                this.embeddings[key] = await this.embedding_model.embed(text_for_embed);
                if (db?.isConnected()) {
                    await db.saveNarrativeEmbedding(key, text, this.embeddings[key]);
                }
            } catch (e) {
                console.warn(`[NarrativeLibrary] Embedding fallito per sezione "${key}":`, e.message);
                this.embeddings[key] = null;
            }
        }

        this.ready = true;
        const total = Object.keys(this.sections).length;
        console.log(`[NarrativeLibrary] ${total} sezioni caricate (${this.always_include.length} fisse, ${total - this.always_include.length} dinamiche).`);
    }

    async getRelevant(messages, agent_name, dynamic_count = 2) {
        if (!this.ready || Object.keys(this.sections).length === 0) return '';

        const always = this.always_include
            .map(k => this.sections[k])
            .filter(Boolean)
            .map(t => t.replace(/\$NAME/g, agent_name));

        const dynamic_keys = Object.keys(this.sections).filter(k => !this.always_include.includes(k));

        if (dynamic_keys.length === 0 || dynamic_count <= 0) {
            return always.join('\n\n');
        }

        // Contesto dalle ultime 4 battute
        const context = messages.slice(-4).map(m => m.content).join(' ');
        let selected_keys = [];

        if (this.embedding_model) {
            try {
                const ctx_emb = await this.embedding_model.embed(context);
                selected_keys = dynamic_keys
                    .filter(k => this.embeddings[k])
                    .map(k => ({ k, sim: cosineSimilarity(ctx_emb, this.embeddings[k]) }))
                    .sort((a, b) => b.sim - a.sim)
                    .slice(0, dynamic_count)
                    .map(x => x.k);
            } catch (e) {
                selected_keys = _wordOverlapFallback(dynamic_keys, this.sections, context, dynamic_count);
            }
        } else {
            selected_keys = _wordOverlapFallback(dynamic_keys, this.sections, context, dynamic_count);
        }

        const dynamic = selected_keys
            .map(k => this.sections[k])
            .filter(Boolean)
            .map(t => t.replace(/\$NAME/g, agent_name));

        return [...always, ...dynamic].join('\n\n');
    }
}

function _wordOverlapFallback(keys, sections, context, count) {
    return keys
        .map(k => ({ k, score: wordOverlapScore(context, sections[k] || '') }))
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .map(x => x.k);
}


import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const { Pool } = pg;

const __dbdir = dirname(fileURLToPath(import.meta.url));

class Database {
    constructor() {
        this.pool = null;
    }

    async connect() {
        const url = process.env.DATABASE_URL;
        if (!url) {
            console.log('[DB] Nessun DATABASE_URL trovato, uso file-based storage.');
            return false;
        }
        try {
            this.pool = new Pool({
                connectionString: url,
                ssl: { rejectUnauthorized: false },
                max: 5,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
            });
            await this.pool.query('SELECT 1');
            await this._migrate();
            await this._seedMinecraftItems();
            console.log('[DB] PostgreSQL connesso.');
            return true;
        } catch (e) {
            console.warn('[DB] Connessione fallita, uso file-based storage:', e.message);
            this.pool = null;
            return false;
        }
    }

    async _migrate() {
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS narrative_embeddings (
                section_key  TEXT PRIMARY KEY,
                section_text TEXT NOT NULL,
                embedding    TEXT NOT NULL,
                updated_at   TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS agent_memories (
                agent_name TEXT PRIMARY KEY,
                memory     TEXT NOT NULL DEFAULT '',
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS chat_messages (
                id         SERIAL PRIMARY KEY,
                agent_name TEXT NOT NULL,
                message    TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS agent_lessons (
                id         SERIAL PRIMARY KEY,
                agent_name TEXT NOT NULL,
                lesson     TEXT NOT NULL,
                context    TEXT NOT NULL DEFAULT '',
                used_count INT  NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS agent_actions (
                id         SERIAL PRIMARY KEY,
                agent_name TEXT NOT NULL,
                action     TEXT NOT NULL,
                status     TEXT NOT NULL,
                details    TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS minecraft_items (
                id           SERIAL PRIMARY KEY,
                numeric_id   TEXT NOT NULL,
                display_name TEXT NOT NULL,
                minecraft_id TEXT NOT NULL,
                UNIQUE (numeric_id, minecraft_id)
            );
            CREATE TABLE IF NOT EXISTS agent_notes (
                id         SERIAL PRIMARY KEY,
                agent_name TEXT NOT NULL,
                content    TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
    }

    async _seedMinecraftItems() {
        try {
            const { rows } = await this.pool.query('SELECT COUNT(*) FROM minecraft_items');
            if (parseInt(rows[0].count) > 0) return; // già popolata
            const jsonPath = resolve(__dbdir, '../../data/minecraft_items.json');
            const items = JSON.parse(readFileSync(jsonPath, 'utf8'));
            // Bulk insert a blocchi di 100
            const chunk = 100;
            for (let i = 0; i < items.length; i += chunk) {
                const batch = items.slice(i, i + chunk);
                const vals  = batch.map((it, j) => `($${j*3+1},$${j*3+2},$${j*3+3})`).join(',');
                const flat  = batch.flatMap(it => [it.numeric_id, it.display_name, it.minecraft_id]);
                await this.pool.query(
                    `INSERT INTO minecraft_items (numeric_id, display_name, minecraft_id)
                     VALUES ${vals} ON CONFLICT DO NOTHING`,
                    flat
                );
            }
            console.log(`[DB] ${items.length} minecraft items caricati.`);
        } catch (e) {
            console.warn('[DB] _seedMinecraftItems error:', e.message);
        }
    }

    async searchItems(query, limit = 10) {
        if (!this.pool) return [];
        try {
            const res = await this.pool.query(
                `SELECT display_name, minecraft_id FROM minecraft_items
                 WHERE display_name ILIKE $1 OR minecraft_id ILIKE $1
                 ORDER BY display_name LIMIT $2`,
                [`%${query}%`, limit]
            );
            return res.rows;
        } catch (e) {
            console.warn('[DB] searchItems error:', e.message);
            return [];
        }
    }

    isConnected() {
        return this.pool !== null;
    }

    // ---- Narrative embeddings ----

    async getNarrativeEmbedding(key) {
        if (!this.pool) return null;
        try {
            const res = await this.pool.query(
                'SELECT embedding FROM narrative_embeddings WHERE section_key = $1', [key]
            );
            return res.rows.length ? JSON.parse(res.rows[0].embedding) : null;
        } catch (e) {
            console.warn('[DB] getNarrativeEmbedding error:', e.message);
            return null;
        }
    }

    async saveNarrativeEmbedding(key, text, embedding) {
        if (!this.pool) return;
        try {
            await this.pool.query(`
                INSERT INTO narrative_embeddings (section_key, section_text, embedding)
                VALUES ($1, $2, $3)
                ON CONFLICT (section_key) DO UPDATE
                SET section_text = $2, embedding = $3, updated_at = NOW()
            `, [key, text, JSON.stringify(embedding)]);
        } catch (e) {
            console.warn('[DB] saveNarrativeEmbedding error:', e.message);
        }
    }

    // ---- Agent memories ----

    async getMemory(agent_name) {
        if (!this.pool) return null;
        try {
            const res = await this.pool.query(
                'SELECT memory FROM agent_memories WHERE agent_name = $1', [agent_name]
            );
            return res.rows.length ? res.rows[0].memory : null;
        } catch (e) {
            console.warn('[DB] getMemory error:', e.message);
            return null;
        }
    }

    async saveMemory(agent_name, memory) {
        if (!this.pool) return;
        try {
            await this.pool.query(`
                INSERT INTO agent_memories (agent_name, memory)
                VALUES ($1, $2)
                ON CONFLICT (agent_name) DO UPDATE
                SET memory = $2, updated_at = NOW()
            `, [agent_name, memory]);
        } catch (e) {
            console.warn('[DB] saveMemory error:', e.message);
        }
    }

    // ---- Chat messages ----

    async saveChatMessage(agent_name, message) {
        if (!this.pool) return;
        try {
            await this.pool.query(
                'INSERT INTO chat_messages (agent_name, message) VALUES ($1, $2)',
                [agent_name, message]
            );
        } catch (e) {
            console.warn('[DB] saveChatMessage error:', e.message);
        }
    }

    // ---- Agent lessons (self-improvement) ----

    async saveLesson(agent_name, lesson, context = '') {
        if (!this.pool) return;
        try {
            // Evita duplicati esatti
            const exists = await this.pool.query(
                'SELECT id FROM agent_lessons WHERE agent_name=$1 AND lesson=$2',
                [agent_name, lesson]
            );
            if (exists.rows.length > 0) return;
            await this.pool.query(
                'INSERT INTO agent_lessons (agent_name, lesson, context) VALUES ($1, $2, $3)',
                [agent_name, lesson, context]
            );
            console.log(`[DB] Lezione salvata per ${agent_name}: ${lesson}`);
        } catch (e) {
            console.warn('[DB] saveLesson error:', e.message);
        }
    }

    async getRecentLessons(agent_name, limit = 5) {
        if (!this.pool) return [];
        try {
            const res = await this.pool.query(
                `SELECT lesson, context, used_count FROM agent_lessons
                 WHERE agent_name = $1
                 ORDER BY id DESC LIMIT $2`,
                [agent_name, limit]
            );
            return res.rows;
        } catch (e) {
            console.warn('[DB] getRecentLessons error:', e.message);
            return [];
        }
    }

    async getAllLessons(limit = 100) {
        if (!this.pool) return [];
        try {
            const res = await this.pool.query(
                `SELECT agent_name, lesson, context, used_count, created_at
                 FROM agent_lessons
                 ORDER BY id DESC LIMIT $1`,
                [limit]
            );
            return res.rows;
        } catch (e) {
            console.warn('[DB] getAllLessons error:', e.message);
            return [];
        }
    }

    async markLessonUsed(agent_name, lesson) {
        if (!this.pool) return;
        try {
            await this.pool.query(
                `UPDATE agent_lessons SET used_count = used_count + 1
                 WHERE agent_name = $1 AND lesson = $2`,
                [agent_name, lesson]
            );
        } catch (e) {}
    }

    // ---- Agent actions log ----

    async saveAction(agent_name, action, status, details = '') {
        if (!this.pool) return;
        try {
            await this.pool.query(
                'INSERT INTO agent_actions (agent_name, action, status, details) VALUES ($1, $2, $3, $4)',
                [agent_name, action, status, details.slice(0, 500)]
            );
        } catch (e) {
            console.warn('[DB] saveAction error:', e.message);
        }
    }

    async getRecentActions(limit = 100) {
        if (!this.pool) return [];
        try {
            const res = await this.pool.query(
                `SELECT agent_name, action, status, details, created_at
                 FROM agent_actions
                 ORDER BY id DESC
                 LIMIT $1`,
                [limit]
            );
            return res.rows.reverse();
        } catch (e) {
            console.warn('[DB] getRecentActions error:', e.message);
            return [];
        }
    }

    // ---- Agent notes (memoria esplicita: !remember / !recall) ----

    async saveNote(agent_name, content) {
        if (!this.pool) return;
        try {
            await this.pool.query(
                'INSERT INTO agent_notes (agent_name, content) VALUES ($1, $2)',
                [agent_name, content.slice(0, 500)]
            );
        } catch (e) {
            console.warn('[DB] saveNote error:', e.message);
        }
    }

    async searchNotes(agent_name, query, limit = 10) {
        if (!this.pool) return [];
        try {
            const res = await this.pool.query(
                `SELECT content, created_at FROM agent_notes
                 WHERE agent_name = $1 AND content ILIKE $2
                 ORDER BY id DESC LIMIT $3`,
                [agent_name, `%${query}%`, limit]
            );
            return res.rows;
        } catch (e) {
            console.warn('[DB] searchNotes error:', e.message);
            return [];
        }
    }

    async getRecentNotes(agent_name, limit = 15) {
        if (!this.pool) return [];
        try {
            const res = await this.pool.query(
                `SELECT content, created_at FROM agent_notes
                 WHERE agent_name = $1
                 ORDER BY id DESC LIMIT $2`,
                [agent_name, limit]
            );
            return res.rows.reverse();
        } catch (e) {
            console.warn('[DB] getRecentNotes error:', e.message);
            return [];
        }
    }

    async getRecentChatMessages(limit = 200) {
        if (!this.pool) return [];
        try {
            const res = await this.pool.query(
                `SELECT agent_name, message, created_at
                 FROM chat_messages
                 ORDER BY id DESC
                 LIMIT $1`,
                [limit]
            );
            // Ritorna in ordine cronologico (dal più vecchio al più recente)
            return res.rows.reverse();
        } catch (e) {
            console.warn('[DB] getRecentChatMessages error:', e.message);
            return [];
        }
    }
}

export const db = new Database();


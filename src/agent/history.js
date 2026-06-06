import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { NPCData } from './npc/data.js';
import settings from './settings.js';


export class History {
    constructor(agent) {
        this.agent = agent;
        this.name = agent.name;
        this.memory_fp = `./bots/${this.name}/memory.json`;
        this.full_history_fp = undefined;

        mkdirSync(`./bots/${this.name}/histories`, { recursive: true });

        this.turns = [];

        // Natural language memory as a summary of recent messages + previous memory
        this.memory = '';

        // Maximum number of messages to keep in context before saving chunk to memory
        this.max_messages = settings.max_messages;

        // Number of messages to remove from current history and save into memory
        this.summary_chunk_size = 10;
        // chunking reduces expensive calls to promptMemSaving and appendFullHistory
        // and improves the quality of the memory summary
    }

    getHistory() { // expects an Examples object
        return JSON.parse(JSON.stringify(this.turns));
    }

    async summarizeMemories(turns) {
        console.log("Storing memories...");
        this.memory = await this.agent.prompter.promptMemSaving(turns);

        if (this.memory.length > 1500) {
            this.memory = this.memory.slice(0, 1500);
            this.memory += '...(Memoria compressa a 1500 caratteri. Comprimi di più la prossima volta.)';
        }

        console.log("Memory updated to: ", this.memory);

        // Persisti subito su DB dopo ogni summary, non aspettare il save()
        try {
            const { db } = await import('../db/db.js');
            if (db.isConnected()) await db.saveMemory(this.name, this.memory);
        } catch (_) {}
    }

    async appendFullHistory(to_store) {
        if (this.full_history_fp === undefined) {
            const string_timestamp = new Date().toLocaleString().replace(/[/:]/g, '-').replace(/ /g, '').replace(/,/g, '_');
            this.full_history_fp = `./bots/${this.name}/histories/${string_timestamp}.json`;
            writeFileSync(this.full_history_fp, '[]', 'utf8');
        }
        try {
            const data = readFileSync(this.full_history_fp, 'utf8');
            let full_history = JSON.parse(data);
            full_history.push(...to_store);
            writeFileSync(this.full_history_fp, JSON.stringify(full_history, null, 4), 'utf8');
        } catch (err) {
            console.error(`Error reading ${this.name}'s full history file: ${err.message}`);
        }
    }

    async add(name, content) {
        let role = 'assistant';
        if (name === 'system') {
            role = 'system';
        }
        else if (name !== this.name) {
            role = 'user';
            content = `${name}: ${content}`;
        }
        this.turns.push({role, content});

        if (this.turns.length >= this.max_messages) {
            let chunk = this.turns.splice(0, this.summary_chunk_size);
            while (this.turns.length > 0 && this.turns[0].role === 'assistant')
                chunk.push(this.turns.shift()); // remove until turns starts with system/user message

            await this.summarizeMemories(chunk);
            await this.appendFullHistory(chunk);
        }
    }

    async save() {
        try {
            const data = {
                memory: this.memory,
                turns: this.turns,
                self_prompting_state: this.agent.self_prompter.state,
                self_prompt: this.agent.self_prompter.isStopped() ? null : this.agent.self_prompter.prompt,
                taskStart: this.agent.task.taskStartTime,
                last_sender: this.agent.last_sender
            };
            writeFileSync(this.memory_fp, JSON.stringify(data, null, 2));
            // Persisti la memoria anche su DB se disponibile
            try {
                const { db } = await import('../db/db.js');
                if (db.isConnected()) await db.saveMemory(this.name, this.memory);
            } catch (_) {}
            console.log('Saved memory to:', this.memory_fp);
        } catch (error) {
            console.error('Failed to save history:', error);
            throw error;
        }
    }

    async load() {
        // Prova prima a caricare dal file locale
        try {
            if (existsSync(this.memory_fp)) {
                const data = JSON.parse(readFileSync(this.memory_fp, 'utf8'));
                this.memory = data.memory || '';
                this.turns = data.turns || [];
                console.log('Loaded memory from file:', this.memory);
                return data;
            }
        } catch (error) {
            console.error('Failed to load history from file:', error);
        }

        // Se non c'è file (es. deploy Railway con fs effimero), prova DB
        try {
            const { db } = await import('../db/db.js');
            if (db.isConnected()) {
                const mem = await db.getMemory(this.name);
                if (mem) {
                    this.memory = mem;
                    console.log('Loaded memory from DB:', this.memory);
                    return { memory: this.memory, turns: [] };
                }
            }
        } catch (_) {}

        console.log('No memory found.');
        return null;
    }

    clear() {
        this.turns = [];
        this.memory = '';
    }
}
-- Schema Database per Agenti AI Autonomi
-- Compatibile con PostgreSQL (Railway) e SQLite (locale)

-- Tabella conversazioni
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    speaker VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    location VARCHAR(255),
    emotional_tone VARCHAR(50),
    importance INTEGER DEFAULT 5
);

-- Tabella esperienze/memorie episodiche
CREATE TABLE IF NOT EXISTS experiences (
    id SERIAL PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255),
    outcome TEXT,
    emotional_impact INTEGER,
    lessons_learned TEXT
);

-- Tabella relazioni con altri agenti
CREATE TABLE IF NOT EXISTS relationships (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR(255) NOT NULL UNIQUE,
    trust_level INTEGER DEFAULT 50,
    affinity INTEGER DEFAULT 50,
    interactions_count INTEGER DEFAULT 0,
    positive_interactions INTEGER DEFAULT 0,
    negative_interactions INTEGER DEFAULT 0,
    betrayals INTEGER DEFAULT 0,
    last_interaction BIGINT,
    notes TEXT
);

-- Tabella conoscenze (memoria semantica)
CREATE TABLE IF NOT EXISTS knowledge (
    id SERIAL PRIMARY KEY,
    topic VARCHAR(255) NOT NULL,
    fact TEXT NOT NULL,
    confidence INTEGER DEFAULT 80,
    source VARCHAR(255),
    last_verified BIGINT
);

-- Tabella accordi e contratti
CREATE TABLE IF NOT EXISTS agreements (
    id SERIAL PRIMARY KEY,
    created_at BIGINT NOT NULL,
    with_agent VARCHAR(255) NOT NULL,
    terms TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    completed_at BIGINT,
    violated BOOLEAN DEFAULT FALSE
);

-- Tabella inventario storico
CREATE TABLE IF NOT EXISTS inventory_history (
    id SERIAL PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity INTEGER,
    action VARCHAR(100) NOT NULL,
    location VARCHAR(255)
);

-- Tabella goal completati
CREATE TABLE IF NOT EXISTS goals_history (
    id SERIAL PRIMARY KEY,
    created_at BIGINT NOT NULL,
    completed_at BIGINT,
    description TEXT NOT NULL,
    category VARCHAR(100),
    priority INTEGER,
    status VARCHAR(50),
    outcome TEXT
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_conversations_time ON conversations(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversations_speaker ON conversations(speaker);
CREATE INDEX IF NOT EXISTS idx_experiences_category ON experiences(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_topic ON knowledge(topic);
CREATE INDEX IF NOT EXISTS idx_relationships_agent ON relationships(agent_name);
CREATE INDEX IF NOT EXISTS idx_agreements_status ON agreements(status);

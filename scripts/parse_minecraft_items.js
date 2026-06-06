/**
 * Parsa all-minecraft-items.md e genera mindcraft/data/minecraft_items.json
 * Formato riga: [spazi–]ID[:]subtype # Display Name (minecraft:id)
 * Esegui con: node mindcraft/scripts/parse_minecraft_items.js
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mdPath  = resolve(__dirname, '../../all-minecraft-items.md');
const outDir  = resolve(__dirname, '../data');
const outPath = resolve(outDir, 'minecraft_items.json');

const content = readFileSync(mdPath, 'utf8');
const lines   = content.split('\n');

// Matcha: opzionali spazi/dash/em-dash, poi ID#subtype, spazio, #, nome, (minecraft:id)
const lineRe = /^[\s\-–]*(\d+(?::\d+)?)\s+#\s+(.+?)\s+\(minecraft:([^)]+)\)/;

const items = [];
const seen  = new Set();

for (const line of lines) {
    const m = line.match(lineRe);
    if (!m) continue;
    const numeric_id   = m[1].trim();
    const display_name = m[2].trim();
    const minecraft_id = 'minecraft:' + m[3].trim();
    const key = `${numeric_id}|${minecraft_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ numeric_id, display_name, minecraft_id });
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(items, null, 2), 'utf8');
console.log(`✓ ${items.length} items scritti in ${outPath}`);


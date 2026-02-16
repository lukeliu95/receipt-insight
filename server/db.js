import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Turso (production) vs local SQLite (dev)
const isProduction = !!process.env.TURSO_DATABASE_URL;

let db;

if (isProduction) {
    db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });
    console.log('[DB] Connected to Turso (production)');
} else {
    const dataDir = path.join(__dirname, '../data');
    fs.ensureDirSync(dataDir);
    const dbPath = path.join(dataDir, 'receipts.db');
    db = createClient({ url: `file:${dbPath}` });
    console.log(`[DB] Using local SQLite: ${dbPath}`);
}

// Initialize schema
export async function initDB() {
    await db.executeMultiple(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            passwordHash TEXT NOT NULL,
            createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS receipts (
            id TEXT PRIMARY KEY,
            userId TEXT,
            storeName TEXT,
            date TEXT,
            total REAL,
            currency TEXT,
            imageUrl TEXT,
            status TEXT,
            createdAt TEXT,
            analysis TEXT,
            FOREIGN KEY(userId) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            receiptId TEXT,
            name TEXT,
            price REAL,
            description TEXT,
            nutrition TEXT,
            details TEXT,
            FOREIGN KEY(receiptId) REFERENCES receipts(id)
        );

        CREATE TABLE IF NOT EXISTS reports (
            userId TEXT NOT NULL,
            period TEXT NOT NULL,
            content TEXT,
            updatedAt TEXT,
            PRIMARY KEY(userId, period)
        );
    `);

    // Migrations: add columns if missing
    try {
        const tableInfo = await db.execute("PRAGMA table_info(receipts)");
        const columns = tableInfo.rows.map(r => r.name);
        if (!columns.includes('userId')) {
            await db.execute('ALTER TABLE receipts ADD COLUMN userId TEXT');
        }
        if (!columns.includes('analysis')) {
            await db.execute('ALTER TABLE receipts ADD COLUMN analysis TEXT');
        }
    } catch (e) {
        console.log('[DB] Migration check:', e.message);
    }

    console.log('[DB] Schema initialized');
}

export default db;

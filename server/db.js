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

// Initialize schema — single batch call to minimize cold start latency
export async function initDB() {
    // One batch: create tables + index. All use IF NOT EXISTS so safe to re-run.
    await db.batch([
        {
            sql: `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                passwordHash TEXT NOT NULL,
                createdAt TEXT NOT NULL
            )`, args: []
        },
        {
            sql: `CREATE TABLE IF NOT EXISTS receipts (
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
                imageHash TEXT,
                FOREIGN KEY(userId) REFERENCES users(id)
            )`, args: []
        },
        {
            sql: `CREATE TABLE IF NOT EXISTS items (
                id TEXT PRIMARY KEY,
                receiptId TEXT,
                name TEXT,
                price REAL,
                description TEXT,
                nutrition TEXT,
                details TEXT,
                FOREIGN KEY(receiptId) REFERENCES receipts(id)
            )`, args: []
        },
        {
            sql: `CREATE TABLE IF NOT EXISTS reports (
                userId TEXT NOT NULL,
                period TEXT NOT NULL,
                content TEXT,
                updatedAt TEXT,
                PRIMARY KEY(userId, period)
            )`, args: []
        },
        {
            sql: `CREATE INDEX IF NOT EXISTS idx_receipts_hash ON receipts(userId, imageHash)`,
            args: []
        }
    ]);

    // Migrations: add columns if missing (one round trip to check, one batch to fix)
    try {
        const tableInfo = await db.execute("PRAGMA table_info(receipts)");
        const columns = new Set(tableInfo.rows.map(r => r.name));
        const migrations = [];
        if (!columns.has('userId')) migrations.push({ sql: 'ALTER TABLE receipts ADD COLUMN userId TEXT', args: [] });
        if (!columns.has('analysis')) migrations.push({ sql: 'ALTER TABLE receipts ADD COLUMN analysis TEXT', args: [] });
        if (!columns.has('imageHash')) migrations.push({ sql: 'ALTER TABLE receipts ADD COLUMN imageHash TEXT', args: [] });
        if (migrations.length > 0) await db.batch(migrations);
    } catch (e) {
        console.log('[DB] Migration check:', e.message);
    }

    console.log('[DB] Schema initialized');
}

export default db;

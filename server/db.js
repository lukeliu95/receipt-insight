import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Handle Vercel's ephemeral file system
const isVercel = process.env.VERCEL === '1';
const dataDir = isVercel ? '/tmp' : path.join(__dirname, '../data');

// Ensure data directory exists (only for local)
if (!isVercel) {
    fs.ensureDirSync(dataDir);
}

const dbPath = path.join(dataDir, 'receipts.db');
const db = new Database(dbPath);

// Initialize Schema
db.exec(`
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
`);

// Migrations
const tableInfo = db.prepare("PRAGMA table_info(receipts)").all();
const hasUserId = tableInfo.some(col => col.name === 'userId');
if (!hasUserId) {
  db.exec('ALTER TABLE receipts ADD COLUMN userId TEXT');
}
const hasAnalysis = tableInfo.some(col => col.name === 'analysis');
if (!hasAnalysis) {
  db.exec('ALTER TABLE receipts ADD COLUMN analysis TEXT');
}

export default db;

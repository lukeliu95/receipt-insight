import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import db, { initDB } from './db.js';
import dayjs from 'dayjs';
import { hashPassword, comparePassword, generateToken, authMiddleware, generateId } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

const isVercel = process.env.VERCEL === '1';
const isProduction = !!process.env.TURSO_DATABASE_URL;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Static uploads (local dev only)
if (!isProduction) {
    app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}

// Initialize DB before handling requests
let dbReady = false;
const ensureDB = async () => {
    if (!dbReady) {
        await initDB();
        dbReady = true;
    }
};

// Middleware: ensure DB is initialized
app.use(async (req, res, next) => {
    try {
        await ensureDB();
        next();
    } catch (error) {
        console.error('[DB Init Error]', error);
        res.status(500).json({ error: 'Database initialization failed' });
    }
});

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const id = generateId();
        const passwordHash = await hashPassword(password);
        const createdAt = new Date().toISOString();

        await db.execute({
            sql: 'INSERT INTO users (id, email, passwordHash, createdAt) VALUES (?, ?, ?, ?)',
            args: [id, email, passwordHash, createdAt]
        });

        const token = generateToken(id);
        res.json({ user: { id, email, createdAt }, token });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const countResult = await db.execute('SELECT count(*) as count FROM users');
        const userCount = countResult.rows[0].count;
        console.log(`[Login Attempt] Email: ${email}, Total Users in DB: ${userCount}`);

        const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
        const user = result.rows[0];

        if (!user) {
            if (userCount === 0) {
                return res.status(401).json({ error: 'Database is empty. Please register first.' });
            }
            return res.status(401).json({ error: 'User not found. Please register.' });
        }

        const isValidPassword = await comparePassword(password, user.passwordHash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        const token = generateToken(user.id);
        res.json({
            user: { id: user.id, email: user.email, createdAt: user.createdAt },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req, res) => {
    const result = await db.execute({ sql: 'SELECT id, email, createdAt FROM users WHERE id = ?', args: [req.userId] });
    const user = result.rows[0];
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
});

// ==================== RECEIPT ROUTES (Protected) ====================

// Save image to disk (local dev only)
const saveImageToDisk = async (base64Data, dateStr) => {
    const date = dayjs(dateStr);
    const dir = path.join(__dirname, '../uploads', date.format('YYYY'), date.format('MM'), date.format('DD'));
    await fs.ensureDir(dir);

    const fileName = `receipt_${Date.now()}.webp`;
    const filePath = path.join(dir, fileName);

    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, "");
    await fs.writeFile(filePath, base64Image, 'base64');

    return `/uploads/${date.format('YYYY')}/${date.format('MM')}/${date.format('DD')}/${fileName}`;
};

// Get All Receipts
app.get('/api/receipts', authMiddleware, async (req, res) => {
    try {
        const receiptsResult = await db.execute({
            sql: 'SELECT * FROM receipts WHERE userId = ? ORDER BY date DESC',
            args: [req.userId]
        });
        const receipts = receiptsResult.rows;
        const receiptIds = receipts.map(r => r.id);

        let items = [];
        if (receiptIds.length > 0) {
            const placeholders = receiptIds.map(() => '?').join(',');
            const itemsResult = await db.execute({
                sql: `SELECT * FROM items WHERE receiptId IN (${placeholders})`,
                args: receiptIds
            });
            items = itemsResult.rows;
        }

        const receiptsWithItems = receipts.map(r => ({
            ...r,
            items: items.filter(i => i.receiptId === r.id)
        }));

        res.json(receiptsWithItems);
    } catch (error) {
        console.error('Get receipts error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save Receipt
app.post('/api/receipts', authMiddleware, async (req, res) => {
    try {
        const { id, storeName, date, total, currency, items, status, createdAt, imageUrl, analysis } = req.body;

        let savedImageUrl = "";
        if (imageUrl && imageUrl.startsWith('data:')) {
            if (isProduction) {
                // Production: store base64 directly in DB (no ephemeral disk)
                savedImageUrl = imageUrl;
            } else {
                savedImageUrl = await saveImageToDisk(imageUrl, date);
            }
        } else {
            savedImageUrl = imageUrl;
        }

        await db.execute({
            sql: `INSERT INTO receipts (id, userId, storeName, date, total, currency, imageUrl, status, createdAt, analysis)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                      storeName = excluded.storeName,
                      date = excluded.date,
                      total = excluded.total,
                      currency = excluded.currency,
                      imageUrl = excluded.imageUrl,
                      status = excluded.status,
                      analysis = excluded.analysis`,
            args: [id, req.userId, storeName, date, total, currency, savedImageUrl, status, createdAt || new Date().toISOString(), analysis || null]
        });

        // Clear old items then insert new ones
        await db.execute({ sql: 'DELETE FROM items WHERE receiptId = ?', args: [id] });

        for (const item of items) {
            await db.execute({
                sql: `INSERT INTO items (id, receiptId, name, price, description, nutrition, details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [item.id, id, item.name, item.price, item.description, item.nutrition, item.details]
            });
        }

        res.json({ success: true, imageUrl: savedImageUrl });
    } catch (error) {
        console.error("Save Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Delete Receipt
app.delete('/api/receipts/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;

    const result = await db.execute({ sql: 'SELECT userId FROM receipts WHERE id = ?', args: [id] });
    const receipt = result.rows[0];
    if (!receipt) {
        return res.status(404).json({ error: 'Receipt not found' });
    }
    if (receipt.userId !== req.userId) {
        return res.status(403).json({ error: 'Not authorized to delete this receipt' });
    }

    await db.execute({ sql: 'DELETE FROM items WHERE receiptId = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM receipts WHERE id = ?', args: [id] });
    res.json({ success: true });
});

// ==================== REPORT ROUTES (Protected) ====================

// GET /api/reports/:period
app.get('/api/reports/:period', authMiddleware, async (req, res) => {
    const { period } = req.params;
    if (!['week', 'month', 'all'].includes(period)) {
        return res.status(400).json({ error: 'Invalid period' });
    }

    try {
        const result = await db.execute({
            sql: 'SELECT content, updatedAt FROM reports WHERE userId = ? AND period = ?',
            args: [req.userId, period]
        });
        const report = result.rows[0];
        if (report) {
            res.json({ content: report.content, updatedAt: report.updatedAt });
        } else {
            res.json({ content: null, updatedAt: null });
        }
    } catch (error) {
        console.error('Read report error:', error);
        res.json({ content: null, updatedAt: null });
    }
});

// POST /api/reports/:period
app.post('/api/reports/:period', authMiddleware, async (req, res) => {
    const { period } = req.params;
    if (!['week', 'month', 'all'].includes(period)) {
        return res.status(400).json({ error: 'Invalid period' });
    }

    const { content } = req.body;
    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    try {
        const updatedAt = new Date().toISOString();
        await db.execute({
            sql: `INSERT INTO reports (userId, period, content, updatedAt) VALUES (?, ?, ?, ?)
                  ON CONFLICT(userId, period) DO UPDATE SET content = excluded.content, updatedAt = excluded.updatedAt`,
            args: [req.userId, period, content, updatedAt]
        });
        res.json({ success: true, updatedAt });
    } catch (error) {
        console.error('Save report error:', error);
        res.status(500).json({ error: 'Failed to save report' });
    }
});

// Export the app for Vercel Serverless Functions
export default app;

// Only start the server if not running in Vercel
if (!process.env.VERCEL) {
    ensureDB().then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    });
}

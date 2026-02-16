import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import db from './db.js';
import dayjs from 'dayjs';
import { hashPassword, comparePassword, generateToken, authMiddleware, generateId } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

const isVercel = process.env.VERCEL === '1';

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support large base64 payloads if needed

if (isVercel) {
    // In Vercel, serve from /tmp/uploads where we write files
    app.use('/uploads', express.static(path.join('/tmp', 'uploads')));
} else {
    app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}

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

        // Check if user exists
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create user
        const id = generateId();
        const passwordHash = await hashPassword(password);
        const createdAt = new Date().toISOString();

        db.prepare('INSERT INTO users (id, email, passwordHash, createdAt) VALUES (?, ?, ?, ?)').run(id, email, passwordHash, createdAt);

        const token = generateToken(id);

        res.json({
            user: { id, email, createdAt },
            token
        });
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

        // Debug: Check if DB is empty (Vercel Reset Check)
        const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
        console.log(`[Login Attempt] Email: ${email}, Total Users in DB: ${userCount}`);

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
            if (userCount === 0) {
                return res.status(401).json({ error: 'Database is empty (Vercel Reset). Please register again.' });
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
app.get('/api/auth/me', authMiddleware, (req, res) => {
    const user = db.prepare('SELECT id, email, createdAt FROM users WHERE id = ?').get(req.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
});

// ==================== RECEIPT ROUTES (Protected) ====================

// Configure Storage Engine for Multer (Direct Image Upload)
// Note: In our current app flow, we might be sending Base64 from the frontend, 
// OR we can switch to FormData. For simplicity with the existing "MagicScan", 
// we'll accept JSON with Base64 first, then write to disk.
// BUT, to follow "build folder save picture" rigorously:

const saveImageToDisk = async (base64Data, dateStr) => {
    // Parse Date to YYYY/MM/DD
    const date = dayjs(dateStr);
    const year = date.format('YYYY');
    const month = date.format('MM');
    const day = date.format('DD');

    const isVercel = process.env.VERCEL === '1';
    const baseDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '../uploads');

    const dir = path.join(baseDir, `${year}/${month}/${day}`);
    await fs.ensureDir(dir);

    const fileName = `receipt_${Date.now()}.webp`; // Using webp or jpg
    const filePath = path.join(dir, fileName);

    // Remove header if present
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, "");
    await fs.writeFile(filePath, base64Image, 'base64');

    // Return the relative path for the DB, served via static middleware
    // URL format: /uploads/YYYY/MM/DD/filename
    return `/uploads/${year}/${month}/${day}/${fileName}`;
};

// API: Get All Receipts (Protected - only user's receipts)
app.get('/api/receipts', authMiddleware, (req, res) => {
    const receipts = db.prepare('SELECT * FROM receipts WHERE userId = ? ORDER BY date DESC').all(req.userId);
    const receiptIds = receipts.map(r => r.id);

    let items = [];
    if (receiptIds.length > 0) {
        const placeholders = receiptIds.map(() => '?').join(',');
        items = db.prepare(`SELECT * FROM items WHERE receiptId IN (${placeholders})`).all(...receiptIds);
    }

    // Join items to receipts
    const receiptsWithItems = receipts.map(r => ({
        ...r,
        items: items.filter(i => i.receiptId === r.id)
    }));

    res.json(receiptsWithItems);
});

// API: Save Receipt (Protected - associate with user)
app.post('/api/receipts', authMiddleware, async (req, res) => {
    try {
        const { id, storeName, date, total, currency, items, status, createdAt, imageUrl, analysis } = req.body;

        let savedImageUrl = "";
        if (imageUrl && imageUrl.startsWith('data:')) {
            savedImageUrl = await saveImageToDisk(imageUrl, date);
        } else {
            savedImageUrl = imageUrl;
        }

        const upsertReceipt = db.prepare(`
            INSERT INTO receipts (id, userId, storeName, date, total, currency, imageUrl, status, createdAt, analysis)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                storeName = excluded.storeName,
                date = excluded.date,
                total = excluded.total,
                currency = excluded.currency,
                imageUrl = excluded.imageUrl,
                status = excluded.status,
                analysis = excluded.analysis
        `);

        upsertReceipt.run(id, req.userId, storeName, date, total, currency, savedImageUrl, status, createdAt || new Date().toISOString(), analysis || null);

        // Insert Items
        const insertItem = db.prepare(`
            INSERT INTO items (id, receiptId, name, price, description, nutrition, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                price = excluded.price,
                description = excluded.description,
                nutrition = excluded.nutrition,
                details = excluded.details
        `);

        const deleteItems = db.prepare('DELETE FROM items WHERE receiptId = ?');
        deleteItems.run(id); // Clear old items if updating

        for (const item of items) {
            insertItem.run(item.id, id, item.name, item.price, item.description, item.nutrition, item.details);
        }

        res.json({ success: true, imageUrl: savedImageUrl });
    } catch (error) {
        console.error("Save Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// API: Delete Receipt (Protected - ownership check)
app.delete('/api/receipts/:id', authMiddleware, (req, res) => {
    const { id } = req.params;

    // Check ownership
    const receipt = db.prepare('SELECT userId FROM receipts WHERE id = ?').get(id);
    if (!receipt) {
        return res.status(404).json({ error: 'Receipt not found' });
    }
    if (receipt.userId !== req.userId) {
        return res.status(403).json({ error: 'Not authorized to delete this receipt' });
    }

    db.prepare('DELETE FROM items WHERE receiptId = ?').run(id);
    db.prepare('DELETE FROM receipts WHERE id = ?').run(id);
    res.json({ success: true });
});

// ==================== REPORT ROUTES (Protected) ====================

const getReportsDir = (userId) => {
    const baseDir = isVercel ? '/tmp' : path.join(__dirname, '../data');
    return path.join(baseDir, 'reports', userId);
};

// GET /api/reports/:period - 读取已保存的报告
app.get('/api/reports/:period', authMiddleware, async (req, res) => {
    const { period } = req.params;
    if (!['week', 'month', 'all'].includes(period)) {
        return res.status(400).json({ error: 'Invalid period' });
    }

    const dir = getReportsDir(req.userId);
    const filePath = path.join(dir, `report-${period}.md`);

    try {
        const exists = await fs.pathExists(filePath);
        if (!exists) {
            return res.json({ content: null, updatedAt: null });
        }
        const content = await fs.readFile(filePath, 'utf-8');
        const stat = await fs.stat(filePath);
        res.json({ content, updatedAt: stat.mtime.toISOString() });
    } catch (error) {
        console.error('Read report error:', error);
        res.json({ content: null, updatedAt: null });
    }
});

// POST /api/reports/:period - 保存报告为 md 文件
app.post('/api/reports/:period', authMiddleware, async (req, res) => {
    const { period } = req.params;
    if (!['week', 'month', 'all'].includes(period)) {
        return res.status(400).json({ error: 'Invalid period' });
    }

    const { content } = req.body;
    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    const dir = getReportsDir(req.userId);
    await fs.ensureDir(dir);
    const filePath = path.join(dir, `report-${period}.md`);

    try {
        await fs.writeFile(filePath, content, 'utf-8');
        const stat = await fs.stat(filePath);
        res.json({ success: true, updatedAt: stat.mtime.toISOString() });
    } catch (error) {
        console.error('Save report error:', error);
        res.status(500).json({ error: 'Failed to save report' });
    }
});

// Export the app for Vercel Serverless Functions
export default app;

// Only start the server if not running in Vercel
// Vercel sets the process.env.VERCEL environment variable
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

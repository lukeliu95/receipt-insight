import type { Receipt, User } from '../types';
import { getAuthToken } from '../store/useAuthStore';

const isProd = import.meta.env.PROD;
const API_BASE = isProd ? '/api' : 'http://localhost:3001/api';
export const UPLOAD_BASE = isProd ? '' : 'http://localhost:3001';

// Helper to get auth headers
const getAuthHeaders = (): Record<string, string> => {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// Helper to handle response
const handleResponse = async (res: Response) => {
    const text = await res.text();
    try {
        const data = JSON.parse(text);
        if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
        return data;
    } catch (e) {
        if (!res.ok) throw new Error(`Server error (${res.status}): ${text.slice(0, 100)}...`);
        throw e;
    }
};

// Auth API
export const authApi = {
    async register(email: string, password: string): Promise<{ user: User; token: string }> {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        return handleResponse(res);
    },

    async login(email: string, password: string): Promise<{ user: User; token: string }> {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        return handleResponse(res);
    },

    async getMe(): Promise<{ user: User }> {
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { ...getAuthHeaders() },
        });
        return handleResponse(res);
    },
};

// Receipt API
export const api = {
    // Get all receipts
    async getReceipts(): Promise<Receipt[]> {
        const res = await fetch(`${API_BASE}/receipts`, {
            headers: { ...getAuthHeaders() },
        });
        
        if (!res.ok) {
            if (res.status === 401) throw new Error('Unauthorized');
            const text = await res.text();
            throw new Error(`Failed to fetch receipts (${res.status}): ${text.slice(0, 100)}`);
        }

        return handleResponse(res);
    },

    // Save a receipt (create or update)
    async saveReceipt(receipt: Receipt): Promise<{ success: true, imageUrl: string }> {
        const res = await fetch(`${API_BASE}/receipts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(receipt)
        });
        return handleResponse(res);
    },

    // Get receipt image (lazy load)
    async getReceiptImage(id: string): Promise<string | null> {
        const res = await fetch(`${API_BASE}/receipts/${id}/image`, {
            headers: { ...getAuthHeaders() },
        });
        const data = await handleResponse(res);
        return data.imageUrl || null;
    },

    // Delete
    async deleteReceipt(id: string): Promise<void> {
        const res = await fetch(`${API_BASE}/receipts/${id}`, {
            method: 'DELETE',
            headers: { ...getAuthHeaders() },
        });
        return handleResponse(res);
    },

    // Upload receipt image (with hash dedup)
    async uploadReceipt(imageData: string, imageHash: string): Promise<{ id?: string; status: 'pending' | 'duplicate'; existingId?: string }> {
        const res = await fetch(`${API_BASE}/receipts/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ imageData, imageHash })
        });
        return handleResponse(res);
    },

    // Batch delete receipts
    async batchDeleteReceipts(ids: string[]): Promise<{ success: boolean; deleted: number }> {
        const res = await fetch(`${API_BASE}/receipts/batch-delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ ids })
        });
        return handleResponse(res);
    },

    // Process receipt (server-side Gemini OCR + analysis)
    async processReceipt(id: string): Promise<{ receipt: Receipt; isDuplicate: boolean; originalId: string | null }> {
        const res = await fetch(`${API_BASE}/receipts/${id}/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        });
        return handleResponse(res);
    }
};

// Report API
export const reportApi = {
    async getReport(period: string): Promise<{ content: string | null; updatedAt: string | null }> {
        const res = await fetch(`${API_BASE}/reports/${period}`, {
            headers: { ...getAuthHeaders() },
        });
        return handleResponse(res);
    },

    async saveReport(period: string, content: string): Promise<{ success: boolean; updatedAt: string }> {
        const res = await fetch(`${API_BASE}/reports/${period}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ content }),
        });
        return handleResponse(res);
    },
};

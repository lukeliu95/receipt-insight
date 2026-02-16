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

        const data = await handleResponse(res);
        // Fix image URLs to be full paths if relative
        return data.map((r: any) => ({
            ...r,
            imageUrl: r.imageUrl?.startsWith('/uploads') ? `${UPLOAD_BASE}${r.imageUrl}` : r.imageUrl
        }));
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

    // Delete
    async deleteReceipt(id: string): Promise<void> {
        const res = await fetch(`${API_BASE}/receipts/${id}`, {
            method: 'DELETE',
            headers: { ...getAuthHeaders() },
        });
        return handleResponse(res);
    }
};

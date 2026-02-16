import { create } from 'zustand';
import type { Receipt } from '../types';
import { api, UPLOAD_BASE } from '../services/api';

interface ReceiptStore {
    receipts: Receipt[];
    isScanning: boolean;
    setScanning: (scanning: boolean) => void;
    loadReceipts: () => Promise<void>;
    addReceipt: (receipt: Receipt) => Promise<void>;
    updateReceiptData: (id: string, data: Partial<Receipt>) => Promise<void>;
    updateReceiptStatus: (id: string, status: Receipt['status']) => Promise<void>;
    removeReceipt: (id: string) => Promise<void>;
    removeReceipts: (ids: string[]) => Promise<void>;
    clearReceipts: () => void;
    getRecentReceipts: (days: number) => Receipt[];
}

export const useReceiptStore = create<ReceiptStore>((set, get) => ({
    receipts: [],
    isScanning: false,
    setScanning: (isScanning) => set({ isScanning }),

    loadReceipts: async () => {
        try {
            const receipts = await api.getReceipts();
            set({ receipts });
        } catch (e) {
            console.error("Failed to load receipts", e);
        }
    },

    addReceipt: async (receipt) => {
        set((state) => ({ receipts: [receipt, ...state.receipts] }));
        try {
            const res = await api.saveReceipt(receipt);
            if (res.imageUrl) {
                const fullUrl = res.imageUrl.startsWith('http')
                    ? res.imageUrl
                    : `${UPLOAD_BASE}${res.imageUrl}`;
                set((state) => ({
                    receipts: state.receipts.map(r => r.id === receipt.id ? { ...r, imageUrl: fullUrl } : r)
                }));
            }
        } catch (e) {
            console.error("Save failed", e);
        }
    },

    updateReceiptData: async (id, data) => {
        set((state) => ({
            receipts: state.receipts.map((r) => (r.id === id ? { ...r, ...data } : r)),
        }));
        const updated = get().receipts.find(r => r.id === id);
        if (updated) await api.saveReceipt(updated);
    },

    updateReceiptStatus: async (id, status) => {
        set((state) => ({
            receipts: state.receipts.map((r) => (r.id === id ? { ...r, status } : r)),
        }));
        const updated = get().receipts.find(r => r.id === id);
        if (updated) await api.saveReceipt(updated);
    },

    removeReceipt: async (id) => {
        set((state) => ({ receipts: state.receipts.filter(r => r.id !== id) }));
        await api.deleteReceipt(id);
    },

    removeReceipts: async (ids) => {
        set((state) => ({ receipts: state.receipts.filter(r => !ids.includes(r.id)) }));
        await api.batchDeleteReceipts(ids);
    },

    clearReceipts: () => set({ receipts: [] }),

    // 获取最近N天的已完成小票（不含当前正在处理的）
    getRecentReceipts: (days: number) => {
        const now = new Date();
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        return get().receipts.filter(r =>
            r.status === 'completed' && new Date(r.date) >= cutoff
        );
    }
}));

export interface User {
    id: string;
    email: string;
    createdAt: string;
}

export interface LineItem {
    id: string;
    name: string;
    price: number;
    description?: string;
    nutrition?: string;
    details?: string;
}

export interface Receipt {
    id: string;
    imageUrl: string;
    storeName: string;
    date: string;
    createdAt?: string;
    currency: string;
    total: number;
    items: LineItem[];
    status: 'scanning' | 'processing' | 'completed' | 'error';
    analysis?: string; // AI 营养与消费分析 (含近3天对比)
}

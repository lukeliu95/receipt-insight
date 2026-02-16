import type { Receipt } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const MODEL_ID = "gemini-3-flash-preview";

async function callGemini(contents: any[], useSearch = false, thinkingLevel = "LOW"): Promise<string> {
    if (!API_KEY) throw new Error("Gemini API Key is missing");

    const requestBody: any = {
        contents,
        generationConfig: { thinkingConfig: { thinkingLevel } }
    };
    if (useSearch) {
        requestBody.tools = [{ googleSearch: {} }];
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API Error:", response.status, errorText);
        throw new Error(`Gemini API Error: ${response.status}`);
    }

    const result = await response.json();
    const candidate = result.candidates?.[0];
    if (!candidate?.content?.parts) throw new Error("No candidates returned");

    let fullText = "";
    for (const part of candidate.content.parts) {
        if (part.text) fullText += part.text;
    }
    return fullText;
}

// ============ 统计报告生成 (营养 + 消费综合分析) ============
export type ReportPeriod = 'week' | 'month' | 'all';

export async function generateReport(receipts: Receipt[], period: ReportPeriod): Promise<string> {
    const receiptsData = receipts.map(r => ({
        store: r.storeName,
        date: r.date,
        total: r.total,
        currency: r.currency,
        items: r.items.map(i => ({
            name: i.name,
            price: i.price,
            nutrition: i.nutrition || '',
            details: i.details || ''
        }))
    }));

    const totalSpent = receipts.reduce((sum, r) => sum + r.total, 0);
    const currency = receipts[0]?.currency || '¥';

    const periodLabel = period === 'week' ? '本周（最近7天）' : period === 'month' ? '本月（最近30天）' : '全部历史';
    const days = period === 'week' ? 7 : period === 'month' ? 30 : Math.max(1, Math.ceil((Date.now() - new Date(receipts[receipts.length - 1]?.date || Date.now()).getTime()) / (1000 * 60 * 60 * 24)));

    const prompt = `
你是"花在哪里了"App的消费分析师。请基于以下消费数据生成「${periodLabel}」的消费报告。

## 消费数据（${periodLabel}）
- 总计 ${receipts.length} 笔消费，合计 ${currency}${totalSpent.toFixed(2)}
- 统计天数：${days} 天
- 详细数据：
${JSON.stringify(receiptsData, null, 2)}

请生成一份完整的报告（Markdown），包含：

### 📊 消费总览
- 总支出、笔数
- 日均消费 ${currency}${(totalSpent / days).toFixed(0)}
- 消费最高的一天和最低的一天

### 🏪 商家分布
- 去了哪些商家，各花了多少
- 最常去的商家

### 🥗 营养分析
- 综合所有商品的营养信息
- 给出整体健康评分（emoji 星星，满分5星）
- 分析饮食结构：蛋白质、碳水、脂肪、糖分摄入情况
- 列出营养亮点和需要改进的地方

### 💰 消费分析
- 消费趋势（用简单的柱形图 emoji 表示）
- 消费分类（食品、日用品、餐饮等）
- 最贵的3样商品

### 💡 建议
- 1条省钱建议
- 1条健康饮食建议
- 未来消费预算建议

要求：
- 语气专业但亲切
- 多用 emoji 让报告生动
- 如果数据不足，诚实说明
- 控制在500字以内
`;

    return await callGemini([{ role: "user", parts: [{ text: prompt }] }]);
}

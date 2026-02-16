import type { Receipt } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const MODEL_ID = "gemini-3-flash-preview";

// ============ 小票 OCR 识别 ============
const SYSTEM_PROMPT = `
你是一位极其严谨的财务审计师和健康营养专家。你的任务是将小票图片转换为结构化的数据。

### 核心任务：
1. **精准识别日期 (CRITICAL)**:
   - 必须提取小票上打印的**交易时间/打印时间**。
   - **绝对不要**使用"当前时间"或"上传时间"，除非小票上完全没有任何日期信息。
   - 常见的日期格式包括：2024/01/16, 24年1月16日, Jan 16 2024, 16-01-2024 等。请将其统一转换为 ISO 格式 (YYYY-MM-DDTHH:mm:ss)。
   - 如果年份缺失（如 "1月16日"），请基于当前日期推测最合理的年份。

2. **商品识别与增强**:
   - 识别每一行商品名称 (Name) 和价格 (Price)。
   - 不需要识别小计、折扣汇总行，只提取具体商品。
   - **Google 搜索增强**: 针对每个商品，进行联网搜索补充以下信息：
     - **nutrition**: 营养成分简述 (e.g., "高蛋白", "碳水化合物: 20g/100g", "高糖警告")。
     - **details**: 配料或材质 (e.g., "棉质", "含防腐剂", "无糖").
     - **description**: 一句话中文介绍 (e.g., "日式照烧口味", "经典款卫衣").

3. **输出要求**:
   - 必须是纯净的 JSON 格式。
   - 货币符号请根据小票内容识别 (¥, $, etc)。

### JSON 结构:
{
  "storeName": "商店名称 (中文，如果小票是英文请翻译)",
  "date": "YYYY-MM-DDTHH:mm:ss.sssZ (务必精准)",
  "currency": "货币符号",
  "total": 总金额 (数字),
  "items": [
    {
      "name": "商品中文名称",
      "price": 数字,
      "description": "介绍",
      "nutrition": "应用搜索后的营养信息",
      "details": "应用搜索后的配料信息"
    }
  ]
}
`;

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

// ============ 1. 处理小票图片 → 结构化数据 ============
export async function processReceiptImage(base64Image: string): Promise<Partial<Receipt>> {
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const fullText = await callGemini([{
        role: "user",
        parts: [
            { text: SYSTEM_PROMPT },
            { inlineData: { mimeType: "image/jpeg", data: base64Data } }
        ]
    }], true);

    console.log("Gemini Raw Output:", fullText);

    const jsonStr = fullText.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to parse JSON from model output");

    const data = JSON.parse(jsonMatch[0]);

    return {
        storeName: data.storeName,
        date: data.date,
        currency: data.currency,
        total: data.total,
        items: data.items.map((item: any, index: number) => ({
            id: `item-${index}-${Date.now()}`,
            name: item.name,
            price: item.price,
            description: item.description,
            nutrition: item.nutrition,
            details: item.details
        })),
        status: 'completed'
    };
}

// ============ 2. 单张小票分析 (含近3天对比) ============
export async function generateReceiptAnalysis(receipt: Receipt, recentReceipts: Receipt[]): Promise<string> {
    const recentData = recentReceipts.map(r => ({
        date: r.date,
        store: r.storeName,
        total: r.total,
        currency: r.currency,
        items: r.items.map(i => ({
            name: i.name,
            price: i.price,
            nutrition: i.nutrition || '未知',
            details: i.details || ''
        }))
    }));

    const currentData = {
        store: receipt.storeName,
        date: receipt.date,
        total: receipt.total,
        currency: receipt.currency,
        items: receipt.items.map(i => ({
            name: i.name,
            price: i.price,
            nutrition: i.nutrition || '未知',
            details: i.details || ''
        }))
    };

    const prompt = `
你是"花在哪里了"App的智能分析助手。请对本次消费进行简明分析。

## 本次消费
${JSON.stringify(currentData, null, 2)}

## 最近3天的消费记录（用于对比）
${recentData.length > 0 ? JSON.stringify(recentData, null, 2) : '暂无历史记录'}

请生成一份简洁的分析报告（Markdown），包含以下内容：

### 1. 本次消费速览
- 商家、总金额、商品数量的一句话总结

### 2. 营养评估
- 基于商品的营养信息，给出健康评分（用 emoji 星星表示，满分5星）
- 列出值得注意的营养问题（如高糖、高脂肪、缺乏蛋白质等）
- 给出一条简短的健康建议

### 3. 消费对比（与近3天）
- 如果有历史记录，对比今天和前几天的消费金额变化趋势
- 用简单的箭头符号表示升降（↑↓→）
- 给出消费趋势的一句话点评

要求：
- 语气亲切友好，像朋友聊天
- 控制在200字以内
- 多用 emoji 让内容生动
- 不要用复杂表格
`;

    return await callGemini([{ role: "user", parts: [{ text: prompt }] }]);
}

// ============ 3. 统计报告生成 (营养 + 消费综合分析) ============
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

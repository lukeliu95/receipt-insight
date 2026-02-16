const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL_ID = 'gemini-3-flash-preview';

function buildSystemPrompt(timezone) {
    return `
你是一位极其严谨的财务审计师和健康营养专家。你的任务是将小票图片转换为结构化的数据。

### 核心任务：
1. **精准识别日期 (CRITICAL)**:
   - 必须提取小票上打印的**交易时间/打印时间**。
   - **绝对不要**使用"当前时间"或"上传时间"，除非小票上完全没有任何日期信息。
   - 小票上的时间是当地时间，用户时区为 ${timezone || 'Asia/Tokyo'}。
   - 请将识别到的当地时间，按用户时区转换为带时区偏移的 ISO 格式。
   - 例如：小票上显示 "15:20"，用户时区 Asia/Tokyo (UTC+9)，则输出 "2026-02-15T15:20:00+09:00"。
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
  "date": "YYYY-MM-DDTHH:mm:ss+HH:MM (带时区偏移，务必精准)",
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
}

async function callGemini(contents, useSearch = false, thinkingLevel = 'LOW') {
    if (!API_KEY) throw new Error('GEMINI_API_KEY is missing on server');

    const requestBody = {
        contents,
        generationConfig: { thinkingConfig: { thinkingLevel } }
    };
    if (useSearch) {
        requestBody.tools = [{ googleSearch: {} }];
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API Error:', response.status, errorText);
        throw new Error(`Gemini API Error: ${response.status}`);
    }

    const result = await response.json();
    const candidate = result.candidates?.[0];
    if (!candidate?.content?.parts) throw new Error('No candidates returned');

    let fullText = '';
    for (const part of candidate.content.parts) {
        if (part.text) fullText += part.text;
    }
    return fullText;
}

// OCR: image base64 -> structured receipt data
export async function processReceiptImage(base64Image, timezone) {
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

    const fullText = await callGemini([{
        role: 'user',
        parts: [
            { text: buildSystemPrompt(timezone) },
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
        ]
    }], true);

    console.log('[Gemini] OCR raw output length:', fullText.length);

    const jsonStr = fullText.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse JSON from Gemini output');

    const data = JSON.parse(jsonMatch[0]);

    return {
        storeName: data.storeName,
        date: data.date,
        currency: data.currency,
        total: data.total,
        items: data.items.map((item, index) => ({
            id: `item-${index}-${Date.now()}`,
            name: item.name,
            price: item.price,
            description: item.description,
            nutrition: item.nutrition,
            details: item.details
        }))
    };
}

// Single receipt analysis with recent comparison
export async function generateReceiptAnalysis(receipt, recentReceipts) {
    const recentData = recentReceipts.map(r => ({
        date: r.date,
        store: r.storeName,
        total: r.total,
        currency: r.currency,
        items: (r.items || []).map(i => ({
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
        items: (receipt.items || []).map(i => ({
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

    return await callGemini([{ role: 'user', parts: [{ text: prompt }] }]);
}

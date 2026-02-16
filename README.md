# 🧾 Receipt Insight (花在哪里了)

> 你的 AI 智能记账与消费健康助手。

不仅仅是记账，**Receipt Insight** 使用 Google Gemini AI 深度分析你的每一张购物小票，不仅告诉你**钱花哪了**，还告诉你**吃得健不健康**。通过智能 OCR 和语义理解，它能自动提取消费明细、分析营养成分，并生成可视化的消费与健康周报。

![App Screenshot](public/vite.svg) <!-- 这里可以后续替换为真实的应用截图 -->

## ✨ 核心特性

### 📸 MagicScan 智能扫描
- **AI 驱动识别**：上传小票图片，AI 自动提取商家名称、交易日期、总金额及货币符号。
- **商品级详情**：自动识别每一行商品，并利用 **Google Search** 联网能力，自动补充商品的**营养成分**（如蛋白质、热量、糖分）和**配料信息**。
- **自动结构化**：无需手动输入任何数据，AI 帮你完成从图片到表格的转换。

### 🧠 深度消费与健康洞察
- **即时分析简报**：每上传一张小票，AI 都会生成一份即时分析，包含：
  - 🌟 **健康评分**：基于购买食物的营养成分打分。
  - 📈 **趋势对比**：与最近 3 天的消费进行对比，了解消费升降趋势。
- **智能周期报告**：
  - 支持 **周报/月报/全量报告** 一键生成。
  - **多维分析**：包含商家分布、消费结构、营养摄入分析（高糖/高脂预警）。
  - **个性化建议**：AI 根据你的消费习惯，提供具体的**省钱策略**和**饮食改善建议**。

### 🔒 隐私与体验
- **本地优先**：默认使用 SQLite 本地数据库，数据掌握在自己手中。
- **流畅交互**：基于 Framer Motion 的丝滑动画体验，扫描、分析过程可视化。
- **响应式设计**：完美适配移动端和桌面端浏览器。

## 🛠️ 技术栈

- **前端**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [TailwindCSS v4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/)
- **状态管理**: [Zustand](https://github.com/pmndrs/zustand)
- **后端**: Node.js, Express
- **数据库**: [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3)
- **AI 模型**: [Google Gemini Pro](https://deepmind.google/technologies/gemini/) (via Google Generative AI SDK)
- **工具库**: Lucide React, Day.js, Recharts

## 🚀 快速开始

### 1. 获取代码

```bash
git clone https://github.com/your-username/receipt-insight.git
cd receipt-insight
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env`，并填入你的 Google Gemini API Key。

```bash
cp .env.example .env
```

在 `.env` 文件中：

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

> 💡 **提示**: 你可以在 [Google AI Studio](https://aistudio.google.com/) 免费获取 Gemini API Key。

### 4. 启动开发服务器

```bash
npm run dev
```

终端会同时启动前端 (Vite) 和后端 (Express) 服务。
访问 `http://localhost:5173` 即可开始使用。

## 📦 部署

本项目已配置 `vercel.json`，支持一键部署到 Vercel。

1. Fork 本仓库到你的 GitHub。
2. 在 Vercel Dashboard 中导入项目。
3. 在项目设置 (Settings) -> 环境变量 (Environment Variables) 中添加：
   - `VITE_GEMINI_API_KEY`: 你的 Gemini API Key
4. 点击 **Deploy**。

> ⚠️ **注意**: 
> 默认的 SQLite 数据库在 Vercel 等 Serverless 环境中是临时的（每次部署或冷启动可能会重置）。
> 如果需要持久化存储，建议在生产环境中将 `db.js` 适配为连接 Vercel Postgres、Supabase 或其他云数据库。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！如果你有好的想法，比如支持更多类型的单据分析，或者接入其他 AI 模型，欢迎一起完善。

## 📄 许可证

[MIT License](LICENSE)

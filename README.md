# 花在哪里了

> AI 智能记账与消费健康助手。拍照小票 → AI 分析 → 消费报告，三步搞定。

## 核心功能

- **拍照识别** — 拍小票或从相册选取（支持多选批量），AI 自动提取商家、日期、金额、商品明细
- **即时分析** — 每张小票扫描后自动生成营养评估 + 消费对比（与近3天对比）
- **统计报告** — 周报 / 月报 / 全部数据报告，含营养分析、消费趋势、省钱建议
- **报告持久化** — 生成的报告自动保存，下次打开直接显示，手动刷新才重新生成

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite + TailwindCSS v4 + Framer Motion |
| 状态管理 | Zustand |
| 后端 | Node.js + Express |
| 数据库 | 本地开发: SQLite (libSQL) / 生产: [Turso](https://turso.tech) (云端 SQLite) |
| AI | Google Gemini 3 Flash Preview (OCR + 分析 + 报告生成) |
| 部署 | Vercel (Serverless Functions) |

## 项目结构

```
receipt-insight/
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   ├── services/
│   │   ├── api.ts          # 后端 API 调用
│   │   └── gemini.ts       # Gemini AI 服务（OCR、分析、报告）
│   ├── store/              # Zustand 状态管理
│   └── types.ts            # TypeScript 类型定义
├── server/                 # 后端源码
│   ├── index.js            # Express 服务器 + API 路由
│   ├── db.js               # 数据库连接（libSQL，支持本地/Turso）
│   └── auth.js             # JWT 认证
├── api/
│   └── index.js            # Vercel Serverless 入口（导出 Express app）
├── vercel.json             # Vercel 路由配置
├── .env                    # 环境变量（不提交到 Git）
└── data/                   # 本地开发数据目录（SQLite 文件）
```

---

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
VITE_GEMINI_API_KEY=你的_Gemini_API_Key
```

> 在 [Google AI Studio](https://aistudio.google.com/) 免费获取 Gemini API Key。

### 3. 启动

```bash
npm run dev
```

同时启动前端 (Vite, `localhost:5173`) 和后端 (Express, `localhost:3001`)。

本地开发使用 SQLite 文件存储 (`data/receipts.db`)，无需任何云服务。

---

## 生产部署（Vercel + Turso）

### 核心问题

Vercel 是 Serverless 架构，每次冷启动 `/tmp` 目录会被清空。如果用 SQLite 文件存在 `/tmp`，数据会丢失。

**解决方案**：使用 [Turso](https://turso.tech)（云端 SQLite 数据库），API 兼容 libSQL，免费额度充足。

### 架构对比

```
本地开发:
  前端 (Vite) → Express Server → SQLite 文件 (data/receipts.db)

生产环境:
  前端 (Vercel CDN) → Serverless Function (Express) → Turso 云数据库
```

### 部署步骤

#### Step 1: 安装 Turso CLI 并创建数据库

```bash
# 安装 Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# 登录（会打开浏览器进行 GitHub OAuth 授权）
turso auth login

# 创建数据库（选择离用户最近的区域，如东京 aws-ap-northeast-1）
turso db create receipt-insight

# 查看数据库 URL
turso db show receipt-insight
# 输出: URL: libsql://receipt-insight-xxx.aws-ap-northeast-1.turso.io

# 创建访问 Token
turso db tokens create receipt-insight
# 输出: eyJhbGciOiJFZERTQSIs...（保存这个 Token）
```

#### Step 2: 配置 Vercel 项目

**方式 A：通过 Vercel CLI（推荐用于自动化）**

```bash
# 安装并登录（需要在 https://vercel.com/account/tokens 创建 Token）
VERCEL_TOKEN=你的_Vercel_Token

# 链接项目（首次需要）
npx vercel link -t $VERCEL_TOKEN --scope 你的团队名

# 添加环境变量
echo -n "libsql://receipt-insight-xxx.turso.io" | \
  npx vercel env add TURSO_DATABASE_URL production -t $VERCEL_TOKEN

echo -n "eyJhbGciOiJFZERTQSIs..." | \
  npx vercel env add TURSO_AUTH_TOKEN production -t $VERCEL_TOKEN

echo -n "你的_Gemini_API_Key" | \
  npx vercel env add VITE_GEMINI_API_KEY production -t $VERCEL_TOKEN

# 部署到生产环境
npx vercel --prod -t $VERCEL_TOKEN
```

**方式 B：通过 Vercel Dashboard**

1. 在 [Vercel Dashboard](https://vercel.com) 导入项目
2. 进入 Settings → Environment Variables，添加：

| 变量名 | 值 | 环境 |
|--------|-----|------|
| `VITE_GEMINI_API_KEY` | 你的 Gemini API Key | Production |
| `TURSO_DATABASE_URL` | `libsql://receipt-insight-xxx.turso.io` | Production |
| `TURSO_AUTH_TOKEN` | Turso 生成的 JWT Token | Production |

3. 点击 Deploy

#### Step 3: 验证部署

```bash
# 测试注册
curl -s https://你的域名/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'

# 测试登录
curl -s https://你的域名/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'

# 测试数据持久化（登录后用返回的 token）
TOKEN=返回的token值

# 保存报告
curl -s -X POST https://你的域名/api/reports/week \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"# 测试报告"}'

# 读取报告（验证持久化）
curl -s https://你的域名/api/reports/week \
  -H "Authorization: Bearer $TOKEN"
# 应返回: {"content":"# 测试报告","updatedAt":"..."}
```

---

## Vercel 路由配置说明

`vercel.json`：

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.js" },
    { "source": "/uploads/(.*)", "destination": "/api/index.js" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- `/api/*` → 转发到 Serverless Function (`api/index.js`，导出 Express app)
- `/uploads/*` → 同上（本地开发走 Express 静态文件，生产环境图片存 DB）
- 其他 → SPA 前端 (`index.html`)

`api/index.js` 入口文件：

```javascript
import app from '../server/index.js';
export default app;
```

---

## 数据库适配层说明

`server/db.js` 通过环境变量自动切换：

```javascript
import { createClient } from '@libsql/client';

if (process.env.TURSO_DATABASE_URL) {
    // 生产环境：连接 Turso 云数据库
    db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });
} else {
    // 本地开发：使用 SQLite 文件
    db = createClient({ url: `file:${dbPath}` });
}
```

`@libsql/client` 统一 API，无论本地还是云端，代码完全一致：

```javascript
// 查询
const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
const user = result.rows[0];

// 插入/更新
await db.execute({
    sql: 'INSERT INTO users (id, email) VALUES (?, ?)',
    args: [id, email]
});

// 建表（多语句）
await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (...);
    CREATE TABLE IF NOT EXISTS receipts (...);
`);
```

### 从 better-sqlite3 迁移到 @libsql/client

| better-sqlite3 (同步) | @libsql/client (异步) |
|------------------------|----------------------|
| `db.prepare(sql).get(...args)` | `(await db.execute({ sql, args })).rows[0]` |
| `db.prepare(sql).all(...args)` | `(await db.execute({ sql, args })).rows` |
| `db.prepare(sql).run(...args)` | `await db.execute({ sql, args })` |
| `db.exec(multiSql)` | `await db.executeMultiple(multiSql)` |

关键区别：所有操作变为 async，路由处理函数需要加 `async`，DB 调用需要 `await`。

---

## 生产环境图片存储策略

| 环境 | 策略 | 原因 |
|------|------|------|
| 本地开发 | base64 → 写入磁盘 `uploads/YYYY/MM/DD/` → 存文件路径到 DB | 磁盘持久化 |
| 生产 (Vercel) | base64 直接存入 DB | Vercel `/tmp` 是临时目录，重启丢失 |

前端已兼容两种格式（data URL 和文件路径），无需改动。

---

## Turso 常用命令

```bash
# 查看数据库信息
turso db show receipt-insight

# 进入交互式 SQL Shell
turso db shell receipt-insight

# 查看所有数据库
turso db list

# 创建新 Token（旧 Token 过期时）
turso db tokens create receipt-insight

# 删除数据库
turso db destroy receipt-insight
```

---

## 环境变量总览

| 变量 | 用途 | 必需 | 使用环境 |
|------|------|------|---------|
| `VITE_GEMINI_API_KEY` | Gemini AI API Key | 是 | 前端（构建时注入） |
| `TURSO_DATABASE_URL` | Turso 数据库连接 URL | 生产必需 | 后端 |
| `TURSO_AUTH_TOKEN` | Turso 数据库访问 Token | 生产必需 | 后端 |
| `JWT_SECRET` | JWT 签名密钥 | 建议设置 | 后端（默认有 fallback） |
| `VERCEL` | Vercel 平台标识 | 自动设置 | 后端（Vercel 自动注入） |

---

## 复用到其他项目

如果你要在新项目中使用相同的 Vercel + Turso 架构：

1. 安装依赖：`npm install @libsql/client`
2. 复制 `server/db.js` 的连接逻辑（自动检测 `TURSO_DATABASE_URL`）
3. 创建 `api/index.js` 导出 Express app
4. 配置 `vercel.json` 路由重写
5. 在 Vercel 添加 `TURSO_DATABASE_URL` 和 `TURSO_AUTH_TOKEN` 环境变量

最小化模板：

```javascript
// server/db.js
import { createClient } from '@libsql/client';

const db = process.env.TURSO_DATABASE_URL
    ? createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
    : createClient({ url: 'file:./data/local.db' });

export async function initDB() {
    await db.executeMultiple(`CREATE TABLE IF NOT EXISTS ...`);
}
export default db;
```

```javascript
// api/index.js (Vercel Serverless 入口)
import app from '../server/index.js';
export default app;
```

```json
// vercel.json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.js" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## License

[MIT](LICENSE)

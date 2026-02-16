# Receipt Insight - Claude Code 开发指南

## 项目概况

- **前端**: React 19 + TypeScript + Tailwind CSS + Zustand
- **后端**: Express (server/index.js) + SQLite/Turso
- **AI**: Google Gemini (服务端调用, server/gemini.js)
- **部署**: Vercel (Serverless Functions)
- **仓库**: github.com/lukeliu95/receipt-insight
- **当前版本**: v1.0

## 版本管理

- 版本号显示在首页标题旁（`src/App.tsx` 中 header 区域）
- **每次功能更新都必须递增版本号**并同步修改：
  1. `src/App.tsx` 中的 `v1.0` 文本
  2. 本文件 `CLAUDE.md` 中的「当前版本」
- 版本格式：`vX.Y`（X=大版本, Y=小功能迭代）

## Vercel 部署循环 (Deploy Loop)

代码修改后，按以下循环自动验证部署：

### 步骤

1. **本地检查** - 运行 `npm run build` 确保编译通过
2. **提交推送** - `git add <files> && git commit && git push`
3. **等待部署** - Vercel 自动触发，等约 60 秒
4. **检查状态** - 运行以下命令获取最新部署状态：
   ```bash
   DEPLOY_ID=$(gh api repos/lukeliu95/receipt-insight/deployments --jq '.[0].id')
   gh api repos/lukeliu95/receipt-insight/deployments/$DEPLOY_ID/statuses --jq '.[0] | {state, description}'
   ```
5. **判断结果**：
   - `state: "success"` → 部署成功，循环结束
   - `state: "failure"` / `state: "error"` → 本地 `npm run build` 复现，修复后回到步骤 1
   - `state: "pending"` → 等待 30 秒后重新检查步骤 4

### 快速单行检查

```bash
gh api repos/lukeliu95/receipt-insight/deployments --jq '.[0] | {sha: .sha[0:7], created: .created_at}' && DEPLOY_ID=$(gh api repos/lukeliu95/receipt-insight/deployments --jq '.[0].id') && gh api repos/lukeliu95/receipt-insight/deployments/$DEPLOY_ID/statuses --jq '.[0] | {state, description}'
```

## 关键架构决策

- **Gemini API Key 仅在服务端** (`GEMINI_API_KEY`, 非 `VITE_` 前缀)
- **小票去重**: OCR 后比较交易时间，相同则判为重复
- **时区处理**: 前端发送浏览器时区 (`Intl.DateTimeFormat`)，Gemini 输出带时区偏移的日期
- **小票日期**: `date` 字段始终为小票打印时间 (OCR 提取), `createdAt` 为上传时间
- **图片懒加载**: 列表不返回 imageUrl，详情页点击按需加载
- **Vercel 入口**: `api/index.js` → 导入 `server/index.js` (包含所有路由)

## 环境变量 (Vercel Dashboard 配置)

- `TURSO_DATABASE_URL` - 生产数据库
- `TURSO_AUTH_TOKEN` - 数据库认证
- `GEMINI_API_KEY` - Gemini API (服务端)
- `VITE_GEMINI_API_KEY` - Gemini API (前端报告生成)
- `JWT_SECRET` - JWT 签名密钥

## 常用命令

```bash
npm run dev          # 本地开发 (Vite + Express 并行)
npm run build        # 生产构建 (tsc + vite build)
```

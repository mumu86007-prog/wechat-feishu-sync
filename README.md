# 微信群聊记录同步飞书小程序 - 后端服务

基于PRD文档实现的Node.js + Express后端服务，用于将微信群聊记录同步到飞书多维表格。

## 功能特性

- ✅ **配置验证** (GET /api/verify) - 验证飞书表格配置有效性
- ✅ **核心同步** (POST /api/sync) - 同步聊天记录到飞书表格
- ✅ **错误处理** - 完善的错误分类和处理机制
- ✅ **输入验证** - Zod schema验证，支持8000字符限制
- ✅ **Token管理** - 自动获取和缓存飞书tenant_access_token

## 技术栈

- **框架**: Express.js
- **HTTP客户端**: node-fetch
- **验证**: Zod
- **环境配置**: dotenv
- **日志**: 结构化日志

## 快速开始

### 1. 安装依赖
```bash
cd wechat-feishu-sync
npm install
```

### 2. 配置环境变量
```bash
cp .env.example .env
```

编辑 `.env` 文件：
```env
FEISHU_APP_ID=your_feishu_app_id
FEISHU_APP_SECRET=your_feishu_app_secret
PORT=3000
NODE_ENV=development
```

### 3. 启动服务
```bash
npm start
# 或开发模式
npm run dev
```

### 4. 测试API

**验证配置：**
```bash
curl "http://localhost:3000/api/verify?app_token=YOUR_APP_TOKEN&table_id=YOUR_TABLE_ID"
```

**同步聊天记录：**
```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Content-Type: application/json" \
  -d '{
    "group_name": "产品交流群",
    "chat_content": "张三：今天进度怎么样？\n李四：进展顺利，明天可以完成",
    "feishu_app_token": "YOUR_APP_TOKEN",
    "feishu_table_id": "YOUR_TABLE_ID"
  }'
```

## API文档

### GET /api/verify
验证飞书表格配置有效性

**参数：**
- `app_token` (required): 飞书多维表格App Token
- `table_id` (required): 飞书表格ID

**响应：**
```json
{
  "success": true,
  "data": {
    "success": true,
    "tableName": "群聊记录",
    "appToken": "YOUR_APP_TOKEN",
    "tableId": "YOUR_TABLE_ID"
  }
}
```

### POST /api/sync
同步聊天记录到飞书表格

**请求体：**
```json
{
  "group_name": "产品交流群",
  "chat_content": "聊天记录内容...",
  "feishu_app_token": "YOUR_APP_TOKEN",
  "feishu_table_id": "YOUR_TABLE_ID"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "record_id": "recXXXXXXXX",
    "created_time": 1640000000,
    "group_name": "产品交流群",
    "sync_time": "2026-04-03T12:00:00.000Z"
  }
}
```

## 部署到传统服务器

1. 安装PM2进程管理器
2. 配置Nginx反向代理
3. 设置SSL证书
4. 配置系统服务

详见部署文档。

## 开发计划

- ✅ 配置验证功能 (GET /api/verify)
- ✅ 核心同步功能 (POST /api/sync)
- ⏳ 错误处理完善
- ⏳ 单元测试和集成测试
- ⏳ 部署脚本

## 故障排除

- **Token过期**: 系统会自动刷新
- **权限不足**: 检查飞书应用权限配置
- **频率限制**: 避免短时间内大量请求
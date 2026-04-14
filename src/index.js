// Express应用入口
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const verifyHandler = require('./api/verify');
const syncHandler = require('./api/sync');
const verifyConfigHandler = require('./api/verify-config');
const uploadImageHandler = require('./api/upload-image');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' })); // 支持大文本输入
app.use(express.urlencoded({ extended: true }));

// 请求日志中间件 (参考 mcp-health-check.js 日志模式)
app.use((req, res, next) => {
  console.log(`[Express] ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API路由
app.get('/api/verify', verifyHandler);
app.post('/api/sync', syncHandler);
app.post('/api/feishu/verify-config', verifyConfigHandler);
app.post('/api/upload-image', uploadImageHandler);

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      code: 'not_found',
      message: 'Endpoint not found'
    }
  });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('[Express] Unhandled error:', error);
  res.status(500).json({
    error: {
      code: 'internal_server_error',
      message: 'Internal server error'
    }
  });
});

module.exports = app;
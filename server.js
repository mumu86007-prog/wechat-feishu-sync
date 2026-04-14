// 服务器启动文件
const app = require('./src/index');
const PORT = process.env.PORT || 80;

// 启动服务器
app.listen(PORT, () => {
  console.log(`[Server] WeChat to Feishu Sync Backend started on port ${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  console.log(`[Server] API endpoints:`);
  console.log(`[Server]   GET  http://localhost:${PORT}/api/verify`);
  console.log(`[Server]   POST http://localhost:${PORT}/api/sync`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully');
  process.exit(0);
});
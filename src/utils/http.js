// 基于 everything-claude-code-main/scripts/hooks/mcp-health-check.js 的 HTTP 客户端模式
const http = require('http');
const https = require('https');
const { URL } = require('url');

/**
 * 创建 HTTP 客户端 (基于 mcp-health-check.js requestHttp 模式)
 */
function createHttpClient() {
  return {
    /**
     * 发送 HTTP 请求
     * @param {string} urlString - 请求 URL
     * @param {Object} options - 请求选项
     * @returns {Promise<Object>} 响应对象
     */
    async request(urlString, options = {}) {
      return new Promise((resolve, reject) => {
        try {
          const url = new URL(urlString);
          const client = url.protocol === 'https:' ? https : http;

          const requestOptions = {
            method: options.method || 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...options.headers
            }
          };

          const req = client.request(url, requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              resolve({
                ok: res.statusCode >= 200 && res.statusCode < 300,
                statusCode: res.statusCode,
                data: data,
                headers: res.headers
              });
            });
          });

          // 超时处理 (基于 mcp-health-check.js 模式)
          const timeout = options.timeout || 30000;
          req.setTimeout(timeout, () => {
            req.destroy(new Error('Request timeout'));
          });

          req.on('error', (error) => {
            resolve({
              ok: false,
              statusCode: null,
              data: '',
              error: error.message
            });
          });

          // 写入请求体
          if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
          }

          req.end();
        } catch (error) {
          resolve({
            ok: false,
            statusCode: null,
            data: '',
            error: error.message
          });
        }
      });
    }
  };
}

module.exports = { createHttpClient };
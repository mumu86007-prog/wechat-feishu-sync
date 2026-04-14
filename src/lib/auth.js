// 飞书认证模块 - 基于X API OAuth token管理模式的错误处理
const { createHttpClient } = require('../utils/http');
const { TokenExpiredError, logError } = require('./errors');

class FeishuAuth {
  constructor(appId, appSecret) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.accessToken = null;
    this.tokenExpiry = 0; // 时间戳，毫秒
    this.httpClient = createHttpClient();
  }

  /**
   * 获取有效的tenant_access_token (参考X API OAuth token管理)
   */
  async getAccessToken() {
    try {
      // 检查缓存的token是否仍然有效 (2小时有效期，留1分钟缓冲)
      if (this.accessToken && Date.now() < (this.tokenExpiry - 60000)) {
        return this.accessToken;
      }

      // 获取新token
      const response = await this.httpClient.request(
        'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        {
          method: 'POST',
          body: {
            app_id: this.appId,
            app_secret: this.appSecret
          }
        }
      );

      if (!response.ok) {
        logError('FeishuAuth', new Error(`Failed to get access token: ${response.statusCode}`), {
          response: response.data
        });
        throw new Error(`Failed to get access token: HTTP ${response.statusCode}`);
      }

      const data = JSON.parse(response.data);

      if (data.code !== 0) {
        logError('FeishuAuth', new Error(`Feishu API error: ${data.msg}`), {
          code: data.code,
          msg: data.msg
        });
        throw new Error(`Feishu API error: ${data.msg}`);
      }

      // 缓存token (有效期2小时，转换为毫秒)
      this.accessToken = data.tenant_access_token;
      this.tokenExpiry = Date.now() + (data.expire * 1000);

      console.log(`[FeishuAuth] Token refreshed, expires at ${new Date(this.tokenExpiry)}`);
      return this.accessToken;
    } catch (error) {
      logError('FeishuAuth', error);
      throw error;
    }
  }

  /**
   * 检查token是否需要刷新
   */
  isTokenExpired() {
    return !this.accessToken || Date.now() >= this.tokenExpiry;
  }

  /**
   * 清除缓存的token
   */
  clearToken() {
    this.accessToken = null;
    this.tokenExpiry = 0;
  }
}

module.exports = FeishuAuth;
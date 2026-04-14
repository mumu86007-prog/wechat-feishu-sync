// 飞书API客户端 - 基于探索发现的API集成模式
const { createHttpClient } = require('../utils/http');
const { PermissionDeniedError, RateLimitedError, logError } = require('./errors');

class FeishuAPI {
  constructor(auth) {
    this.auth = auth;
    this.httpClient = createHttpClient();
    this.baseURL = 'https://open.feishu.cn/open-apis';
  }

  /**
   * 验证飞书表格配置 (GET /api/verify 的核心逻辑)
   */
  async verifyTableConfig(appToken, tableId) {
    try {
      const accessToken = await this.auth.getAccessToken();

      const response = await this.httpClient.request(
        `${this.baseURL}/bitable/v1/apps/${appToken}/tables`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );

      if (!response.ok) {
        if (response.statusCode === 401) {
          this.auth.clearToken();
          throw new Error('Token expired');
        }
        if (response.statusCode === 403) {
          throw new PermissionDeniedError('No permission to access table');
        }
        if (response.statusCode === 429) {
          const retryAfter = parseInt(response.headers['retry-after']) || 60;
          throw new RateLimitedError('Rate limit exceeded', retryAfter);
        }
        throw new Error(`Verify table failed: HTTP ${response.statusCode}`);
      }

      const data = JSON.parse(response.data);
      if (data.code !== 0) {
        throw new Error(`Feishu API error: ${data.msg}`);
      }

      const tables = data.data?.items || [];
      const matched = tables.find(t => t.table_id === tableId);
      if (!matched) {
        throw new Error(`Table not found: ${tableId}`);
      }

      return {
        success: true,
        tableName: matched.name || 'Unknown',
        appToken,
        tableId
      };
    } catch (error) {
      logError('FeishuAPI', error, { appToken, tableId });
      throw error;
    }
  }

  /**
   * 同步聊天记录到飞书表格 (POST /api/sync 的核心逻辑)
   */
  async syncChatRecord(appToken, tableId, groupName, chatContent, remark = '', imageTokens = []) {
    try {
      const accessToken = await this.auth.getAccessToken();

      // 构建记录数据 (根据PRD字段设计)
      const fields = {
        '群名': groupName,
        '聊天记录': chatContent,
        '同步时间': new Date().toISOString().slice(0, 19).replace('T', ' ')
      };
      if (imageTokens.length > 0) {
        fields['图片'] = imageTokens.map(t => ({ file_token: t.file_token, name: t.file_name || 'image.jpg' }));
      }
      const recordData = { fields };

      const response = await this.httpClient.request(
        `${this.baseURL}/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: recordData
        }
      );

      if (!response.ok) {
        if (response.statusCode === 401) {
          this.auth.clearToken();
          throw new Error('Token expired');
        }

        if (response.statusCode === 403) {
          throw new PermissionDeniedError('No permission to write to table');
        }

        if (response.statusCode === 429) {
          const retryAfter = parseInt(response.headers['retry-after']) || 60;
          throw new RateLimitedError('Rate limit exceeded', retryAfter);
        }

        logError('FeishuAPI', new Error(`Sync record failed: ${response.statusCode}`), {
          response: response.data
        });
        throw new Error(`Sync record failed: HTTP ${response.statusCode}`);
      }

      const data = JSON.parse(response.data);

      if (data.code !== 0) {
        logError('FeishuAPI', new Error(`Feishu API error: ${data.msg}`), {
          code: data.code,
          msg: data.msg
        });
        throw new Error(`Feishu API error: ${data.msg}`);
      }

      return {
        success: true,
        recordId: data.data?.record?.record_id,
        createdTime: data.data?.record?.created_time
      };
    } catch (error) {
      logError('FeishuAPI', error, { appToken, tableId, groupName });
      throw error;
    }
  }
  /**
   * 上传图片到飞书，返回 file_token
   * imageBuffer: Buffer, fileName: string, appToken: string
   */
  async uploadImage(appToken, imageBuffer, fileName) {
    const accessToken = await this.auth.getAccessToken();
    const boundary = 'FeishuBoundary' + Date.now();
    const fileSize = imageBuffer.length;

    const parts = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file_name"\r\n\r\n${fileName}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="parent_type"\r\n\r\nbitable_image\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="parent_node"\r\n\r\n${appToken}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\n${fileSize}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: image/jpeg\r\n\r\n`),
      imageBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ];
    const body = Buffer.concat(parts);

    return new Promise((resolve, reject) => {
      const https = require('https');
      const options = {
        hostname: 'open.feishu.cn',
        path: '/open-apis/drive/v1/medias/upload_all',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length
        }
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.code !== 0) return reject(new Error(`飞书图片上传失败: ${parsed.msg}`));
            resolve(parsed.data.file_token);
          } catch (e) {
            reject(new Error('飞书图片上传响应解析失败'));
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  /**
   * 逐条模式：批量写入拆解后的消息记录
   */
  async syncDetailRecords(appToken, tableId, messages) {
    const accessToken = await this.auth.getAccessToken();
    const results = [];

    for (const msg of messages) {
      const fields = {
        '群名': msg.group_name,
        '聊天记录': `[${msg.message_time}] ${msg.sender ? msg.sender + ': ' : ''}${msg.content}`,
        '同步时间': new Date().toISOString().slice(0, 19).replace('T', ' ')
      };

      const response = await this.httpClient.request(
        `${this.baseURL}/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: { fields }
        }
      );

      if (!response.ok) {
        logError('FeishuAPI', new Error(`Detail record failed: ${response.statusCode}`), { msg });
        continue;
      }

      const data = JSON.parse(response.data);
      if (data.code === 0) {
        results.push(data.data.record.record_id);
      }
    }

    return results;
  }
}

module.exports = FeishuAPI;
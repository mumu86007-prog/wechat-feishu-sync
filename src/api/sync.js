// POST /api/sync - 核心同步功能 (优先实现)
const { z } = require('zod');
const FeishuAPI = require('../lib/feishu');
const FeishuAuth = require('../lib/auth');
const { formatErrorResponse, InvalidInputError, logError } = require('../lib/errors');

// 输入验证schema (基于PRD的8000字符限制)
const SyncRequestSchema = z.object({
  group_name: z.string().min(1, '群名不能为空').max(100, '群名过长'),
  chat_content: z.string().min(1, '聊天记录不能为空').max(8000, '聊天记录不能超过8000字符'),
  feishu_app_token: z.string().min(1, '飞书App Token不能为空'),
  feishu_table_id: z.string().min(1, '飞书Table ID不能为空'),
  layout_mode: z.enum(['archive', 'detail']).default('archive'),
  sync_mode: z.enum(['append', 'merge', 'overwrite']).default('append'),
  remark: z.string().max(200).optional()
});

/**
 * 解析微信聊天记录文本，拆分为逐条消息
 * 支持格式: "2024-04-09 10:30:12 张三\n消息内容"
 */
function parseChatMessages(groupName, chatContent, remark) {
  const lines = chatContent.split('\n').map(l => l.trim()).filter(Boolean);
  const messages = [];
  const timePattern = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)\s+(.+)$/;

  let currentSender = '';
  let currentTime = '';
  let currentLines = [];

  const flush = () => {
    if (currentLines.length > 0) {
      messages.push({
        group_name: groupName,
        sender: currentSender,
        message_time: currentTime,
        content: currentLines.join('\n'),
        remark: remark || ''
      });
      currentLines = [];
    }
  };

  for (const line of lines) {
    const match = line.match(timePattern);
    if (match) {
      flush();
      currentTime = match[1];
      currentSender = match[2];
    } else {
      currentLines.push(line);
    }
  }
  flush();

  // 无法解析时降级：整段作为一条
  if (messages.length === 0) {
    messages.push({
      group_name: groupName,
      sender: '',
      message_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
      content: chatContent,
      remark: remark || ''
    });
  }

  return messages;
}

const syncHandler = async (req, res) => {
  try {
    // 输入验证
    const validationResult = SyncRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new InvalidInputError(`输入验证失败: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
    }

    const { group_name, chat_content, feishu_app_token, feishu_table_id, layout_mode, remark } = validationResult.data;
    const imageTokens = Array.isArray(req.body.image_tokens) ? req.body.image_tokens : [];

    // 优先使用请求体中的凭证，否则回退到环境变量
    const appId = req.body.feishu_app_id || process.env.FEISHU_APP_ID;
    const appSecret = req.body.feishu_app_secret || process.env.FEISHU_APP_SECRET;
    const auth = new FeishuAuth(appId, appSecret);
    const feishuAPI = new FeishuAPI(auth);

    let responseData;

    if (layout_mode === 'detail') {
      // 逐条模式：解析拆分后逐条写入
      const messages = parseChatMessages(group_name, chat_content, remark);
      const results = await feishuAPI.syncDetailRecords(feishu_app_token, feishu_table_id, messages);
      responseData = {
        layout_mode: 'detail',
        group_name,
        total_messages: messages.length,
        records_created: results.length,
        sync_time: new Date().toISOString()
      };
    } else {
      // 归档模式（默认）：整群合并为一行
      const result = await feishuAPI.syncChatRecord(
        feishu_app_token,
        feishu_table_id,
        group_name,
        chat_content,
        remark,
        imageTokens
      );
      responseData = {
        layout_mode: 'archive',
        record_id: result.recordId,
        created_time: result.createdTime,
        group_name,
        sync_time: new Date().toISOString()
      };
    }

    res.json({ success: true, data: responseData });

  } catch (error) {
    logError('SyncAPI', error, { body: req.body });

    if (error instanceof InvalidInputError) {
      return res.status(400).json(formatErrorResponse(error));
    }

    // 处理飞书API特定错误
    if (error.message.includes('Token expired')) {
      return res.status(401).json(formatErrorResponse(new Error('飞书Token已过期，请稍后重试')));
    }

    if (error.message.includes('No permission')) {
      return res.status(403).json(formatErrorResponse(new Error('无权限操作飞书表格')));
    }

    if (error.message.includes('Rate limit')) {
      return res.status(429).json(formatErrorResponse(new Error('飞书API频率限制，请稍后重试')));
    }

    res.status(500).json(formatErrorResponse(error));
  }
};

module.exports = syncHandler;
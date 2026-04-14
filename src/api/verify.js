// GET /api/verify - 配置验证功能 (优先实现)
const FeishuAPI = require('../lib/feishu');
const FeishuAuth = require('../lib/auth');
const { formatErrorResponse, InvalidInputError, logError } = require('../lib/errors');

const verifyHandler = async (req, res) => {
  try {
    const { app_token, table_id } = req.query;

    // 输入验证
    if (!app_token || !table_id) {
      throw new InvalidInputError('Missing required parameters: app_token and table_id');
    }

    // 创建飞书认证和API客户端
    const auth = new FeishuAuth(process.env.FEISHU_APP_ID, process.env.FEISHU_APP_SECRET);
    const feishuAPI = new FeishuAPI(auth);

    // 验证表格配置
    const result = await feishuAPI.verifyTableConfig(app_token, table_id);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logError('VerifyAPI', error, { query: req.query });

    if (error instanceof InvalidInputError) {
      return res.status(400).json(formatErrorResponse(error));
    }

    res.status(500).json(formatErrorResponse(error));
  }
};

module.exports = verifyHandler;
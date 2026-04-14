// POST /api/feishu/verify-config - 验证用户提供的飞书 App ID 和 App Secret
const FeishuAuth = require('../lib/auth');
const { formatErrorResponse, InvalidInputError, logError } = require('../lib/errors');

const verifyConfigHandler = async (req, res) => {
  try {
    const { app_id, app_secret } = req.body;

    if (!app_id || !app_secret) {
      throw new InvalidInputError('Missing required parameters: app_id and app_secret');
    }

    // 用用户提供的凭证尝试获取 access token
    const auth = new FeishuAuth(app_id, app_secret);
    await auth.getAccessToken();

    res.json({ success: true, message: '配置验证成功' });
  } catch (error) {
    logError('VerifyConfigAPI', error, { body: req.body });

    if (error instanceof InvalidInputError) {
      return res.status(400).json(formatErrorResponse(error));
    }

    res.status(200).json({ success: false, message: 'App ID 或 App Secret 不正确，请重新检查' });
  }
};

module.exports = verifyConfigHandler;

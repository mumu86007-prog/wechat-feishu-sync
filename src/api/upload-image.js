// POST /api/upload-image - 接收小程序上传的图片，转存到飞书
const multer = require('multer');
const FeishuAPI = require('../lib/feishu');
const FeishuAuth = require('../lib/auth');
const { formatErrorResponse, InvalidInputError, logError } = require('../lib/errors');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 最大 10MB
});

const uploadImageHandler = [
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        throw new InvalidInputError('未收到图片文件');
      }

      const appToken = req.body.app_token;
      if (!appToken) {
        throw new InvalidInputError('缺少 app_token 参数');
      }

      const appId = req.body.feishu_app_id || process.env.FEISHU_APP_ID;
      const appSecret = req.body.feishu_app_secret || process.env.FEISHU_APP_SECRET;

      const auth = new FeishuAuth(appId, appSecret);
      const feishuAPI = new FeishuAPI(auth);

      const fileName = req.file.originalname || `image_${Date.now()}.jpg`;
      const fileToken = await feishuAPI.uploadImage(appToken, req.file.buffer, fileName);

      res.json({ success: true, file_token: fileToken, file_name: fileName });
    } catch (error) {
      logError('UploadImageAPI', error);
      if (error instanceof InvalidInputError) {
        return res.status(400).json(formatErrorResponse(error));
      }
      res.status(500).json(formatErrorResponse(error));
    }
  }
];

module.exports = uploadImageHandler;

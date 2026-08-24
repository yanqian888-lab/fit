/**
 * 语音输入/输出控制器
 */
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { success, error } = require('../utils/response');
const voiceService = require('../services/voiceService');
const { staticUrl } = require('../utils/staticUrl');

const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const voiceStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `voice_${req.userId}_${Date.now()}${ext}`);
  }
});

const voiceUpload = multer({
  storage: voiceStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/', 'video/webm'];
    if (allowed.some(t => file.mimetype && file.mimetype.startsWith(t))) {
      cb(null, true);
    } else {
      cb(new Error('仅支持上传音频文件'));
    }
  }
});

function transcribe(req, res) {
  voiceUpload.single('audio')(req, res, async (err) => {
    if (err) {
      const message = err instanceof multer.MulterError
        ? (err.code === 'LIMIT_FILE_SIZE' ? '音频大小不能超过 10MB' : err.message)
        : err.message;
      return res.status(400).json(error(message, 400));
    }
    if (!req.file) {
      return res.status(400).json(error('缺少音频文件', 400));
    }

    const result = await voiceService.transcribe(req.file.path);
    if (result.error) {
      return res.status(503).json(error(result.error, 503));
    }
    return res.json(success({ text: result.text }, '识别成功'));
  });
}

async function textToSpeech(req, res) {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json(error('缺少文本', 400));
  }

  const result = await voiceService.tts(text.trim());
  if (result.error) {
    return res.status(503).json(error(result.error, 503));
  }

  const url = staticUrl(req, result.url);
  return res.json(success({ url }, '合成成功'));
}

module.exports = {
  transcribe,
  textToSpeech
};

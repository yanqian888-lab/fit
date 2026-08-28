/**
 * 通用文件上传
 */
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { success, error } = require('../utils/response');
const { staticUrl } = require('../utils/staticUrl');

const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const ownerId = req.userId || req.cmsUserId || 0;
    cb(null, `img_${ownerId}_${Date.now()}${ext}`);
  }
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // 双重校验：MIME类型 + 文件扩展名白名单
    // MIME 可被客户端伪造，必须同时校验扩展名防止恶意文件上传
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype && file.mimetype.startsWith('image/') && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持上传 jpg、png、gif、webp、bmp 格式的图片文件'));
    }
  }
});

function uploadImage(req, res) {
  imageUpload.single('image')(req, res, (err) => {
    if (err) {
      const message = err instanceof multer.MulterError
        ? (err.code === 'LIMIT_FILE_SIZE' ? '图片大小不能超过 5MB' : err.message)
        : err.message;
      return res.status(400).json(error(message, 400));
    }
    if (!req.file) {
      return res.status(400).json(error('请选择要上传的图片', 400));
    }

    // 返回相对路径（不含域名），由前端根据环境拼接服务器地址
    // 这样开发/测试/生产环境都能正确访问，避免 localhost 硬编码问题
    const url = `/static/uploads/${req.file.filename}`;
    return res.json(success({ url }, '上传成功'));
  });
}

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const ownerId = req.userId || req.cmsUserId || 0;
    cb(null, `video_${ownerId}_${Date.now()}${ext}`);
  }
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // 双重校验：MIME类型 + 文件扩展名白名单
    const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
    const allowedExts = ['.mp4', '.mov', '.webm', '.avi'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype && allowedMimeTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持上传 MP4/MOV/WebM/AVI 格式的视频文件'));
    }
  }
});

function uploadVideo(req, res) {
  videoUpload.single('video')(req, res, (err) => {
    if (err) {
      const message = err instanceof multer.MulterError
        ? (err.code === 'LIMIT_FILE_SIZE' ? '视频大小不能超过 200MB' : err.message)
        : err.message;
      return res.status(400).json(error(message, 400));
    }
    if (!req.file) {
      return res.status(400).json(error('请选择要上传的视频', 400));
    }

    // 返回相对路径（不含域名），由前端根据环境拼接服务器地址
    // 这样开发/测试/生产环境都能正确访问，避免 localhost 硬编码问题
    const url = `/static/uploads/${req.file.filename}`;
    return res.json(success({ url }, '上传成功'));
  });
}

module.exports = { uploadImage, uploadVideo };

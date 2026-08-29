/**
 * 将前端需要的远程图片同步到后端 public/image/icon/ 目录
 * 优先从生产环境 /static/image/icon/ 下载（保持已压缩版本），
 * 生产不存在时从本地 appstatic 复制并压缩。
 * 用于保证本地 dev 与生产远程图片地址一致。
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('sharp');

// 生产环境 CDN 域名
const PROD_BASE = 'https://api.fit.mianyan.xin';
// 本地后端目标目录
const TARGET_DIR = path.join(__dirname, '../../backend/public/image/icon');
// 本地 appstatic 源目录
const APPSTATIC_DIR = path.join(__dirname, '../../backend/public/appstatic/image/icon');

// 需要同步的图片列表（本次要远程化的大图/背景图）
const IMAGES = [
  'background_zhu01.jpg',
  'background_zhu02.jpg',
  'background_zhu03.jpg',
  'liaoliao01@3x.png',
  'gongjvxiang01@3x.png',
  'quesheng01.png',
  'sun.png',
  'zhuan.png',
  'rou.png',
  'xianhua@3x.png',
  'jiangguo@3x.png'
];

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { timeout: 30000 }, (res) => {
        if (res.statusCode !== 200) {
          file.destroy();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      })
      .on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

async function compressImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const originalSize = fs.statSync(filePath).size;
  let pipeline = sharp(filePath);
  const metadata = await pipeline.metadata();

  const isLarge = originalSize > 100 * 1024;
  const maxDimension = ext === '.png' ? (isLarge ? 720 : 1024) : (isLarge ? 1000 : 1920);
  if (metadata.width > maxDimension || metadata.height > maxDimension) {
    pipeline = pipeline.resize({
      width: metadata.width > metadata.height ? maxDimension : undefined,
      height: metadata.height >= metadata.width ? maxDimension : undefined,
      fit: 'inside',
      withoutEnlargement: true
    });
  }

  if (ext === '.png') {
    const pngQuality = isLarge ? 65 : 80;
    pipeline = pipeline.png({ quality: pngQuality, compressionLevel: 9, adaptiveFiltering: true, dither: 1.0 });
  } else {
    const jpegQuality = isLarge ? 55 : 80;
    pipeline = pipeline.jpeg({ quality: jpegQuality, progressive: false, mozjpeg: false });
  }

  const buffer = await pipeline.toBuffer();
  fs.writeFileSync(filePath, buffer);
  return { original: originalSize, compressed: buffer.length };
}

async function syncImage(name) {
  const targetPath = path.join(TARGET_DIR, name);

  // 1. 尝试从生产 /static/image/icon/ 下载（保持已压缩版本）
  try {
    await downloadFile(`${PROD_BASE}/static/image/icon/${name}`, targetPath);
    const size = fs.statSync(targetPath).size;
    console.log(`✅ ${name}: 从生产下载 (${(size / 1024).toFixed(1)}KB)`);
    return;
  } catch (e) {
    // 生产不存在或下载失败，继续本地处理
  }

  // 2. 从本地 appstatic 复制并压缩
  const sourcePath = path.join(APPSTATIC_DIR, name);
  if (!fs.existsSync(sourcePath)) {
    console.log(`❌ ${name}: 本地 appstatic 也不存在，跳过`);
    return;
  }

  fs.copyFileSync(sourcePath, targetPath);
  const before = fs.statSync(targetPath).size;
  try {
    const result = await compressImage(targetPath);
    console.log(
      `✅ ${name}: 从 appstatic 复制并压缩 ${(result.original / 1024).toFixed(1)}KB → ${(
        result.compressed / 1024
      ).toFixed(1)}KB`
    );
  } catch (err) {
    console.log(`⚠️ ${name}: 复制成功但压缩失败 (${err.message})，保留原图 ${(before / 1024).toFixed(1)}KB`);
  }
}

async function main() {
  await ensureDir(TARGET_DIR);
  for (const name of IMAGES) {
    await syncImage(name);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

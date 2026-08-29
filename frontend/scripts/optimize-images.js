/**
 * 图片压缩脚本：批量压缩 static 目录下过大的 PNG/JPG/JPEG 资源
 * 用于控制小程序主包体积，满足 <1.5M 主包和 <200K 单图的要求
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const STATIC_DIR = path.join(__dirname, '../static');
const EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
// 超过 5KB 即压缩，进一步压减主包内累计的小图体积
const MIN_SIZE_BYTES = 5 * 1024;

async function getAllImageFiles(dir) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getAllImageFiles(fullPath)));
    } else if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

async function compressImage(filePath) {
  const stat = await fs.promises.stat(filePath);
  if (stat.size <= MIN_SIZE_BYTES) return null;

  const ext = path.extname(filePath).toLowerCase();
  const originalSize = stat.size;
  let pipeline = sharp(filePath);
  const metadata = await pipeline.metadata();

  // 限制最大边长，避免无意义的大图进入主包；对仍大于 100KB 的文件进一步收紧
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
    // PNG 使用 8-bit palette + 量化；大图进一步降低质量
    const pngQuality = isLarge ? 65 : 80;
    pipeline = pipeline.png({ quality: pngQuality, compressionLevel: 9, adaptiveFiltering: true, dither: 1.0 });
  } else {
    // JPEG 使用 55-80 质量，关闭 progressive 以减小体积
    const jpegQuality = isLarge ? 55 : 80;
    pipeline = pipeline.jpeg({ quality: jpegQuality, progressive: false, mozjpeg: false });
  }

  const buffer = await pipeline.toBuffer();
  await fs.promises.writeFile(filePath, buffer);

  return {
    file: path.relative(STATIC_DIR, filePath),
    original: originalSize,
    compressed: buffer.length,
    ratio: ((1 - buffer.length / originalSize) * 100).toFixed(1)
  };
}

async function main() {
  const files = await getAllImageFiles(STATIC_DIR);
  console.log(`扫描到 ${files.length} 张图片`);

  const results = [];
  for (const file of files) {
    try {
      const result = await compressImage(file);
      if (result) results.push(result);
    } catch (err) {
      console.error(`压缩失败 ${file}:`, err.message);
    }
  }

  if (results.length === 0) {
    console.log('没有需要压缩的图片');
    return;
  }

  console.log('\n压缩结果：');
  let totalOriginal = 0;
  let totalCompressed = 0;
  results
    .sort((a, b) => b.original - a.original)
    .forEach(r => {
      totalOriginal += r.original;
      totalCompressed += r.compressed;
      console.log(
        `${r.file}: ${(r.original / 1024).toFixed(1)}KB → ${(r.compressed / 1024).toFixed(1)}KB (${r.ratio}%)`
      );
    });
  console.log(
    `\n总计: ${(totalOriginal / 1024).toFixed(1)}KB → ${(totalCompressed / 1024).toFixed(1)}KB ` +
    `(-${((1 - totalCompressed / totalOriginal) * 100).toFixed(1)}%)`
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

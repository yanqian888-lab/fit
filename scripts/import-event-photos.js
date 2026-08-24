#!/usr/bin/env node
/**
 * 批量导入事件照片（幂等）
 *
 * 规则：文件夹内照片命名为数字 N（如 1.jpg），对应事件 id = N + offset。
 * 照片复制到 backend/public/uploads/ 并写入 pet_event_photos（is_enabled=1）。
 *
 * 用法：
 *   node scripts/import-event-photos.js <照片文件夹> --offset 10 [--base http://localhost:3000]
 * 示例（多巴胺生长记：1.jpg~35.jpg -> 事件 id 11~45）：
 *   node scripts/import-event-photos.js image/多巴胺生长记 --offset 10
 */
const fs = require('fs');
const path = require('path');
const { db } = require('../backend/src/db');

const args = process.argv.slice(2);
const folder = args[0];
const offsetIdx = args.indexOf('--offset');
const baseIdx = args.indexOf('--base');
const offset = offsetIdx >= 0 ? parseInt(args[offsetIdx + 1], 10) : 0;
const baseUrl = (baseIdx >= 0 ? args[baseIdx + 1] : 'http://localhost:3000').replace(/\/$/, '');

if (!folder || !fs.existsSync(folder)) {
  console.error('用法: node scripts/import-event-photos.js <照片文件夹> --offset <n> [--base <url>]');
  process.exit(1);
}

const uploadDir = path.join(__dirname, '../backend/public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const files = fs.readdirSync(folder)
  .filter(f => /^\d+\.(jpg|jpeg|png|gif)$/i.test(f))
  .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

if (files.length === 0) {
  console.error('文件夹内没有找到数字命名的图片');
  process.exit(1);
}

const findEvent = db.prepare('SELECT id, title FROM pet_events_lib WHERE id = ?');
const existsPhoto = db.prepare('SELECT id FROM pet_event_photos WHERE event_id = ? AND photo_url LIKE ?');
const insertPhoto = db.prepare('INSERT INTO pet_event_photos (event_id, photo_url, sort_order, is_enabled) VALUES (?, ?, 0, 1)');

let inserted = 0;
let skipped = 0;
let missing = 0;

for (const file of files) {
  const num = parseInt(file, 10);
  const eventId = num + offset;
  const event = findEvent.get(eventId);
  if (!event) {
    console.log(`  跳过 ${file}：事件 id ${eventId} 不存在`);
    missing++;
    continue;
  }
  const ext = path.extname(file).toLowerCase();
  const newName = `img_event_${eventId}_${num}${ext}`;
  const url = `${baseUrl}/static/uploads/${newName}`;
  if (existsPhoto.get(eventId, `%${newName}`)) {
    skipped++;
    continue;
  }
  fs.copyFileSync(path.join(folder, file), path.join(uploadDir, newName));
  insertPhoto.run(eventId, url);
  inserted++;
}

console.log(`照片导入完成: 新增 ${inserted} 张，已存在跳过 ${skipped} 张，事件不存在跳过 ${missing} 张`);

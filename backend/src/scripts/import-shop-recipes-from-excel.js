/**
 * 从 word/健康食谱表.xlsx 导入/更新商店食物商品的食谱数据
 * 功能：
 * 1. 按食谱标题匹配 shop_items（category='food'）
 * 2. 将 Excel 中的食材、做法、小贴士、总重量、总热量写入 effect_json.recipe.extracted_data
 * 3. 同时把小贴士更新到 shop_items.description
 * 运行：cd backend && node src/scripts/import-shop-recipes-from-excel.js
 */
const XLSX = require('xlsx');
const path = require('path');
const { db } = require('../db');
const { safeJsonParse } = require('../utils/safeJson');

const EXCEL_FILE = path.join(__dirname, '../../../word/健康食谱表.xlsx');

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (e) {
    return null;
  }
}

/**
 * 解析食材文本为结构化数组
 * @param {string} text 食材文本，每行 "名称 用量"
 * @returns {Array<{name:string, amount:string}>}
 */
function parseIngredients(text) {
  if (!text) return [];
  return text.split(/\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(line => {
      // 匹配 "名称 用量" 或 "名称用量"
      const match = line.match(/^(.+?)\s+(\d+(?:\.\d+)?\s*[\u4e00-\u9fa5a-zA-Z]+)$/);
      if (match) return { name: match[1].trim(), amount: match[2].trim().replace(/\s+/g, '') };
      const match2 = line.match(/^(.+?)(\d+(?:\.\d+)?[\u4e00-\u9fa5a-zA-Z]+)$/);
      if (match2) return { name: match2[1].trim(), amount: match2[2].trim() };
      return { name: line, amount: '适量' };
    });
}

/**
 * 解析做法步骤文本
 * @param {string} text 做法文本
 * @returns {string} 清洗后的做法文本
 */
function parseSteps(text) {
  if (!text || text === '/') return '';
  return text.trim();
}

/**
 * 从 Excel 构建完整的食谱内容字符串
 * @param {object} row Excel 行对象
 * @returns {string}
 */
function buildRecipeContent(row) {
  const parts = [];
  if (row.ingredients) {
    parts.push(`【食材】\n${row.ingredients}`);
  }
  if (row.steps && row.steps !== '/') {
    parts.push(`【做法步骤】\n${row.steps}`);
  }
  if (row.tip) {
    parts.push(`【小贴士】\n${row.tip}`);
  }
  return parts.join('\n\n');
}

function importRecipes() {
  if (!require('fs').existsSync(EXCEL_FILE)) {
    console.error('Excel 文件不存在:', EXCEL_FILE);
    process.exit(1);
  }

  const wb = XLSX.readFile(EXCEL_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const header = rawRows[0];
  console.log('Excel 表头:', header);

  // 列索引映射
  const colIndex = {
    no: header.indexOf('序号'),
    title: header.indexOf('食谱标题'),
    ingredients: header.indexOf('食材'),
    steps: header.indexOf('做法步骤'),
    tip: header.indexOf('小贴士'),
    totalWeight: header.indexOf('总重量(g)'),
    totalCalorie: header.indexOf('总热量(kcal/份)')
  };

  if (Object.values(colIndex).some(idx => idx < 0)) {
    console.error('Excel 表头缺失必要列:', colIndex);
    process.exit(1);
  }

  const rows = rawRows.slice(1).map(cols => ({
    no: cols[colIndex.no],
    title: String(cols[colIndex.title] || '').trim(),
    ingredients: String(cols[colIndex.ingredients] || '').trim(),
    steps: String(cols[colIndex.steps] || '').trim(),
    tip: String(cols[colIndex.tip] || '').trim(),
    totalWeight: parseFloat(cols[colIndex.totalWeight]) || 0,
    totalCalorie: parseFloat(cols[colIndex.totalCalorie]) || 0
  })).filter(r => r.title);

  console.log(`Excel 中共 ${rows.length} 条食谱`);

  const findShop = db.prepare(`
    SELECT id, name, effect_json, description FROM shop_items
    WHERE category = 'food' AND name = ? AND status = 1
    LIMIT 1
  `);
  const updateShop = db.prepare(`
    UPDATE shop_items
    SET effect_json = ?, description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  let matched = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const shopItem = findShop.get(row.title);
    if (!shopItem) {
      skipped++;
      continue;
    }
    matched++;

    const effect = safeJsonParse(shopItem.effect_json) || {};
    const existingRecipe = effect.recipe || {};
    const existingExtracted = existingRecipe.extracted_data || {};

    const ingredients = parseIngredients(row.ingredients);
    const steps = parseSteps(row.steps);
    const content = buildRecipeContent(row);

    const extractedData = {
      ...existingExtracted,
      title: row.title,
      content,
      image: existingExtracted.image || effect.image || shopItem.icon_url || '',
      ingredients,
      steps,
      tip: row.tip,
      total_weight: row.totalWeight || existingExtracted.total_weight || 0,
      total_calorie: row.totalCalorie || existingExtracted.total_calorie || 0
    };

    const newEffect = {
      ...effect,
      recipe: {
        ...existingRecipe,
        title: row.title,
        content,
        extracted_data: extractedData
      }
    };

    const newEffectJson = safeJsonStringify(newEffect);
    if (!newEffectJson) {
      console.error(`[错误] ${row.title} JSON 序列化失败`);
      skipped++;
      continue;
    }

    updateShop.run(newEffectJson, row.tip || shopItem.description || '', shopItem.id);
    updated++;
    console.log(`[更新] ${row.title} 总重=${extractedData.total_weight}g 热量=${extractedData.total_calorie}kcal`);
  }

  console.log(`\n导入完成：匹配 ${matched} 条，更新 ${updated} 条，跳过 ${skipped} 条`);
  db.close();
}

importRecipes();

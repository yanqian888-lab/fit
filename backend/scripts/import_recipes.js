/**
 * 将 recipes.json 批量灌入 shop_items.effect_json
 * 匹配规则：食谱标题与食物名称完全匹配或互相包含（忽略前后空格）
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = '/opt/jianfeidazi/backend/data/app_production.db';
const RECIPES_PATH = '/opt/jianfeidazi/backend/scripts/recipes.json';

const recipes = JSON.parse(fs.readFileSync(RECIPES_PATH, 'utf8'));
const db = new Database(DB_PATH);

// 查询所有食物商品
const foods = db.prepare("SELECT id, name, effect_json FROM shop_items WHERE category = 'food' ORDER BY id").all();
console.log(`数据库中食物商品总数: ${foods.length}`);
console.log(`xlsx 食谱总数: ${recipes.length}`);

let matched = 0;
let unmatched = 0;
const unmatchedRecipes = [];
const updateStmt = db.prepare(`
  UPDATE shop_items
  SET effect_json = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

for (const recipe of recipes) {
  const title = String(recipe.title || '').trim();
  if (!title) {
    unmatched++;
    continue;
  }

  // 匹配规则：完全相等 或 互相包含（忽略大小写和空格）
  const food = foods.find(f => {
    const name = String(f.name || '').trim();
    if (!name) return false;
    const t = title.toLowerCase().replace(/\s+/g, '');
    const n = name.toLowerCase().replace(/\s+/g, '');
    return t === n || t.includes(n) || n.includes(t);
  });

  if (!food) {
    unmatched++;
    unmatchedRecipes.push(title);
    continue;
  }

  // 解析现有 effect_json，保留原有字段
  let effect = {};
  try {
    effect = JSON.parse(food.effect_json || '{}');
  } catch (_) {
    effect = {};
  }

  // 更新/填充 recipe 和营养信息
  effect.type = effect.type || 'food';
  effect.nutrition = effect.nutrition || {};
  effect.nutrition.calories = String(recipe.total_calorie ?? effect.nutrition.calories ?? '');
  effect.nutrition.weight = String(recipe.total_weight ?? effect.nutrition.weight ?? '');

  effect.recipe = {
    title: recipe.title,
    ingredients: recipe.ingredients || '',
    steps: recipe.steps || '',
    tips: recipe.tips || ''
  };

  const effectJson = JSON.stringify(effect);
  updateStmt.run(effectJson, food.id);
  matched++;
  console.log(`已更新 [${food.id}] ${food.name} <- ${title}`);
}

console.log('\n===== 统计 =====');
console.log(`匹配并更新: ${matched}`);
console.log(`未匹配: ${unmatched}`);
if (unmatchedRecipes.length > 0) {
  console.log('\n未匹配的食谱（前30条）:');
  unmatchedRecipes.slice(0, 30).forEach(t => console.log(' - ' + t));
}

db.close();

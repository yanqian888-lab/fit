/**
 * 修复 v1 脚本造成的错误覆盖：
 * 如果食物的 effect_json.recipe.title 与食物名称差异过大（>3字），
 * 但 xlsx 中存在与食物名称完全匹配的食谱，则用完全匹配的食谱恢复。
 */
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = '/opt/jianfeidazi/backend/data/app_production.db';
const RECIPES_PATH = '/opt/jianfeidazi/backend/scripts/recipes.json';

const recipes = JSON.parse(fs.readFileSync(RECIPES_PATH, 'utf8'));
const db = new Database(DB_PATH);

const foods = db.prepare("SELECT id, name, effect_json FROM shop_items WHERE category = 'food'").all();
const updateStmt = db.prepare('UPDATE shop_items SET effect_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

let restored = 0;

for (const food of foods) {
  const name = String(food.name || '').trim();
  if (!name) continue;

  let effect = {};
  try {
    effect = JSON.parse(food.effect_json || '{}');
  } catch (_) {
    effect = {};
  }
  const recipeTitle = effect.recipe?.title || '';
  if (!recipeTitle) continue;

  const nameNorm = name.toLowerCase().replace(/\s+/g, '');
  const titleNorm = String(recipeTitle).toLowerCase().replace(/\s+/g, '');

  // 已经完全匹配的，跳过
  if (nameNorm === titleNorm) continue;

  // 查找 xlsx 中与食物名称完全匹配的食谱
  const matchedRecipe = recipes.find(r => {
    const t = String(r.title || '').trim().toLowerCase().replace(/\s+/g, '');
    return t === nameNorm;
  });

  if (!matchedRecipe) continue;

  // 用完全匹配的食谱恢复
  effect.type = effect.type || 'food';
  effect.nutrition = effect.nutrition || {};
  effect.nutrition.calories = String(matchedRecipe.total_calorie ?? effect.nutrition.calories ?? '');
  effect.nutrition.weight = String(matchedRecipe.total_weight ?? effect.nutrition.weight ?? '');
  effect.recipe = {
    title: matchedRecipe.title,
    ingredients: matchedRecipe.ingredients || '',
    steps: matchedRecipe.steps || '',
    tips: matchedRecipe.tips || ''
  };

  updateStmt.run(JSON.stringify(effect), food.id);
  restored++;
  console.log(`已恢复 [${food.id}] ${name} <- ${matchedRecipe.title}（原被 ${recipeTitle} 覆盖）`);
}

console.log(`\n共恢复 ${restored} 条错误覆盖`);
db.close();

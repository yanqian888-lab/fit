/**
 * 重新灌入食谱：避免短标题覆盖长标题（如"番茄炒蛋盖饭"覆盖"番茄炒蛋"）
 * 策略：
 * 1. 完全匹配（忽略大小写/空格）优先
 * 2. 无完全匹配时，找互相包含的候选，选择标题与名称长度差最小的
 * 3. 最小长度差 <= 3 才更新，否则视为未匹配
 */
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = '/opt/jianfeidazi/backend/data/app_production.db';
const RECIPES_PATH = '/opt/jianfeidazi/backend/scripts/recipes.json';

const recipes = JSON.parse(fs.readFileSync(RECIPES_PATH, 'utf8'));
const db = new Database(DB_PATH);

const foods = db.prepare("SELECT id, name, effect_json FROM shop_items WHERE category = 'food' ORDER BY id").all();
console.log(`数据库中食物商品总数: ${foods.length}`);
console.log(`xlsx 食谱总数: ${recipes.length}\n`);

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
  const tNorm = title.toLowerCase().replace(/\s+/g, '');

  // 1. 完全匹配
  let food = foods.find(f => {
    const name = String(f.name || '').trim();
    return name.toLowerCase().replace(/\s+/g, '') === tNorm;
  });

  // 2. 无完全匹配时，按长度差最小的互相包含匹配
  if (!food) {
    let best = null;
    let bestDiff = Infinity;
    for (const f of foods) {
      const name = String(f.name || '').trim();
      const nNorm = name.toLowerCase().replace(/\s+/g, '');
      if (tNorm.includes(nNorm) || nNorm.includes(tNorm)) {
        const diff = Math.abs(tNorm.length - nNorm.length);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = f;
        }
      }
    }
    // 长度差 <= 3 才允许匹配
    if (best && bestDiff <= 3) {
      food = best;
    }
  }

  if (!food) {
    unmatched++;
    unmatchedRecipes.push(title);
    continue;
  }

  let effect = {};
  try {
    effect = JSON.parse(food.effect_json || '{}');
  } catch (_) {
    effect = {};
  }

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

  updateStmt.run(JSON.stringify(effect), food.id);
  matched++;
  console.log(`已更新 [${food.id}] ${food.name} <- ${title}`);
}

console.log('\n===== 统计 =====');
console.log(`匹配并更新: ${matched}`);
console.log(`未匹配: ${unmatched}`);
if (unmatchedRecipes.length > 0) {
  console.log('\n未匹配的食谱:');
  unmatchedRecipes.forEach(t => console.log(' - ' + t));
}

db.close();

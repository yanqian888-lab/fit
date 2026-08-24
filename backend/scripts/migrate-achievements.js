#!/usr/bin/env node
/**
 * 成就系统整理迁移脚本（可重复执行，幂等）
 *
 * 1. collection 分类并入 event_collection（两者判定逻辑相同，统计 user_events 数量）
 * 2. body 类成就条件中的 metric: body_fat_rate 改为 body_fat
 *    （body_records.type 的合法值是 body_fat，旧值导致体脂率成就永远无法解锁）
 * 3. 合并去重完全重复的成就（规范化名称 + 分类 + 条件 + 奖励相同），
 *    用户已解锁记录迁到保留条目上，再删除多余成就
 *
 * 用法：
 *   node scripts/migrate-achievements.js
 *   NODE_ENV=production node scripts/migrate-achievements.js
 */
const { db } = require('../src/db');

const norm = (s) => String(s || '').replace(/\s+/g, '');

const migrate = db.transaction(() => {
  // 1. 分类合并
  const merged = db.prepare(
    "UPDATE achievements SET category = 'event_collection' WHERE category = 'collection'"
  ).run().changes;

  // 2. 修正 body 类条件的指标值
  let fixedBody = 0;
  const bodyRows = db.prepare("SELECT id, condition_json FROM achievements WHERE category = 'body'").all();
  const updateCond = db.prepare('UPDATE achievements SET condition_json = ? WHERE id = ?');
  for (const row of bodyRows) {
    try {
      const cond = JSON.parse(row.condition_json || '{}');
      if (cond.metric === 'body_fat_rate') {
        cond.metric = 'body_fat';
        updateCond.run(JSON.stringify(cond), row.id);
        fixedBody++;
      }
    } catch (e) { /* 跳过无法解析的行 */ }
  }

  // 3. 合并去重：同分类下「条件 + 奖励」完全一致即视为同一成就的重复录入
  // （旧种子遗留的无空格/无"累计"前缀版本，名称不同但解锁语义相同，同时满足只会重复发奖）
  const rows = db.prepare(
    'SELECT id, name, category, condition_json, reward_berries, reward_flowers FROM achievements'
  ).all();
  const groups = new Map();
  for (const r of rows) {
    let cond;
    try {
      cond = JSON.stringify(JSON.parse(r.condition_json || '{}'));
    } catch (e) {
      cond = String(r.condition_json);
    }
    const key = [r.category, cond, r.reward_berries, r.reward_flowers].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  let removed = 0;
  let remapped = 0;
  let droppedRefs = 0;
  const findRef = db.prepare('SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?');
  const listRefs = db.prepare('SELECT id, user_id FROM user_achievements WHERE achievement_id = ?');
  const moveRef = db.prepare('UPDATE user_achievements SET achievement_id = ? WHERE id = ?');
  const dropRef = db.prepare('DELETE FROM user_achievements WHERE id = ?');
  const dropAch = db.prepare('DELETE FROM achievements WHERE id = ?');

  for (const items of groups.values()) {
    if (items.length < 2) continue;
    // 保留一条：优先名称带规范空格的（与种子命名一致），其余按 id 最小
    const spaced = items.filter((i) => i.name !== norm(i.name));
    const keep = (spaced.length ? spaced : items).sort((a, b) => a.id - b.id)[0];
    for (const dup of items) {
      if (dup.id === keep.id) continue;
      for (const ref of listRefs.all(dup.id)) {
        if (findRef.get(ref.user_id, keep.id)) {
          // 用户两条都已解锁，删除多余引用
          dropRef.run(ref.id);
          droppedRefs++;
        } else {
          moveRef.run(keep.id, ref.id);
          remapped++;
        }
      }
      dropAch.run(dup.id);
      removed++;
      console.log(`  去重: [${dup.id}] ${dup.name} -> 保留 [${keep.id}] ${keep.name}`);
    }
  }

  // 4. milestone_templates 老种子坏数据清理：
  //    早期种子按位置插值导致列错位（文案进了 value 列、排序号进了 content 列、
  //    创建时间进了 is_enabled 列），表现为 value 不是数值。这类行运行时永远
  //    匹配不到（按 value = 数值 查询），且正确数据已存在，直接删除。
  let badTemplates = 0;
  const badRows = db.prepare(`
    SELECT id FROM milestone_templates
    WHERE value IS NOT NULL AND typeof(value) NOT IN ('integer', 'real')
  `).all();
  if (badRows.length) {
    const del = db.prepare('DELETE FROM milestone_templates WHERE id = ?');
    for (const row of badRows) {
      del.run(row.id);
      badTemplates++;
    }
  }

  // 5. milestone_templates 重复话术清理：同一 (type, value) 下，老一代文案把数值
  //    硬编码在文本里（改适用值后文案对不上），新一代用 {value} 占位符，保留占位符版本
  const dupTemplates = db.prepare(`
    DELETE FROM milestone_templates
    WHERE content NOT LIKE '%{value}%'
      AND EXISTS (
        SELECT 1 FROM milestone_templates t2
        WHERE t2.type = milestone_templates.type
          AND t2.value IS milestone_templates.value
          AND t2.content LIKE '%{value}%'
      )
  `).run().changes;

  // 6. 补充行为奖励收口后的默认任务（任务种子只在首次建库时跑，老库在这里补齐；按名称幂等）
  //    行为浆果奖励已收口到任务系统，记录体重/排便/每周连续签到必须有任务承载
  const newTasks = [
    { name: '记录体重', type: 'daily', condition_json: '{"action":"record_body","count":1}', reward_berries: 10, reward_flowers: 0, sort_order: 3 },
    { name: '记录排便', type: 'daily', condition_json: '{"action":"record_defecation","count":1}', reward_berries: 10, reward_flowers: 0, sort_order: 5 },
    { name: '每周连续签到', type: 'weekly', condition_json: '{"action":"checkin","count":7}', reward_berries: 0, reward_flowers: 2, sort_order: 1 }
  ];
  let addedTasks = 0;
  const taskExists = db.prepare('SELECT id FROM tasks WHERE name = ? AND type = ?');
  const insertTask = db.prepare('INSERT INTO tasks (name, type, condition_json, reward_berries, reward_flowers, sort_order, status) VALUES (?, ?, ?, ?, ?, ?, 1)');
  for (const t of newTasks) {
    if (!taskExists.get(t.name, t.type)) {
      insertTask.run(t.name, t.type, t.condition_json, t.reward_berries, t.reward_flowers, t.sort_order);
      addedTasks++;
    }
  }

  // 7. 运动记录去重：同一用户同一天跨行的同名运动合并（时长/消耗累加），腾空行删除
  const exerciseMergeService = require('../src/services/exerciseMergeService');
  const mergedExerciseItems = exerciseMergeService.mergeExistingDuplicates();

  // 8. 旧的 0 分钟跟练记录修正为 1 分钟（新逻辑已改为不足 1 分钟按 1 分钟计）
  let fixedZeroDuration = 0;
  const zeroRows = db.prepare("SELECT id, exercises FROM exercise_records WHERE is_workout = 1 AND total_duration = 0 AND status = 1").all();
  for (const row of zeroRows) {
    try {
      const list = JSON.parse(row.exercises || '[]');
      for (const ex of list) {
        if (!parseFloat(ex.duration)) ex.duration = 1;
      }
      db.prepare('UPDATE exercise_records SET exercises = ?, total_duration = 1 WHERE id = ?').run(JSON.stringify(list), row.id);
      fixedZeroDuration++;
    } catch (e) { /* 跳过无法解析的行 */ }
  }

  // 9. 食谱 extracted_data.title 脏值修正：旧链路把类型字符串当成标题写进了结构化数据
  const fixedRecipeTitles = db.prepare(`
    UPDATE museum_items
    SET extracted_data = json_set(extracted_data, '$.title', title), updated_at = CURRENT_TIMESTAMP
    WHERE type = 'recipe'
      AND title IS NOT NULL AND title != ''
      AND json_extract(extracted_data, '$.title') IN ('precipitation_recipe', 'dada_recipe', 'custom_recipe', 'recipe')
  `).run().changes;

  // 10. 食谱总克数/总热量回填（按食材经食物库估算）
  const { computeRecipeTotals } = require('../src/services/nutritionService');
  let backfilledRecipeTotals = 0;
  const recipeRows = db.prepare("SELECT id, extracted_data FROM museum_items WHERE type = 'recipe' AND status != 2").all();
  for (const row of recipeRows) {
    try {
      const data = JSON.parse(row.extracted_data || '{}');
      if (!Array.isArray(data.ingredients) || data.ingredients.length === 0) continue;
      if (data.total_weight > 0 || data.total_calorie > 0) continue; // 已有总量数据
      const totals = computeRecipeTotals(data.ingredients);
      if (totals.totalWeight <= 0 && totals.totalCalorie <= 0) continue;
      data.total_weight = totals.totalWeight;
      data.total_calorie = totals.totalCalorie;
      db.prepare('UPDATE museum_items SET extracted_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(JSON.stringify(data), row.id);
      backfilledRecipeTotals++;
    } catch (e) { /* 跳过无法解析的行 */ }
  }

  return { merged, fixedBody, removed, remapped, droppedRefs, badTemplates, dupTemplates, addedTasks, mergedExerciseItems, fixedZeroDuration, fixedRecipeTitles, backfilledRecipeTotals };
});

const result = migrate();
const total = db.prepare('SELECT COUNT(*) AS c FROM achievements').get().c;
console.log('成就迁移完成:');
console.log(`  collection 并入 event_collection: ${result.merged} 条`);
console.log(`  body_fat_rate 修正为 body_fat: ${result.fixedBody} 条`);
console.log(`  删除重复成就: ${result.removed} 条（迁移解锁记录 ${result.remapped} 条，丢弃重复解锁 ${result.droppedRefs} 条）`);
console.log(`  清理里程碑话术坏数据: ${result.badTemplates} 条`);
console.log(`  清理里程碑重复话术（硬编码数值的旧版）: ${result.dupTemplates} 条`);
console.log(`  补充默认任务（行为奖励收口）: ${result.addedTasks} 条`);
console.log(`  合并重复运动记录项: ${result.mergedExerciseItems} 条`);
console.log(`  修正 0 分钟跟练记录: ${result.fixedZeroDuration} 条`);
console.log(`  修正食谱结构化数据脏标题: ${result.fixedRecipeTitles} 条`);
console.log(`  回填食谱总克数/总热量: ${result.backfilledRecipeTotals} 条`);
console.log(`  当前成就总数: ${total}`);

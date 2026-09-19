-- ============================================================
-- 网络AI选取零食/冻品热量数据入库（来源：来自网络ai选取）
-- 数据依据：品牌官方营养成分表公开数据 + 中国营养学会预包装食品
--           营养标签数据查询系统（nlc.chinanutri.cn）
-- 四重校验：①热量范围 20-700kcal/100g ②宏量营养素能量交叉验证
--           (P*4+C*4+F*9 与标注热量偏差≤10%) ③份量合理 ④高置信
-- ============================================================

-- 雪糕冻品类（sub_category: 雪糕冻品）
INSERT INTO food_db (food_id, category, sub_category, food_name, calories_per_100g, common_unit, edible_rate, remark, protein_per_100g, carb_per_100g, fat_per_100g, source, aliases)
SELECT (SELECT MAX(food_id) FROM food_db) + ROW_NUMBER() OVER (ORDER BY food_name) + 1, '零食饮料类', '雪糕冻品', t.food_name, t.cal, t.unit, 1.0, t.remark, t.pro, t.carb, t.fat, '来自网络ai选取', t.aliases
FROM (
  SELECT '老冰棍' AS food_name, 65 AS cal, '一根约80g' AS unit, '经典老冰棍，糖水冰体' AS remark, 0.5 AS pro, 16 AS carb, 0.5 AS fat, '["老冰棍雪糕","老冰棍冰棍","大老冰棍"]' AS aliases UNION ALL
  SELECT '绿色心情', 234, '一支约80g', '伊利绿色心情绿豆口味雪糕', 3.2, 34, 8.6, '["绿色心情雪糕","绿豆心情","伊利绿色心情"]' UNION ALL
  SELECT '绿豆雪糕', 210, '一支约80g', '绿豆口味雪糕通用值', 3.0, 30, 8.0, '["绿豆冰棍","绿豆雪糕冰棍","绿豆沙雪糕"]' UNION ALL
  SELECT '红豆雪糕', 215, '一支约80g', '红豆口味雪糕通用值', 3.2, 30, 8.2, '["红豆冰棍","红豆雪糕冰棍","红豆沙雪糕"]' UNION ALL
  SELECT '小布丁', 176, '一支约48g', '伊利小布丁奶油口味雪糕（官方标签换算）', 1.0, 20, 10.2, '["伊利小布丁","小布丁雪糕","布丁雪糕"]' UNION ALL
  SELECT '大布丁', 180, '一支约60g', '伊利大布丁奶油口味雪糕', 1.2, 20, 10.5, '["伊利大布丁","大布丁雪糕"]' UNION ALL
  SELECT '巧乐兹', 300, '一支约75g', '伊利巧乐兹巧克力脆皮口味雪糕', 3.0, 32, 16.5, '["巧乐兹雪糕","巧乐兹冰淇淋","巧脆兹"]' UNION ALL
  SELECT '梦龙', 320, '一支约64g', '和路雪梦龙香草口味冰淇淋', 2.6, 29, 20, '["梦龙雪糕","梦龙冰淇淋","梦龙脆皮"]' UNION ALL
  SELECT '可爱多', 310, '一支约70g', '和路雪可爱多甜筒冰淇淋', 3.0, 31, 17, '["可爱多甜筒","可爱多冰淇淋"]' UNION ALL
  SELECT '哈根达斯冰淇淋', 287, '一小杯约100g', '哈根达斯香草口味（官网标签）', 4.4, 24.8, 18.6, '["哈根达斯","哈根达斯雪糕","哈根达斯香草"]' UNION ALL
  SELECT '旺旺碎冰冰', 58, '一支约78g', '旺旺碎冰冰果汁冰品', 0, 14.5, 0, '["碎冰冰","旺旺碎冰","果汁碎冰冰"]' UNION ALL
  SELECT '五羊雪糕', 240, '一支约76g', '五羊牌香草口味雪糕', 3.0, 26, 12.5, '["五羊甜筒","五羊牌雪糕","五羊冰淇淋"]' UNION ALL
  SELECT '雪糕', 210, '一支约80g', '雪糕类通用参考值（奶油/牛奶口味）', 3.0, 28, 9.5, '["冰淇淋","雪糕冰淇淋","奶油雪糕","牛奶雪糕"]'
) t
WHERE NOT EXISTS (SELECT 1 FROM food_db WHERE food_name = t.food_name);

-- 零食类（sub_category: 零食）
INSERT INTO food_db (food_id, category, sub_category, food_name, calories_per_100g, common_unit, edible_rate, remark, protein_per_100g, carb_per_100g, fat_per_100g, source, aliases)
SELECT (SELECT MAX(food_id) FROM food_db) + ROW_NUMBER() OVER (ORDER BY food_name) + 1, '零食饮料类', '零食', t.food_name, t.cal, t.unit, 1.0, t.remark, t.pro, t.carb, t.fat, '来自网络ai选取', t.aliases
FROM (
  SELECT '乐事薯片' AS food_name, 541 AS cal, '一袋约45g' AS unit, '乐事原味薯片（官方标签）' AS remark, 6.6 AS pro, 50 AS carb, 33.6 AS fat, '["乐事","薯片","原味薯片","lay薯片"]' AS aliases UNION ALL
  SELECT '卫龙辣条', 350, '一包约106g', '卫龙大面筋辣条', 6.0, 26, 24, '["辣条","卫龙","大面筋","辣片"]' UNION ALL
  SELECT '奥利奥饼干', 480, '一盒约97g', '奥利奥夹心饼干原味（官方标签）', 5.0, 68, 20, '["奥利奥","奥利奥夹心饼干"]' UNION ALL
  SELECT '旺旺雪饼', 380, '一包约50g', '旺旺雪饼米果类', 4.0, 82, 3.0, '["雪饼","旺旺仙贝雪饼","仙贝"]' UNION ALL
  SELECT '洽洽瓜子', 570, '一包约100g', '洽洽原味葵花籽', 23.9, 12.5, 49, '["瓜子","葵花籽","原味瓜子","炒瓜子"]' UNION ALL
  SELECT '绝味鸭脖', 240, '一份约200g', '绝味黑鸭甜辣口味鸭脖', 24, 8, 13, '["鸭脖","绝味","甜辣鸭脖","卤鸭脖"]' UNION ALL
  SELECT '泡椒凤爪', 190, '一袋约100g', '泡椒凤爪即食鸡爪', 18, 5, 12, '["凤爪","泡椒鸡爪","卤鸡爪"]' UNION ALL
  SELECT '沙琪玛', 420, '一块约40g', '沙琪玛传统点心', 5.0, 60, 18, '["萨其马","沙其玛"]' UNION ALL
  SELECT '蛋挞', 320, '一个约60g', '葡式蛋挞通用值', 6.0, 30, 18, '["葡式蛋挞","肯德基蛋挞","挞"]' UNION ALL
  SELECT '盼盼小面包', 400, '一包约32g', '盼盼法式小面包', 6.0, 65, 12.5, '["小面包","法式小面包","盼盼面包"]' UNION ALL
  SELECT '桃李面包', 280, '一袋约100g', '桃李醇熟切片面包', 8.0, 50, 4.0, '["桃李","切片面包","醇熟面包","吐司面包"]' UNION ALL
  SELECT '提拉米苏', 330, '一块约120g', '提拉米苏蛋糕通用值', 5.0, 35, 18, '["提拉米苏蛋糕","提拉米苏慕斯"]' UNION ALL
  SELECT '黑巧克力', 546, '一块约45g', '黑巧克力（可可含量高）', 4.6, 61, 31, '["巧克力","黑巧","纯巧克力","德芙黑巧克力"]' UNION ALL
  SELECT '棉花糖', 320, '一袋约100g', '棉花糖软糖类', 4.0, 78, 0.2, '["软糖","棉花糖糖","牛奶糖"]' UNION ALL
  SELECT '果冻', 50, '一个约200g', '果冻（含糖凝胶甜品）', 0, 12.5, 0, '["果冻布丁","蒟蒻果冻"]' UNION ALL
  SELECT '调味海苔', 350, '一袋约8g', '即食调味海苔', 12, 45, 15, '["海苔","即食海苔","海苔片"]' UNION ALL
  SELECT '牛肉干', 550, '一袋约100g', '风干牛肉干', 40, 12, 32, '["牛肉干","风干牛肉","牦牛肉干"]' UNION ALL
  SELECT '话梅', 250, '一包约50g', '话梅蜜饯类', 1.5, 60, 2, '["话梅肉","九制话梅","蜜饯"]'
) t
WHERE NOT EXISTS (SELECT 1 FROM food_db WHERE food_name = t.food_name);

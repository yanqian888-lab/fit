/**
 * 宠物陪伴服务
 * 四状态状态机：
 *  - home          居家：按 pet_states_lib 随机展示居家活动
 *  - meal_time     吃饭时间：三餐时段（pet_meal_times）出叹号，引导喂食
 *  - exercise_time 运动时间：晚饭后时段（pet_exercise_time）出叹号，引导运动
 *  - explore_time  逛逛时间：上午/下午/夜间按概率（pet_explore_times）外出
 * 外出中（away）不可互动、喂食、运动
 */
const { db, withTransaction } = require('../db');
const { safeJsonParse } = require('../utils/safeJson');
const { getChinaTimeStr, getChinaDateStr } = require('../utils/chinaTime');
const taskService = require('./taskService');
const achievementService = require('./achievementService');
const currencyService = require('./currencyService');
const eventDropService = require('./eventDropService');
const { getAppConfig } = require('../utils/configCache');
const { computeRecipeTotals } = require('./nutritionService');

// ==================== 默认配置（app_configs 未配置时兜底） ====================
const DEFAULT_MEAL_TIMES = {
  meals: [
    { key: 'breakfast', name: '早餐', start: '07:00', end: '09:00' },
    { key: 'lunch', name: '午餐', start: '11:30', end: '13:30' },
    { key: 'dinner', name: '晚餐', start: '17:30', end: '19:30' }
  ]
};
const DEFAULT_EXERCISE_TIME = {
  windows: [
    { key: 'evening', start: '19:30', end: '21:00' }
  ]
};
const DEFAULT_EXPLORE_TIMES = {
  windows: [
    { key: 'morning', start: '08:00', end: '11:00', probability: 0.3 },
    { key: 'afternoon', start: '14:00', end: '17:00', probability: 0.3 },
    { key: 'night', start: '20:00', end: '22:00', probability: 0.2 }
  ],
  daily_event_max: 2
};
const DEFAULT_FEED_LIMITS = { max_items_per_feed: 2, max_feeds_per_day: 6 };
const DEFAULT_EXERCISE_LIMITS = { max_per_day: 2 };

function getMealTimesConfig() {
  const cfg = getAppConfig('pet_meal_times');
  return Array.isArray(cfg.meals) && cfg.meals.length > 0 ? cfg : DEFAULT_MEAL_TIMES;
}

function getExerciseTimeConfig() {
  const cfg = getAppConfig('pet_exercise_time');
  if (Array.isArray(cfg.windows) && cfg.windows.length > 0) return cfg;
  // 兼容旧的单时段结构 {start,end}
  if (cfg.start && cfg.end) return { windows: [{ key: 'default', start: cfg.start, end: cfg.end }] };
  return DEFAULT_EXERCISE_TIME;
}

function getExploreTimesConfig() {
  const cfg = getAppConfig('pet_explore_times');
  return Array.isArray(cfg.windows) && cfg.windows.length > 0 ? cfg : DEFAULT_EXPLORE_TIMES;
}

function getFeedLimits() {
  return { ...DEFAULT_FEED_LIMITS, ...getAppConfig('pet_feed_limits') };
}

function getExerciseLimits() {
  return { ...DEFAULT_EXERCISE_LIMITS, ...getAppConfig('pet_exercise_limits') };
}

// ==================== 时间窗口工具（统一按东八区判断） ====================
function parseTimeToMinutes(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function getNowMinutes() {
  return parseTimeToMinutes(getChinaTimeStr());
}

/**
 * 判断当前时刻是否处于 [start, end] 时段内，支持跨零点（如 22:00-08:00）
 */
function isNowInRange(start, end) {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  const now = getNowMinutes();
  if (s === null || e === null || now === null) return false;
  if (s === e) return true;
  if (s < e) return now >= s && now < e;
  return now >= s || now < e;
}

/**
 * 稳定伪随机：同一用户同一天同一窗口结果固定，避免叹号闪烁
 */
function stableRandom(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  return (h % 1000) / 1000;
}

function isSleepTime() {
  const config = getAppConfig('pet_global');
  // 与前端夜晚时段一致：22:01 ~ 次日 6:00（end 为开区间，06:01 即 6:00 之后都算白天）
  const sleepStart = config.sleep_start || '22:01';
  const sleepEnd = config.sleep_end || '06:01';
  return isNowInRange(sleepStart, sleepEnd);
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 获取当前命中的吃饭时段（命中即宠物头上出叹号）
 */
function getCurrentMeal() {
  const { meals } = getMealTimesConfig();
  for (const meal of meals) {
    if (isNowInRange(meal.start, meal.end)) return meal;
  }
  return null;
}

/**
 * 获取当前命中的运动时段窗口（支持配置多个），未命中返回 null
 */
function getCurrentExerciseWindow() {
  const { windows } = getExerciseTimeConfig();
  for (const w of windows || []) {
    if (isNowInRange(w.start, w.end)) return w;
  }
  return null;
}

/**
 * 获取当前命中的逛逛窗口（按概率、同一用户同一天同一窗口结果稳定）
 */
function getCurrentExploreWindow(userId) {
  const { windows } = getExploreTimesConfig();
  const today = getChinaDateStr();
  for (const w of windows) {
    if (!isNowInRange(w.start, w.end)) continue;
    const probability = parseFloat(w.probability ?? 0);
    if (probability <= 0) continue;
    const rand = stableRandom(`${userId}:${today}:${w.key || w.start}`);
    if (rand < probability) return w;
  }
  return null;
}

// ==================== 状态与计数 ====================

/**
 * 计算并更新宠物衰减后的状态
 */
function computePetState(userId) {
  const state = db.prepare('SELECT * FROM pet_states WHERE user_id = ?').get(userId);
  if (!state) return null;

  // 已去掉心情值/饱食度概念，不再进行衰减计算，state_key 仅保留 idle/hungry/sad 作为占位
  const stateKey = 'idle';

  // 使用条件更新避免并发冲突
  const result = db.prepare(`
    UPDATE pet_states
    SET state_key = ?,
        last_decay_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND last_decay_at <= ?
  `).run(stateKey, userId, state.last_decay_at || new Date().toISOString());

  if (result.changes === 0) {
    const latestState = db.prepare('SELECT * FROM pet_states WHERE user_id = ?').get(userId);
    return latestState;
  }

  return {
    ...state,
    state_key: stateKey
  };
}

function ensurePetState(userId) {
  let state = db.prepare('SELECT * FROM pet_states WHERE user_id = ?').get(userId);
  if (!state) {
    db.prepare(`
      INSERT OR IGNORE INTO pet_states (user_id, location, state_key, last_decay_at)
      VALUES (?, 'home', 'idle', CURRENT_TIMESTAMP)
    `).run(userId);
    state = db.prepare('SELECT * FROM pet_states WHERE user_id = ?').get(userId);
  }
  return state;
}

/**
 * 将数据库中的 UTC 时间字符串（CURRENT_TIMESTAMP 格式，无 Z）解析为 Date
 */
function parseUtcDateTime(str) {
  if (!str) return null;
  const s = String(str).includes('Z') ? String(str) : String(str).replace(' ', 'T') + 'Z';
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 取某个 UTC 时间对应的东八区日期（每日重置统一按东八区，见 utils/chinaTime）
 */
function getChinaDateStringOf(utcStr) {
  const d = parseUtcDateTime(utcStr);
  if (!d) return null;
  return new Date(d.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function checkAndResetDailyCounters(userId, state) {
  if (!state) return;
  const today = getChinaDateStr();
  const lastInteractDate = getChinaDateStringOf(state.last_interact_at);
  const lastFeedDate = getChinaDateStringOf(state.last_feed_at);
  const lastExerciseDate = getChinaDateStringOf(state.last_exercise_at);

  const resetInteract = lastInteractDate && lastInteractDate !== today;
  const resetFeed = lastFeedDate && lastFeedDate !== today;
  const resetExercise = lastExerciseDate && lastExerciseDate !== today;

  if (resetInteract || resetFeed || resetExercise) {
    db.prepare(`
      UPDATE pet_states
      SET daily_interact_count = ?,
          daily_feed_count = ?,
          daily_exercise_count = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(
      resetInteract ? 0 : state.daily_interact_count,
      resetFeed ? 0 : state.daily_feed_count,
      resetExercise ? 0 : (state.daily_exercise_count || 0),
      userId
    );
  }
}

/**
 * 确保状态存在 + 每日计数重置 + 返回最新状态
 */
function getFreshState(userId) {
  const state = ensurePetState(userId);
  checkAndResetDailyCounters(userId, state);
  return db.prepare('SELECT * FROM pet_states WHERE user_id = ?').get(userId);
}

/**
 * 判断某个 UTC 时间戳（如 last_feed_at）是否落在「今天」的指定时段窗口内（东八区）
 * 用于：当前餐次已喂过/当前运动窗口已练过 → 不再显示叹号
 */
function isActionInWindow(utcStr, start, end) {
  if (!utcStr) return false;
  // 必须是今天（东八区日期），避免昨天同时段的记录误伤
  if (getChinaDateStringOf(utcStr) !== getChinaDateStr()) return false;
  const d = parseUtcDateTime(utcStr);
  if (!d) return false;
  const china = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const minutes = china.getUTCHours() * 60 + china.getUTCMinutes();
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s === null || e === null) return false;
  if (s === e) return true;
  if (s < e) return minutes >= s && minutes < e;
  return minutes >= s || minutes < e;
}

/**
 * 计算时间驱动的四状态：away > meal_time > exercise_time > explore_time > home
 * 返回 { time_state, meal, hints }
 */
function computeTimeState(userId, state) {
  if (!state) return { time_state: 'home', meal: null, hints: { feed: false, exercise: false } };

  // 外出中优先级最高
  if (state.location === 'away') {
    return { time_state: 'away', meal: null, hints: { feed: false, exercise: false } };
  }

  const feedLimits = getFeedLimits();
  const exerciseLimits = getExerciseLimits();
  const feedRemain = Math.max(0, (feedLimits.max_feeds_per_day || 6) - (state.daily_feed_count || 0));
  const exerciseRemain = Math.max(0, (exerciseLimits.max_per_day || 2) - (state.daily_exercise_count || 0));

  // 吃饭时间：三餐时段出叹号；当前餐次已喂过或当天喂食达上限后不再提示
  const meal = getCurrentMeal();
  if (meal) {
    const fedThisMeal = isActionInWindow(state.last_feed_at, meal.start, meal.end);
    return { time_state: 'meal_time', meal, hints: { feed: feedRemain > 0 && !fedThisMeal, exercise: false } };
  }

  // 运动时间：命中运动时段出叹号；当前窗口已运动过或当天运动达上限后不再提示
  const exerciseWindow = getCurrentExerciseWindow();
  if (exerciseWindow) {
    const exercisedThisWindow = isActionInWindow(state.last_exercise_at, exerciseWindow.start, exerciseWindow.end);
    return { time_state: 'exercise_time', meal: null, hints: { feed: false, exercise: exerciseRemain > 0 && !exercisedThisWindow } };
  }

  // 逛逛时间：按概率命中窗口
  const exploreWindow = getCurrentExploreWindow(userId);
  if (exploreWindow) {
    return { time_state: 'explore_time', meal: null, hints: { feed: false, exercise: false }, explore_window: exploreWindow };
  }

  return { time_state: 'home', meal: null, hints: { feed: false, exercise: false } };
}

/**
 * 从 pet_states_lib 按时间段随机返回一个居家活动
 * 支持状态持续时长：同一个状态在 duration_minutes 内不会变化
 * time_ranges: JSON [{start,end}] 或 [["08:00","12:00"]]，空表示全天
 * @param {string|null} sceneKey 仅返回属于指定场景的状态；为空时不限场景
 */
function getHomeActivity(userId, sceneKey = null) {
  const rows = db.prepare('SELECT * FROM pet_states_lib WHERE is_enabled = 1 ORDER BY sort_order ASC, id ASC').all();
  if (rows.length === 0) return null;

  const now = new Date();

  const eligible = rows.filter(row => {
    if (sceneKey && row.scene_key && row.scene_key !== sceneKey) return false;
    const ranges = safeJsonParse(row.time_ranges, null);
    if (Array.isArray(ranges) && ranges.length > 0) {
      const inRange = ranges.some(r => {
        const start = Array.isArray(r) ? r[0] : r.start;
        const end = Array.isArray(r) ? r[1] : r.end;
        return isNowInRange(start, end);
      });
      if (!inRange) return false;
    }
    return true;
  });

  if (eligible.length === 0) return null;

  // 检查当前状态是否仍在持续时长内
  const userState = db.prepare('SELECT current_state_key, state_expires_at FROM pet_states WHERE user_id = ?').get(userId);
  if (userState && userState.current_state_key && userState.state_expires_at) {
    const expiresAt = parseUtcDateTime(userState.state_expires_at);
    if (expiresAt && now < expiresAt) {
      const current = eligible.find(row => row.state_key === userState.current_state_key);
      if (current) {
        return buildHomeActivity(current);
      }
    }
  }

  // 随机挑选新状态并写入持续时长
  const picked = eligible[Math.floor(Math.random() * eligible.length)];
  const durationMinutes = typeof picked.duration_minutes === 'number' && picked.duration_minutes > 0
    ? picked.duration_minutes
    : 30;
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
  db.prepare(`
    UPDATE pet_states
    SET current_state_key = ?, state_expires_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(picked.state_key, expiresAt.toISOString(), userId);

  return buildHomeActivity(picked);
}

function buildHomeActivity(row) {
  // 2026-08-27 修复：不再在服务器端检查 static_url 对应的本地文件是否存在。
  // 原因：生产环境静态资源可能部署在 CDN 或不同容器，服务端文件系统检查会把
  // 线上已配置的图片 URL 误判为"不存在"而清空，导致前端 fallback 到默认形象。
  // 静态资源是否可访问由前端加载时通过 onerror 自行兜底即可。
  const staticUrl = row.static_url || '';

  let frames = safeJsonParse(row.frames_json, null);
  if (!Array.isArray(frames) || frames.length === 0) {
    frames = staticUrl ? [staticUrl] : [];
  }

  return {
    state_key: row.state_key,
    name: row.name,
    gif_url: row.gif_url,
    static_url: staticUrl,
    lottie_url: row.lottie_url,
    frames,
    frame_rate: row.frame_rate || 2,
    pos_x: row.pos_x,
    pos_y: row.pos_y,
    width: row.width,
    height: row.height,
    scene_key: row.scene_key || null,
    duration_minutes: row.duration_minutes || 30
  };
}


function getPet(userId, sceneKey = null) {
  const pet = db.prepare(`
    SELECT p.*,
           s.static_url AS skin_static_url,
           s.gif_url AS skin_gif_url,
           s.lottie_url AS skin_lottie_url,
           s.icon_url AS skin_icon_url,
           s.name AS skin_name
    FROM pets p
    LEFT JOIN pet_skins s ON p.skin_id = s.skin_id
    WHERE p.user_id = ?
  `).get(userId);
  if (!pet) return null;
  const state = computePetState(userId);
  checkAndResetDailyCounters(userId, state);
  let freshState = db.prepare('SELECT * FROM pet_states WHERE user_id = ?').get(userId);

  const timeState = computeTimeState(userId, freshState);

  // 【2026-08-25 修复：不再在进 tab 时自动送搭搭出门】
  // 原逻辑：命中 explore_time 时段 + 概率 → 自动 beginExploration(userId) 直接把搭搭送出去，
  //         导致新用户第一次进入搭搭 tab 就看到"搭搭出去逛逛啦"（搭搭不在家），体验极差。
  // 新逻辑：四状态机的 explore_time 仅作为"逛逛时段"提示（前端显示"开始探索"按钮），
  //         外出必须由用户手动点"开始探索" → 前端调用 petApi.startExplore() →
  //         后端 startExplore() → beginExploration() 才送搭搭出门。
  //         新用户初始化 pet_states.location='home'（见 ensurePetState），进 tab 必在家，与用户预期一致。

  const feedLimits = getFeedLimits();
  const exerciseLimits = getExerciseLimits();

  // 居家时：按配置的居家事件触发概率（默认 30%，CMS 宠物配置-限制配置可调）掉落居家事件，否则特殊状态
  let homeActivity = null;
  let homeEvent = null;
  // 优先掉落：有效期内进 tab 必掉（占每日额度，每事件每天一次，无视发生地点与 30% 概率；宠物外出时不触发）
  if (freshState && freshState.location !== 'away') {
    const priorityEvent = eventDropService.pickPriorityEvent(userId);
    if (priorityEvent) {
      homeEvent = eventDropService.dropEvent(userId, priorityEvent.location || 'home', priorityEvent);
      if (homeEvent) {
        eventDropService.markPriorityDropped(userId, priorityEvent.id);
        db.prepare('UPDATE pet_states SET last_home_event_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(userId);
      }
    }
  }
  if (!homeEvent && freshState && freshState.location !== 'away' && timeState.time_state === 'home') {
    const exploreCfg = getAppConfig('pet_explore_times') || {};
    const homeChancePct = typeof exploreCfg.home_event_chance_pct === 'number' ? exploreCfg.home_event_chance_pct : 30;
    const roll = Math.random();
    const lastHomeEventDate = getChinaDateStringOf(freshState.last_home_event_at);
    const canHomeEvent = lastHomeEventDate !== getChinaDateStr();
    if (roll < homeChancePct / 100 && canHomeEvent) {
      homeEvent = eventDropService.dropEvent(userId, 'home');
      if (homeEvent) {
        db.prepare('UPDATE pet_states SET last_home_event_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(userId);
      } else {
        // 掉落池为空（未配置居家事件/未达条件）时退回特殊状态
        homeActivity = getHomeActivity(userId, sceneKey);
      }
    } else {
      homeActivity = getHomeActivity(userId, sceneKey);
    }
  } else if (!homeEvent && freshState && freshState.location !== 'away') {
    // 非居家时段（吃饭/运动/逛逛）沿用原状态展示
    homeActivity = getHomeActivity(userId, sceneKey);
  }

  // 诊断日志：帮助排查线上 pet_sprite 配置是否为空
  const spriteCfg = getAppConfig('pet_sprite');
  const spriteFrames = Array.isArray(spriteCfg.frames) ? spriteCfg.frames : [];
  if (spriteFrames.length === 0) {
    console.warn(`[PetService] userId=${userId} 的 pet_sprite.frames 为空，前端将 fallback 到 pet_skin / 前端默认形象`);
  }

  return {
    ...pet,
    state: freshState,
    time_state: timeState.time_state,
    meal: timeState.meal,
    hints: timeState.hints,
    home_activity: homeActivity,
    // 居家事件状态掉落的居家事件（有值时前端弹新事件弹窗）
    home_event: homeEvent,
    // 宠物居家主形象动画，后台 pet_global.anim 配置，默认 idle（发呆）
    anim: getAppConfig('pet_global').anim || 'idle',
    // 形象展示配置（CMS pet_sprite：坐标/尺寸/序列帧/播放速率），前端兜底默认
    sprite: getAppConfig('pet_sprite'),
    // 当前穿戴皮肤（pet_skins 表），当 pet_sprite 未配置时作为兜底形象
    skin: {
      skin_id: pet.skin_id || 'default',
      name: pet.skin_name || '默认皮肤',
      static_url: pet.skin_static_url || null,
      gif_url: pet.skin_gif_url || null,
      lottie_url: pet.skin_lottie_url || null,
      icon_url: pet.skin_icon_url || null,
      frames: pet.skin_static_url ? [pet.skin_static_url] : []
    },
    // 场景配置（CMS pet_scenes：场景名称/时段背景图/比例），前端兜底单场景小窝
    scenes: getAppConfig('pet_scenes'),
    daily_feed_count: freshState ? freshState.daily_feed_count : 0,
    feed_limits: feedLimits,
    daily_exercise_count: freshState ? (freshState.daily_exercise_count || 0) : 0,
    exercise_limits: exerciseLimits,
    exercise_options: getExerciseOptions(userId)
  };
}

/**
 * 运动选项：来自 pet_exercise_lib 独立配置，标注器械信息与用户持有状态
 * 器械为永久物品（user_inventory 中存在即视为持有）
 */
function getExerciseOptions(userId) {
  const rows = db.prepare(`
    SELECT e.*, s.name AS equipment_name, w.name AS workout_name
    FROM pet_exercise_lib e
    LEFT JOIN shop_items s ON s.id = e.equipment_item_id
    LEFT JOIN workout_lib w ON w.workout_key = e.workout_key
    WHERE e.is_enabled = 1
    ORDER BY e.sort_order ASC, e.id ASC
  `).all();

  // 用户持有的器材（shop_item_id 集合）
  const ownedRows = userId
    ? db.prepare("SELECT DISTINCT shop_item_id FROM user_inventory WHERE user_id = ? AND category = 'equipment' AND shop_item_id IS NOT NULL").all(userId)
    : [];
  const owned = new Set(ownedRows.map(r => r.shop_item_id));

  return rows.map(r => ({
    key: r.exercise_key,
    name: r.name,
    use_equipment: !!r.use_equipment,
    equipment_item_id: r.equipment_item_id || null,
    equipment_name: r.equipment_name || null,
    anim_url: r.anim_url || null,
    has_workout: !!r.has_workout,
    workout_key: r.workout_key || null,
    workout_name: r.workout_name || null,
    locked: !!(r.use_equipment && r.equipment_item_id && !owned.has(r.equipment_item_id))
  }));
}

// ==================== 互动（已下线） ====================
// 亲密互动（摸摸头/抱抱）功能已下线，相关前端按钮、API、任务、货币规则同步移除。
// 如需恢复，请参考 git 历史中的 interact 函数实现。

// ==================== 喂食 ====================

/**
 * 从食物关联的食谱信息（优先背包快照，其次商城商品当前配置）
 * 食物关联食谱配置在 effect_json.recipe = { title, content, tags? }
 * Excel 导入的搭搭食谱可能只存了 ingredients/steps/tips，这里补全 title/content
 */
function resolveItemRecipe(inventory) {
  const ownEffect = safeJsonParse(inventory.effect_json, {});
  if (ownEffect.recipe && (ownEffect.recipe.title || ownEffect.recipe.content)) {
    return ownEffect.recipe;
  }
  if (inventory.shop_item_id) {
    const shopItem = db.prepare('SELECT name, effect_json FROM shop_items WHERE id = ?').get(inventory.shop_item_id);
    const shopEffect = shopItem ? safeJsonParse(shopItem.effect_json, {}) : {};
    const recipe = shopEffect.recipe;
    if (recipe && (recipe.title || recipe.content || recipe.ingredients || recipe.steps || recipe.tips)) {
      return {
        title: recipe.title || shopItem.name,
        content: recipe.content || recipe.tips || recipe.ingredients || '',
        ...recipe
      };
    }
  }
  return null;
}

/**
 * 根据食谱标题查找对应商店食物商品
 * 用于探索/事件掉落食谱时补全 extracted_data 中的配图、总重量、总热量
 * @param {string} title 食谱标题
 * @returns {{icon_url:string|null, effect_json:object|null}} 商店商品信息
 */
function findShopRecipeByTitle(title) {
  if (!title) return { icon_url: null, effect_json: null };
  const shopItem = db.prepare(`
    SELECT icon_url, effect_json FROM shop_items
    WHERE category = 'food' AND name = ? AND status = 1
    LIMIT 1
  `).get(title);
  if (!shopItem) return { icon_url: null, effect_json: null };
  const effect = safeJsonParse(shopItem.effect_json, {});
  return { icon_url: shopItem.icon_url || null, effect_json: effect };
}

/**
 * 将食谱保存到博物馆食谱库（同一用户同一标题不重复保存）
 * @param {number} userId 用户ID
 * @param {object} recipe 食谱数据
 * @param {string} [iconUrl] 商店/库存中的配图URL，写入 extracted_data.image 供列表/详情展示
 */
function saveRecipeToMuseum(userId, recipe, iconUrl = null) {
  const title = recipe.title || recipe.content.slice(0, 32);
  const existing = db.prepare(`
    SELECT id FROM museum_items
    WHERE user_id = ? AND type = 'recipe' AND title = ? AND status != 2
  `).get(userId, title);
  if (existing) return { saved: false, title };

  // 计算总克数/总热量：优先使用已提供的准确值，没有时根据食材用量估算，
  // 仍缺失时从商店食物商品（Excel 导入的搭搭食谱）中补全
  let extractedData = recipe.extracted_data || null;
  if (extractedData && Array.isArray(extractedData.ingredients)) {
    const hasTotals = (extractedData.total_weight > 0 || extractedData.total_calorie > 0);
    if (!hasTotals) {
      const totals = computeRecipeTotals(extractedData.ingredients);
      extractedData = { ...extractedData, total_weight: totals.totalWeight, total_calorie: totals.totalCalorie };
    }
  }
  // 从商店食物商品补全总重量/总热量/配图
  const hasTotalsNow = extractedData && (extractedData.total_weight > 0 || extractedData.total_calorie > 0);
  const hasImageNow = extractedData && extractedData.image;
  if (!hasTotalsNow || !hasImageNow) {
    const shop = findShopRecipeByTitle(title);
    const nutrition = shop.effect_json && shop.effect_json.nutrition;
    if (nutrition) {
      extractedData = { ...extractedData };
      if (!(extractedData.total_weight > 0) && nutrition.weight) {
        const w = Number(String(nutrition.weight).replace(/[^0-9.]/g, ''));
        if (w > 0) extractedData.total_weight = w;
      }
      if (!(extractedData.total_calorie > 0) && nutrition.calories) {
        const c = Number(String(nutrition.calories).replace(/[^0-9.]/g, ''));
        if (c > 0) extractedData.total_calorie = c;
      }
    }
    if (!hasImageNow && shop.icon_url) {
      extractedData = { ...extractedData, image: shop.icon_url };
    }
  }
  // 补全商店配图：优先使用传入的 iconUrl，其次使用 recipe.extracted_data.image
  if (iconUrl) {
    extractedData = { ...extractedData, image: iconUrl };
  } else if (extractedData && !extractedData.image && recipe.image) {
    extractedData = { ...extractedData, image: recipe.image };
  }

  const id = db.prepare(`
    INSERT INTO museum_items (user_id, type, sub_type, title, content, extracted_data, author, tags, status)
    VALUES (?, 'recipe', 'dada_recipe', ?, ?, ?, 'partner', ?, 1)
  `).run(
    userId,
    title,
    recipe.content,
    extractedData ? JSON.stringify(extractedData) : null,
    recipe.tags ? JSON.stringify(recipe.tags) : null
  ).lastInsertRowid;

  // 同步写入时间轴（与博物馆手动新增保持一致）
  db.prepare(`
    INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date)
    VALUES (?, 'recipe', '食谱', ?, ?, 'museum_items', ?)
  `).run(userId, recipe.content, id, getChinaDateStr());

  return { saved: true, title, id };
}

/**
 * 喂食：支持一次喂多种食物（数组）
 * 限制：每次最多 max_items_per_feed 种（默认 2），每天最多 max_feeds_per_day 次（默认 6）
 * 喂食后若食物关联食谱未保存到博物馆食谱库则自动保存
 */
function feed(userId, inventoryItemIds) {
  return withTransaction(() => {
    const ids = Array.isArray(inventoryItemIds) ? inventoryItemIds : [inventoryItemIds];
    const uniqueIds = [...new Set(ids.filter(id => id !== null && id !== undefined))];
    const limits = getFeedLimits();

    if (uniqueIds.length === 0) return { error: '请选择要喂的食物' };
    if (uniqueIds.length > limits.max_items_per_feed) {
      return { error: `每次最多喂食 ${limits.max_items_per_feed} 种食物` };
    }

    const state = getFreshState(userId);
    if (state.location === 'away') return { error: '搭搭外出中，暂时不能喂食' };
    if (isSleepTime()) return { error: '搭搭已经休息了' };
    if ((state.daily_feed_count || 0) >= limits.max_feeds_per_day) {
      return { error: `今天已喂食 ${limits.max_feeds_per_day} 次，明天再来吧` };
    }

    // 先校验全部食物，全部合法再统一生效
    const items = [];
    for (const id of uniqueIds) {
      const inventory = db.prepare('SELECT * FROM user_inventory WHERE id = ? AND user_id = ?').get(id, userId);
      if (!inventory) return { error: '食物不存在' };
      if (inventory.category !== 'food') return { error: `「${inventory.name}」不是食物` };
      if (inventory.quantity <= 0) return { error: `「${inventory.name}」已用完` };
      items.push(inventory);
    }

    const consumed = [];
    const recipes = [];

    for (const inventory of items) {
      consumed.push({ id: inventory.id, name: inventory.name });
      const recipe = resolveItemRecipe(inventory);
      if (recipe && recipe.content) {
        // 补充食物图标，供首喂掉落弹窗展示
        if (inventory.shop_item_id && !inventory.icon_url) {
          const shopItem = db.prepare('SELECT icon_url FROM shop_items WHERE id = ?').get(inventory.shop_item_id);
          if (shopItem && shopItem.icon_url) inventory.icon_url = shopItem.icon_url;
        }
        recipes.push({ recipe, icon_url: inventory.icon_url || null });
      }
    }

    db.prepare(`
      UPDATE pet_states SET daily_feed_count = daily_feed_count + 1, last_feed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(userId);

    // 消耗食物（原子扣减，数量不足时整体回滚）
    for (const inventory of items) {
      if (inventory.quantity > 1) {
        const updateResult = db.prepare('UPDATE user_inventory SET quantity = quantity - 1 WHERE id = ? AND quantity > 0').run(inventory.id);
        if (updateResult.changes !== 1) return { error: '食物数量已变化，请重试' };
      } else {
        const deleteResult = db.prepare('DELETE FROM user_inventory WHERE id = ? AND quantity = 1').run(inventory.id);
        if (deleteResult.changes !== 1) return { error: '食物数量已变化，请重试' };
      }
    }

    // 关联食谱自动保存到博物馆（已保存过的不重复，即仅首次喂食掉落）
    const recipesUnlocked = [];
    for (const item of recipes) {
      const result = saveRecipeToMuseum(userId, item.recipe, item.icon_url);
      if (result.saved) {
        recipesUnlocked.push({
          title: item.recipe.title || result.title,
          content: item.recipe.content || '',
          icon_url: item.icon_url
        });
      }
    }

    // 喂食奖励：每次喂食发放浆果/鲜花（pet_feed_limits.feed_reward 配置，默认 5 浆果）
    const feedReward = { berries: 5, flowers: 0, ...(limits.feed_reward || {}) };
    for (const [currency, amount] of Object.entries(feedReward)) {
      const num = parseInt(amount, 10);
      if (num > 0 && ['berries', 'flowers'].includes(currency)) {
        currencyService.addCurrency(userId, currency, num, 'reward', 'pet_feed', null);
      }
    }

    taskService.updateTaskProgress(userId, 'feed', 1);

    const newCount = (state.daily_feed_count || 0) + 1;
    return {
      consumed,
      recipes_saved: recipesUnlocked.map(r => r.title),
      recipes_unlocked: recipesUnlocked,
      reward: feedReward,
      daily_feed_count: newCount,
      feed_remaining: Math.max(0, limits.max_feeds_per_day - newCount)
    };
  });
}

// ==================== 运动 ====================

/**
 * 宠物运动：记录一次运动，限制每天最多 max_per_day 次（默认 2）
 * 运动选项来自 pet_exercise_lib：器械运动需要用户已持有对应商城器材（永久物品）；
 * 返回项包含运动动画与跟练课程信息，供前端展示动画与引导跟练
 */
function exercise(userId, optionKey = null) {
  return withTransaction(() => {
    const limits = getExerciseLimits();
    const state = getFreshState(userId);

    if (state.location === 'away') return { error: '搭搭外出中，暂时不能运动' };
    if (isSleepTime()) return { error: '搭搭已经休息了' };
    if ((state.daily_exercise_count || 0) >= limits.max_per_day) {
      return { error: `今天已运动 ${limits.max_per_day} 次，明天再练吧` };
    }

    const options = getExerciseOptions(userId);
    if (options.length === 0) return { error: '暂无可用的运动项目' };

    let option = null;
    if (optionKey) {
      option = options.find(o => o.key === optionKey);
      if (!option) return { error: '运动项目不存在' };
    } else {
      // 未指定时从已解锁项目中随机
      const unlocked = options.filter(o => !o.locked);
      if (unlocked.length === 0) return { error: '暂无可用的运动项目' };
      option = unlocked[Math.floor(Math.random() * unlocked.length)];
    }

    // 器械运动：需已购买对应器材
    if (option.locked) {
      return { error: `「${option.name}」需要先在商城购买${option.equipment_name || '对应器材'}` };
    }

    db.prepare(`
      UPDATE pet_states SET daily_exercise_count = daily_exercise_count + 1, last_exercise_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(userId);

    taskService.updateTaskProgress(userId, 'pet_exercise', 1);

    const newCount = (state.daily_exercise_count || 0) + 1;
    return {
      option: {
        key: option.key,
        name: option.name,
        anim_url: option.anim_url || null,
        has_workout: option.has_workout,
        workout_key: option.workout_key || null,
        workout_name: option.workout_name || null
      },
      daily_exercise_count: newCount,
      exercise_remaining: Math.max(0, limits.max_per_day - newCount)
    };
  });
}

// ==================== 外出逛逛 ====================
/**
 * 开始一次外出：按权重预选一个外出事件，本次外出时长取该事件配置的 explore_minutes
 * （外出时长由单个事件配置；事件未配置时兜底全局默认 30 分钟）
 */
function beginExploration(userId) {
  const config = getAppConfig('pet_global');
  const preselected = eventDropService.pickEvent(userId, 'explore');
  const minutes = preselected && preselected.explore_minutes
    ? preselected.explore_minutes
    : Math.round((config.explore?.duration_seconds || 1800) / 60);
  const duration = minutes * 60;
  const startAt = new Date();
  const endAt = new Date(startAt.getTime() + duration * 1000);

  const result = db.prepare(`
    INSERT INTO pet_explorations (user_id, start_at, end_at, duration_seconds, status, event_id)
    VALUES (?, ?, ?, ?, 'ongoing', ?)
  `).run(userId, startAt.toISOString(), endAt.toISOString(), duration, preselected ? preselected.id : null);

  db.prepare("UPDATE pet_states SET location = 'away', last_explore_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(userId);

  return { exploration_id: result.lastInsertRowid, end_at: endAt.toISOString(), duration };
}

function startExplore(userId) {
  return withTransaction(() => {
    const config = getAppConfig('pet_global');
    const state = getFreshState(userId);

    if (state.location === 'away') return { error: '搭搭已经出去逛逛啦' };

    const todayCount = db.prepare(`
      SELECT COUNT(*) as count FROM pet_explorations
      WHERE user_id = ? AND date(start_at, '+8 hours') = date('now', '+8 hours') AND status = 'completed'
    `).get(userId).count;

    if (todayCount >= (config.explore?.daily_max_count || 3)) {
      return { error: '今天外出次数已达上限' };
    }

    return beginExploration(userId);
  });
}

function completeExplore(userId, explorationId = null) {
  return withTransaction(() => {
    let exploration;
    if (explorationId) {
      exploration = db.prepare('SELECT * FROM pet_explorations WHERE id = ? AND user_id = ?').get(explorationId, userId);
    } else {
      exploration = db.prepare("SELECT * FROM pet_explorations WHERE user_id = ? AND status = 'ongoing' ORDER BY id DESC LIMIT 1").get(userId);
    }
    if (!exploration) return { error: '没有进行中的外出' };

    const now = new Date();
    const endAt = new Date(exploration.end_at);
    if (now < endAt) {
      return { error: '外出还没结束', remaining_seconds: Math.ceil((endAt - now) / 1000) };
    }

    // 新事件系统：外出归来掉落事件——优先外出开始时预选的事件（其 explore_minutes 决定外出时长），
    // 无预选（旧数据）则按权重随机；受每日上限约束
    let preselected = null;
    if (exploration.event_id) {
      preselected = db.prepare("SELECT * FROM pet_events_lib WHERE id = ? AND is_enabled = 1 AND location = 'explore'").get(exploration.event_id) || null;
    }
    const drop = eventDropService.dropEvent(userId, 'explore', preselected);
    const event = drop ? drop.event : null;
    const photo = drop ? drop.photo : null;
    const isNewEvent = drop ? drop.is_new : false;

    const reward = event ? safeJsonParse(event.reward_json, { berries: 1 }) : { berries: 1 };

    db.prepare(`
      UPDATE pet_explorations SET status = 'completed', event_id = ?, reward_json = ?, end_at = ?
      WHERE id = ?
    `).run(event ? event.id : null, JSON.stringify(reward), now.toISOString(), exploration.id);

    // 事件掉落食谱：自动保存到博物馆食谱库（搭搭食谱分类）
    let recipeSaved = null;
    if (reward && reward.recipe && reward.recipe.title) {
      const recipeTitle = reward.recipe.title;
      const recipeContent = reward.recipe.content || '';
      const existingRecipe = db.prepare(`
        SELECT id FROM museum_items
        WHERE user_id = ? AND type = 'recipe' AND title = ? AND status != 2
      `).get(userId, recipeTitle);
      if (!existingRecipe) {
        // 计算总克数/总热量（有食材用量数据时）
        let extractedData = reward.recipe.extracted_data || null;
        try {
          const exData = reward.recipe.extracted_data;
          if (exData && Array.isArray(exData.ingredients)) {
            const totals = computeRecipeTotals(exData.ingredients);
            extractedData = { ...exData, total_weight: totals.totalWeight, total_calorie: totals.totalCalorie };
          }
        } catch (e) { /* 忽略结构化数据异常 */ }
        // 从商店食物商品补全总重量/总热量/配图
        const hasTotalsNow = extractedData && (extractedData.total_weight > 0 || extractedData.total_calorie > 0);
        const hasImageNow = extractedData && extractedData.image;
        if (!hasTotalsNow || !hasImageNow) {
          const shop = findShopRecipeByTitle(recipeTitle);
          const nutrition = shop.effect_json && shop.effect_json.nutrition;
          if (nutrition) {
            extractedData = { ...extractedData };
            if (!(extractedData.total_weight > 0) && nutrition.weight) {
              const w = Number(String(nutrition.weight).replace(/[^0-9.]/g, ''));
              if (w > 0) extractedData.total_weight = w;
            }
            if (!(extractedData.total_calorie > 0) && nutrition.calories) {
              const c = Number(String(nutrition.calories).replace(/[^0-9.]/g, ''));
              if (c > 0) extractedData.total_calorie = c;
            }
          }
          if (!hasImageNow && shop.icon_url) {
            extractedData = { ...extractedData, image: shop.icon_url };
          }
        }
        const recipeExtracted = extractedData ? JSON.stringify(extractedData) : null;
        const recipeId = db.prepare(`
          INSERT INTO museum_items (user_id, type, sub_type, title, content, extracted_data, author, tags, status)
          VALUES (?, 'recipe', 'dada_recipe', ?, ?, ?, 'partner', ?, 1)
        `).run(
          userId,
          recipeTitle,
          recipeContent,
          recipeExtracted,
          reward.recipe.tags ? JSON.stringify(reward.recipe.tags) : null
        ).lastInsertRowid;
        db.prepare(`
          INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date)
          VALUES (?, 'recipe', '搭搭食谱', ?, ?, 'museum_items', ?)
        `).run(userId, recipeContent, recipeId, getChinaDateStr());
        recipeSaved = { id: recipeId, title: recipeTitle };
      }
    }

    db.prepare("UPDATE pet_states SET location = 'home', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(userId);

    // 推进外出任务
    taskService.updateTaskProgress(userId, 'explore_complete', 1);

    const eventPayload = event ? {
      ...event,
      photo_id: photo ? photo.id : null,
      photo_url: photo ? photo.photo_url : event.image_url,
      is_new: isNewEvent
    } : null;

    return { event: eventPayload, reward, recipe_saved: recipeSaved };
  });
}

function getUserEvents(userId) {
  return db.prepare(`
    SELECT ue.id, ue.is_new, ue.unlocked_at, ue.photo_id,
           e.event_key, e.type, e.title, e.content, e.image_url, e.rarity, e.reward_json,
           p.photo_url
    FROM user_events ue
    JOIN pet_events_lib e ON ue.event_id = e.id
    LEFT JOIN pet_event_photos p ON ue.photo_id = p.id
    WHERE ue.user_id = ?
    ORDER BY ue.unlocked_at DESC
  `).all(userId);
}

/**
 * 事件相册：按后台配置的集合（event_collections 表，CMS 事件配置 CRUD）分 tab 展示
 * 每个集合返回全部槽位（事件 × 照片变体），已解锁的带内容，未解锁的为缺省占位
 * 进度 = 已解锁槽位数 / 集合总槽位数
 * 注意：不预置任何集合/事件，后台未配置时返回空数组，由前端展示空状态
 */
function getEventAlbum(userId) {
  const collections = db.prepare('SELECT coll_key AS key, name FROM event_collections WHERE is_enabled = 1 ORDER BY sort_order ASC, id ASC').all();

  const userRows = db.prepare(`
    SELECT ue.id, ue.event_id, ue.photo_id, ue.is_new, ue.unlocked_at
    FROM user_events ue
    WHERE ue.user_id = ?
  `).all(userId);
  const unlockedMap = {};
  for (const row of userRows) {
    unlockedMap[`${row.event_id}:${row.photo_id || 0}`] = row;
  }

  const photoStmt = db.prepare('SELECT * FROM pet_event_photos WHERE event_id = ? AND is_enabled = 1 ORDER BY sort_order ASC, id ASC');
  const eventStmt = db.prepare('SELECT * FROM pet_events_lib WHERE type = ? AND is_enabled = 1 ORDER BY id ASC');

  return collections.map(col => {
    const events = eventStmt.all(col.key);
    const unlockedSlots = [];
    const lockedSlots = [];
    let total = 0;
    let unlockedCount = 0;
    for (const event of events) {
      const photos = photoStmt.all(event.id);
      const variants = photos.length > 0 ? photos : [null];
      for (const photo of variants) {
        total++;
        const unlocked = unlockedMap[`${event.id}:${photo ? photo.id : 0}`];
        if (unlocked) {
          unlockedCount++;
          unlockedSlots.push({
            user_event_id: unlocked.id,
            event_id: event.id,
            title: event.title,
            content: event.content,
            image_url: (photo && photo.photo_url) || event.image_url,
            rarity: event.rarity,
            collection_name: col.name,
            is_new: !!unlocked.is_new,
            unlocked: true,
            unlocked_at: unlocked.unlocked_at
          });
        } else {
          // 未解锁槽位：不下发标题/图片，前端显示缺省占位
          lockedSlots.push({ event_id: event.id, unlocked: false, rarity: event.rarity });
        }
      }
    }
    // 已解锁事件放最前面：按解锁时间倒序（最新解锁的在最前）
    unlockedSlots.sort((a, b) => (b.unlocked_at || '').localeCompare(a.unlocked_at || ''));
    return { key: col.key, name: col.name, total, unlocked_count: unlockedCount, slots: [...unlockedSlots, ...lockedSlots] };
  });
}

function markEventRead(userId, eventId) {
  db.prepare('UPDATE user_events SET is_new = 0 WHERE id = ? AND user_id = ?').run(eventId, userId);
  return true;
}

function getDialogue(scene) {
  const list = db.prepare('SELECT * FROM pet_dialogues WHERE scene = ? AND is_enabled = 1').all(scene);
  if (list.length === 0) return null;
  const enabled = list.filter(d => Math.random() <= (d.probability || 1));
  if (enabled.length === 0) return null;
  const totalWeight = enabled.reduce((sum, d) => sum + (d.weight || 1), 0);
  let rand = Math.random() * totalWeight;
  for (const d of enabled) {
    rand -= (d.weight || 1);
    if (rand <= 0) return d.text;
  }
  return enabled[0].text;
}

module.exports = {
  getPet,
  ensurePetState,
  feed,
  exercise,
  startExplore,
  completeExplore,
  getUserEvents,
  getEventAlbum,
  markEventRead,
  getDialogue,
  getAppConfig,
  getHomeActivity,
  computePetState,
  computeTimeState
};
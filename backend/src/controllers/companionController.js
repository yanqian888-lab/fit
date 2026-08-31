/**
 * 陪伴系统 C 端控制器
 * 包括：宠物、货币、商城、背包、任务、签到、成就、事件
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const { staticUrl } = require('../utils/staticUrl');
const petService = require('../services/petService');
const currencyService = require('../services/currencyService');
const shopService = require('../services/shopService');
const inventoryService = require('../services/inventoryService');
const eventService = require('../services/eventService');
const taskService = require('../services/taskService');
const achievementService = require('../services/achievementService');

/**
 * 将相对路径图片 URL 规范化为完整可访问 URL
 * 已是 http(s) 完整地址则原样返回，否则用 staticUrl 拼接 API 域名
 * 避免事件照片相对路径在前端无法展示（与 cmsAchievementController 修复方式一致）
 * @param {object} req - Express 请求对象，用于读取反代后的 host
 * @param {string|null|undefined} url - 原始图片 URL
 * @returns {string} 完整可访问 URL，空值返回空串
 */
function normalizePhotoUrl(req, url) {
  if (!url) return '';
  if (typeof url === 'string' && /^https?:\/\//.test(url)) return url;
  return staticUrl(req, url);
}

// ==================== 宠物 ====================
/**
 * 获取宠物公共展示配置（无需登录）
 * 返回 sprite/scenes/anim 等 CMS 配置的公共数据，供未登录游客浏览搭搭 tab 使用
 */
function getPetConfig(req, res) {
  const { getAppConfig } = require('../utils/configCache');
  const sprite = getAppConfig('pet_sprite');
  const scenes = getAppConfig('pet_scenes');
  const globalCfg = getAppConfig('pet_global');
  const defaultSkinUrl = getAppConfig('pet_sprite').frames?.[0] || null;
  return res.json(success({
    sprite: {
      x: sprite.x || 375,
      y: sprite.y || 500,
      width: sprite.width || 380,
      height: sprite.height || 380,
      fps: sprite.fps || 2,
      frames: Array.isArray(sprite.frames) ? sprite.frames : []
    },
    scenes,
    anim: globalCfg.anim || 'idle',
    sleep_start: globalCfg.sleep_start || '22:00',
    sleep_end: globalCfg.sleep_end || '06:00'
  }));
}

function getPet(req, res) {
  const userId = req.userId;

  // 先结算已到期的外出，保证返回的宠物状态（location/time_state）是最新的
  let pendingEvent = null;
  let pendingReward = null;
  const ongoing = db.prepare("SELECT * FROM pet_explorations WHERE user_id = ? AND status = 'ongoing' ORDER BY id DESC LIMIT 1").get(userId);
  if (ongoing) {
    const now = new Date();
    const endAt = new Date(ongoing.end_at);
    if (now >= endAt) {
      const exploreResult = petService.completeExplore(userId);
      if (exploreResult.event) {
        pendingEvent = exploreResult.event;
        pendingReward = exploreResult.reward;
      }
    }
  }

  const sceneKey = req.query.scene || null;
  const pet = petService.getPet(userId, sceneKey);
  if (!pet) return res.status(404).json(error('宠物不存在', 404));

  if (pendingEvent) {
    pet.pending_event = pendingEvent;
    pet.pending_reward = pendingReward;
  } else if (ongoing) {
    const now = new Date();
    const endAt = new Date(ongoing.end_at);
    if (now < endAt) {
      pet.ongoing_explore = {
        id: ongoing.id,
        end_at: ongoing.end_at,
        remaining_seconds: Math.ceil((endAt - now) / 1000)
      };
    }
  }

  return res.json(success(pet));
}

function feed(req, res) {
  const userId = req.userId;
  // 兼容旧版单个 inventory_item_id，新版支持 inventory_item_ids 数组（每次最多 2 种）
  let itemIds = req.body.inventory_item_ids;
  if (!itemIds && req.body.inventory_item_id) {
    itemIds = [req.body.inventory_item_id];
  }
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json(error('缺少食物 ID', 400));
  }
  const result = petService.feed(userId, itemIds);
  if (result.error) return res.status(400).json(error(result.error, 400));
  return res.json(success(result));
}

function exercise(req, res) {
  const userId = req.userId;
  const { option_key } = req.body || {};
  const result = petService.exercise(userId, option_key || null);
  if (result.error) return res.status(400).json(error(result.error, 400));
  return res.json(success(result));
}

function startExplore(req, res) {
  const userId = req.userId;
  const result = petService.startExplore(userId);
  if (result.error) return res.status(400).json(error(result.error, 400));
  return res.json(success(result));
}

function completeExplore(req, res) {
  const userId = req.userId;
  const { id } = req.body;
  const result = petService.completeExplore(userId, id || null);
  if (result.error) return res.status(400).json(error(result.error, 400));
  return res.json(success(result));
}

function getEvents(req, res) {
  const userId = req.userId;
  const list = petService.getUserEvents(userId);
  // 拼接事件照片/事件图片完整 URL，避免相对路径前端无法展示
  for (const item of list) {
    if (item.image_url) item.image_url = normalizePhotoUrl(req, item.image_url);
    if (item.photo_url) item.photo_url = normalizePhotoUrl(req, item.photo_url);
  }
  return res.json(success({ list }));
}

// 查询某个场景下所有启用的对话（C 端用，如点击宠物时的 pet_tap）
function getDialogues(req, res) {
  const scene = req.query.scene;
  if (!scene) return res.status(400).json(error('缺少 scene 参数', 400));
  const list = db.prepare('SELECT id, scene, text, weight, probability FROM pet_dialogues WHERE scene = ? AND is_enabled = 1 ORDER BY id ASC').all(scene);
  return res.json(success({ list }));
}

// 事件相册：按集合分 tab，含解锁进度与缺省槽位
function getEventAlbum(req, res) {
  const userId = req.userId;
  const collections = petService.getEventAlbum(userId);
  // 拼接已解锁槽位的图片 URL，未解锁槽位不下发图片无需处理
  for (const col of collections) {
    if (!Array.isArray(col.slots)) continue;
    for (const slot of col.slots) {
      if (slot.unlocked && slot.image_url) {
        slot.image_url = normalizePhotoUrl(req, slot.image_url);
      }
    }
  }
  return res.json(success({ collections }));
}

function markEventRead(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  petService.markEventRead(userId, id);
  return res.json(success(null, '已标记已读'));
}

// ==================== 货币 ====================
function getCurrency(req, res) {
  const userId = req.userId;
  const currency = currencyService.getCurrency(userId);
  return res.json(success(currency));
}

function getCurrencyTransactions(req, res) {
  const userId = req.userId;
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const result = currencyService.getTransactions(userId, page, size);
  return res.json(success(result));
}

// ==================== 商城 ====================
function getShopItems(req, res) {
  const userId = req.userId;
  const category = req.query.category || null;
  const size = Math.min(50, Math.max(0, parseInt(req.query.size) || 0));
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const result = shopService.getItems(userId, category, size > 0 ? { page, size } : {});
  const categories = db.prepare('SELECT DISTINCT category FROM shop_items WHERE status = 1 AND category IS NOT NULL AND category != \'\' ORDER BY category ASC').all().map(r => r.category);
  if (result && result.list) {
    return res.json(success({ list: result.list, pagination: result.pagination, categories }));
  }
  return res.json(success({ list: result, categories }));
}

function buyShopItem(req, res) {
  const userId = req.userId;
  const { item_id } = req.body;
  if (!item_id) return res.status(400).json(error('缺少商品 ID', 400));
  const result = shopService.buyItem(userId, item_id);
  if (result.error) return res.status(400).json(error(result.error, 400));
  return res.json(success(result));
}

// ==================== 背包 ====================
function getInventory(req, res) {
  const userId = req.userId;
  const category = req.query.category || null;
  const list = inventoryService.getInventory(userId, category);
  const categories = db.prepare('SELECT DISTINCT category FROM user_inventory WHERE user_id = ? AND category IS NOT NULL AND category != \'\' ORDER BY category ASC').all(userId).map(r => r.category);
  return res.json(success({ list, categories }));
}

function useInventoryItem(req, res) {
  const userId = req.userId;
  const { item_id } = req.body;
  if (!item_id) return res.status(400).json(error('缺少物品 ID', 400));
  const result = inventoryService.useItem(userId, item_id);
  if (result.error) return res.status(400).json(error(result.error, 400));
  return res.json(success(result));
}

/**
 * 查询器材关联的跟练课程和运动选项
 */
function getEquipmentWorkouts(req, res) {
  const userId = req.userId;
  const { item_id } = req.query;
  if (!item_id) return res.status(400).json(error('缺少器材 ID', 400));
  const result = inventoryService.getEquipmentWorkouts(userId, item_id);
  if (result.error) return res.status(400).json(error(result.error, 400));
  return res.json(success(result));
}

// ==================== 任务与签到 ====================
function getTasks(req, res) {
  const userId = req.userId;
  const list = taskService.getTasks(userId);
  return res.json(success({ list }));
}

function claimTaskReward(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const result = taskService.claimTaskReward(userId, id);
  if (result.error) return res.status(400).json(error(result.error, 400));
  return res.json(success(result));
}

function reportTaskProgress(req, res) {
  const userId = req.userId;
  const { action, count = 1 } = req.body || {};
  if (!action || typeof action !== 'string') {
    return res.status(400).json(error('缺少 action 参数'));
  }
  const results = taskService.updateTaskProgress(userId, action, Number(count) || 1);
  return res.json(success({ results }));
}

function getCheckinStatus(req, res) {
  const userId = req.userId;
  const status = taskService.getCheckinStatus(userId);
  return res.json(success(status));
}

function checkin(req, res) {
  const userId = req.userId;
  const result = taskService.checkin(userId);
  if (result.error) return res.status(400).json(error(result.error, 400));
  return res.json(success(result));
}

// ==================== 成就 ====================
function getAchievements(req, res) {
  const userId = req.userId;
  const list = achievementService.getAchievements(userId);
  return res.json(success({ list }));
}

module.exports = {
  getPetConfig,
  getPet,
  feed,
  exercise,
  startExplore,
  completeExplore,
  getEvents,
  getEventAlbum,
  markEventRead,
  getDialogues,
  getCurrency,
  getCurrencyTransactions,
  getShopItems,
  buyShopItem,
  getInventory,
  useInventoryItem,
  getEquipmentWorkouts,
  getTasks,
  claimTaskReward,
  reportTaskProgress,
  getCheckinStatus,
  checkin,
  getAchievements
};

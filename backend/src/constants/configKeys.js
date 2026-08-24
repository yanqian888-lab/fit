/**
 * 配置键常量定义
 * 避免硬编码，提高可维护性
 */

const CONFIG_KEYS = {
  GLOBAL: {
    ENABLED: 'global_enabled',
    GRAYSCALE_PERCENT: 'grayscale_percent'
  },
  
  AI_CHAT: {
    ENABLED: 'ai_chat_enabled',
    THRESHOLD: 'ai_chat_threshold'
  },
  
  DIARY: {
    ENABLED: 'diary_enabled',
    THRESHOLD: 'diary_threshold'
  },
  
  POPUP_AI: {
    TITLE: 'popup_ai_title',
    CONTENT: 'popup_ai_content',
    PRIMARY_BTN: 'popup_ai_primary_btn',
    SECONDARY_BTN: 'popup_ai_secondary_btn',
    CONTACT: 'popup_ai_contact'
  },
  
  POPUP_DIARY: {
    TITLE: 'popup_diary_title',
    CONTENT: 'popup_diary_content',
    PRIMARY_BTN: 'popup_diary_primary_btn',
    SECONDARY_BTN: 'popup_diary_secondary_btn',
    CONTACT: 'popup_diary_contact'
  }
};

const POPUP_KEYS = [
  CONFIG_KEYS.POPUP_AI.TITLE,
  CONFIG_KEYS.POPUP_AI.CONTENT,
  CONFIG_KEYS.POPUP_AI.PRIMARY_BTN,
  CONFIG_KEYS.POPUP_AI.SECONDARY_BTN,
  CONFIG_KEYS.POPUP_AI.CONTACT,
  CONFIG_KEYS.POPUP_DIARY.TITLE,
  CONFIG_KEYS.POPUP_DIARY.CONTENT,
  CONFIG_KEYS.POPUP_DIARY.PRIMARY_BTN,
  CONFIG_KEYS.POPUP_DIARY.SECONDARY_BTN,
  CONFIG_KEYS.POPUP_DIARY.CONTACT
];

const FEATURE_TYPES = {
  AI_CHAT: 'ai_chat',
  DIARY: 'diary'
};

const DEFAULT_CONFIG_VALUES = {
  [CONFIG_KEYS.GLOBAL.ENABLED]: '0',
  [CONFIG_KEYS.GLOBAL.GRAYSCALE_PERCENT]: '0',
  [CONFIG_KEYS.AI_CHAT.ENABLED]: '1',
  [CONFIG_KEYS.AI_CHAT.THRESHOLD]: '30',
  [CONFIG_KEYS.DIARY.ENABLED]: '1',
  [CONFIG_KEYS.DIARY.THRESHOLD]: '2',
  [CONFIG_KEYS.POPUP_AI.TITLE]: '试用权限已用尽',
  [CONFIG_KEYS.POPUP_AI.CONTENT]: '您的免费试用次数已使用完毕，如需继续使用该功能，可联系客服获取正式使用授权。',
  [CONFIG_KEYS.POPUP_AI.PRIMARY_BTN]: '联系客服获取授权',
  [CONFIG_KEYS.POPUP_AI.SECONDARY_BTN]: '取消',
  [CONFIG_KEYS.POPUP_AI.CONTACT]: '客服微信号',
  [CONFIG_KEYS.POPUP_DIARY.TITLE]: '试用权限已用尽',
  [CONFIG_KEYS.POPUP_DIARY.CONTENT]: '您的免费试用次数已使用完毕，如需继续使用该功能，可联系客服获取正式使用授权。',
  [CONFIG_KEYS.POPUP_DIARY.PRIMARY_BTN]: '联系客服获取授权',
  [CONFIG_KEYS.POPUP_DIARY.SECONDARY_BTN]: '取消',
  [CONFIG_KEYS.POPUP_DIARY.CONTACT]: '客服微信号'
};

module.exports = {
  CONFIG_KEYS,
  POPUP_KEYS,
  FEATURE_TYPES,
  DEFAULT_CONFIG_VALUES
};
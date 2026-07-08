/**
 * 业务常量
 */

export const MEAL_OPTIONS = [
  { value: 'breakfast', label: '早餐', icon: '🌅' },
  { value: 'lunch', label: '午餐', icon: '☀️' },
  { value: 'dinner', label: '晚餐', icon: '🌙' },
  { value: 'snack', label: '加餐', icon: '🍪' }
];

export const EXERCISE_TYPES = [
  { value: 'aerobic', label: '有氧运动', icon: '🏃' },
  { value: 'strength', label: '力量训练', icon: '💪' },
  { value: 'stretch', label: '拉伸放松', icon: '🧘' },
  { value: 'ball', label: '球类运动', icon: '⚽' }
];

export const HABIT_TYPES = [
  { value: 'water', label: '喝水', unit: 'ml', icon: '💧' },
  { value: 'sleep', label: '睡眠', unit: '小时', icon: '😴' },
  { value: 'defecation', label: '排便', unit: '次', icon: '🚽' },
  { value: 'mood', label: '心情', unit: '', icon: '😊' }
];

export const MOOD_OPTIONS = [
  { value: 1, label: '糟糕', emoji: '😫' },
  { value: 2, label: '低落', emoji: '😔' },
  { value: 3, label: '一般', emoji: '😐' },
  { value: 4, label: '不错', emoji: '🙂' },
  { value: 5, label: '超棒', emoji: '😄' }
];

export const PARTNER_MODES = [
  { value: 'gentle', label: '温柔鼓励', desc: '像闺蜜一样温柔陪伴，永远先安慰再鼓励', color: '#A8E6CF' },
  { value: 'strict', label: '严格监督', desc: '坚定直接不啰嗦，该严格时绝不心软', color: '#B5E2FF' },
  { value: 'tease', label: '毒舌模式', desc: '直接犀利不留情面，扎心但有效', color: '#FFD6E0' }
];

export const MUSEUM_TYPES = [
  { value: 'quote', label: '金句墙', icon: '💬' },
  { value: 'recipe', label: '食谱库', icon: '🍳' },
  { value: 'insight', label: '感悟与心情', icon: '📝' },
  { value: 'method', label: '方法库', icon: '💡' },
  { value: 'pitfall', label: '踩坑集', icon: '⚠️' }
];

// 用户口语中的形容词单位，仅用于估算，不在界面上展示
export const DESCRIPTIVE_UNITS = ['把', '大把', '小把', '撮', '堆', '些', '点', '少许', '适量', '份'];

export function isDescriptiveUnit(unit) {
  return DESCRIPTIVE_UNITS.includes(String(unit || '').trim());
}

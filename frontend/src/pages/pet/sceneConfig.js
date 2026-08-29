/**
 * 搭搭场景兜底配置
 * 一期默认只有「小窝」单场景；场景名称/时段背景图由 CMS pet_scenes 配置下发，
 * 后台未配置或配置为空时使用这里的兜底值。
 * 所有坐标、宽度均使用 rpx（750rpx 设计稿基准）
 * 注意：以下图片路径均为服务端静态资源地址，由前端通过 resolveStaticUrl 解析为完整 CDN URL，
 * 本地 static 目录中不再保留这些大图，以减小小程序包体积。
 */

export const fallbackScenes = [
  {
    key: 'room',
    name: '小窝',
    // 时段背景：白天 6:01-19:00 / 傍晚 19:01-22:00 / 夜晚 22:01-次日 6:00
    // 兜底背景图已迁移至后端 CDN，CMS 场景配置中会下发已上传的背景图 URL
    bg_day: '/static/image/icon/background_zhu01.jpg',
    bg_evening: '/static/image/icon/background_zhu02.jpg',
    bg_night: '/static/image/icon/background_zhu03.jpg',
    // 背景图固定高度（rpx），宽度按此高度 × 宽高比等比缩放
    bg_height: 1450,
    // 背景图宽高比（宽/高）
    bg_aspect: 1871 / 1930,
    // 场景物品（世界坐标），暂无
    items: [],
    // 任务气泡配置（key -> 接口字段映射）
    bubbles: {
      feed: { showKey: 'hasFeedTask', icon: '/static/image/icon/tanhao@3x.png' },
      exercise: { showKey: 'hasExerciseTask', icon: '/static/image/icon/tanhao@3x.png' }
    }
  }
];

export const defaultSceneKey = 'room';

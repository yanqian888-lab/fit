// custom-tab-bar/index.js —— 原生微信小程序组件
// 完美复刻图1视觉 + 修复 index=0 switchTab 报错兜底

Component({
  data: {
    selected: 0,
    list: [
      { pagePath: 'pages/index/index', text: '聊聊', iconPath: '/static/tabbar/chat.png', selectedIconPath: '/static/tabbar/chat-active.png' },
      { pagePath: 'pages/pet/index', text: '搭搭', iconPath: '/static/tabbar/pet.png', selectedIconPath: '/static/tabbar/pet-active.png' },
      { pagePath: 'pages/record/index', text: '记录', iconPath: '/static/tabbar/record.png', selectedIconPath: '/static/tabbar/record-active.png' },
      { pagePath: 'pages/museum/index', text: '博物馆', iconPath: '/static/tabbar/museum.png', selectedIconPath: '/static/tabbar/museum-active.png' }
    ]
  },

  methods: {
    /**
     * tab 点击切换
     * ⚠️ 必须带前导斜杠（绝对路径）！不带斜杠会被当相对路径
     * ⚠️ 微信基础库 3.17.1 bug：从其他 tab 切回 index(0) 时可能报 "no-tabBar page"
     *    workaround：switchTab 失败时用 reLaunch 兜底（代价：重新加载，可能白屏）
     *    如果还是白屏，只在 index=0 时才 reLaunch
     * @param {WechatMiniprogram.TouchEvent} e 
     */
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const index = data.index;
      const path = data.path;

      if (this.data.selected === index) return;

      console.log('[CustomTabBar] 点击 tab:', index, path);
      this.setData({ selected: index });

      // 正常走 switchTab
      wx.switchTab({
        url: '/' + path,
        success: () => console.log('[CustomTabBar] switchTab ✅', path),
        fail: (err) => {
          console.warn('[CustomTabBar] switchTab ❌', path, err.errMsg);
          // ⚠️ 微信 bug 兜底：index=0 切不回，用 reLaunch
          if (index === 0) {
            console.log('[CustomTabBar] 用 reLaunch 兜底 index=0');
            wx.reLaunch({
              url: '/' + path,
              fail: (err2) => console.error('[CustomTabBar] reLaunch 也失败:', err2)
            });
          }
        }
      });
    }
  }
});

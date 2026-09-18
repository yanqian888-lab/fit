/**
 * 跟练页（workout/session.vue）返回拦截自测：
 * - 跟练进行中（开始后）自动开启微信返回确认拦截
 * - 未开始时不开拦截
 * - 点「结束」退出时先关闭拦截再返回，且按已跟练时长写入运动记录
 * - 系统返回确认后页面销毁（onUnload）时自动补记运动数据
 */
import { mount, flushPromises } from '@vue/test-utils';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// 捕获 uni 页面生命周期钩子（测试环境无真实页面实例，@dcloudio/uni-app 会报错，需 mock）
const uniHooks = vi.hoisted(() => ({}));

vi.mock('@dcloudio/uni-app', () => ({
  onUnload: (fn) => { uniHooks.onUnload = fn; },
  onShow: (fn) => { uniHooks.onShow = fn; },
  onHide: (fn) => { uniHooks.onHide = fn; },
  onLoad: (fn) => { uniHooks.onLoad = fn; },
  onReady: (fn) => { uniHooks.onReady = fn; }
}));

vi.mock('../api', () => ({
  workoutApi: {
    getDetail: vi.fn(() => Promise.resolve({
      data: { name: '核心平板支撑', calorie_per_hour: 300, duration_mode: 'unlimited', video_url: '' }
    })),
    complete: vi.fn(() => Promise.resolve({ data: { calorie: 25 } }))
  }
}));

vi.mock('../utils/navigate', () => ({
  goBack: vi.fn()
}));

vi.mock('../utils/environment.js', () => ({
  resolveStaticUrl: (p) => p
}));

import SessionPage from '../pages/workout/session.vue';
import { workoutApi } from '../api';
import { goBack } from '../utils/navigate';

function mountPage() {
  return mount(SessionPage);
}

describe('跟练页返回拦截', () => {
  beforeEach(() => {
    // #ifdef MP-WEIXIN 代码块在 vitest 中不会被条件编译剔除，直接 mock wx 全局对象即可覆盖
    global.wx = {
      enableAlertBeforeUnload: vi.fn(),
      disableAlertBeforeUnload: vi.fn()
    };
    uni.createVideoContext = vi.fn(() => ({ play: vi.fn(), pause: vi.fn() }));
    uni.setNavigationBarTitle = vi.fn();
    getCurrentPages.mockReturnValue([
      { options: { key: 'core-plank' }, $page: { options: { key: 'core-plank' } } }
    ]);
  });

  afterEach(() => {
    delete global.wx;
    delete uniHooks.onUnload;
  });

  it('未开始跟练（ready）时不开启返回拦截', async () => {
    mountPage();
    await flushPromises();
    expect(wx.enableAlertBeforeUnload).not.toHaveBeenCalled();
  });

  it('点击「开始跟练」后开启返回拦截', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.find('.action-btn.primary').trigger('click');
    expect(wx.enableAlertBeforeUnload).toHaveBeenCalled();
  });

  it('点「结束」退出：关闭拦截、按已跟练时长记录运动数据并返回', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = mountPage();
      await flushPromises();
      // 开始跟练（5 秒倒计时）：推进 6 秒 = 倒计时 5s + playing 1s，elapsed=1
      await wrapper.find('.action-btn.primary').trigger('click');
      await vi.advanceTimersByTimeAsync(6000);

      const exitBtn = wrapper.findAll('.action-btn').find(b => b.text() === '结束');
      expect(exitBtn).toBeTruthy();
      await exitBtn.trigger('click');
      await flushPromises();

      // 已跟练时长写入运动记录（playing 阶段 1 秒）
      expect(workoutApi.complete).toHaveBeenCalledWith('core-plank', { duration_seconds: 1 });
      // 退出前关闭返回拦截，避免已记录后又弹系统确认框
      expect(wx.disableAlertBeforeUnload).toHaveBeenCalled();
      // 记录成功后延迟返回
      await vi.advanceTimersByTimeAsync(1300);
      expect(goBack).toHaveBeenCalled();
      expect(uni.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('已记录运动') })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('已开始但时长为 0 时直接返回、不调用记录接口', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = mountPage();
      await flushPromises();
      await wrapper.find('.action-btn.primary').trigger('click'); // 进入倒计时，elapsed=0

      const exitBtn = wrapper.findAll('.action-btn').find(b => b.text() === '结束');
      await exitBtn.trigger('click');
      await flushPromises();
      await vi.advanceTimersByTimeAsync(100);

      expect(workoutApi.complete).not.toHaveBeenCalled();
      expect(goBack).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('系统返回确认后页面销毁（onUnload）：按已跟练时长补记运动数据', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = mountPage();
      await flushPromises();
      await wrapper.find('.action-btn.primary').trigger('click');
      await vi.advanceTimersByTimeAsync(6000); // 倒计时 5s + playing 1s

      // 模拟用户点了系统弹窗「返回」→ 页面销毁
      expect(typeof uniHooks.onUnload).toBe('function');
      uniHooks.onUnload();
      await flushPromises();

      expect(workoutApi.complete).toHaveBeenCalledWith('core-plank', { duration_seconds: 1 });
      // onUnload 只负责补记，返回动作由系统完成，不调用 goBack
      expect(goBack).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('未开始即返回（onUnload 且时长为 0）不调用记录接口', async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(typeof uniHooks.onUnload).toBe('function');
    uniHooks.onUnload();
    await flushPromises();
    expect(workoutApi.complete).not.toHaveBeenCalled();
  });
});

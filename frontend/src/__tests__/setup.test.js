/**
 * 前端基础设施单元测试
 * 覆盖：systemInfo / request / navigate / trial / store / api 模块
 * 注意：全局 uni、getCurrentPages、window 由 setup.ts 注入；
 *       mockReset 会在每个 test 前重置 mock 实现，需在用例内重新配置返回值。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { getSystemInfoSafe } from '../utils/systemInfo';
import { goBack } from '../utils/navigate';
import { getAppVersion } from '../utils/trial';
import { request } from '../utils/request';
import { useUserStore } from '../store';
import { authApi, userApi, chatApi, recordApi, museumApi } from '../api';

describe('Utils: systemInfo.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 清理上个用例动态挂载的新细分 API，保证回退分支可测
    delete uni.getWindowInfo;
    delete uni.getDeviceInfo;
    delete uni.getAppBaseInfo;
  });

  it('新 API 不可用时应回退 getSystemInfoSync', () => {
    uni.getSystemInfoSync.mockReturnValue({ statusBarHeight: 44, windowWidth: 375 });
    const info = getSystemInfoSafe();
    expect(info.statusBarHeight).toBe(44);
    expect(info.windowWidth).toBe(375);
  });

  it('新 API 可用时应合并 window/device/app 三类字段', () => {
    uni.getWindowInfo = vi.fn(() => ({ windowWidth: 375, statusBarHeight: 44 }));
    uni.getDeviceInfo = vi.fn(() => ({ platform: 'ios', brand: 'iPhone' }));
    uni.getAppBaseInfo = vi.fn(() => ({ SDKVersion: '3.0.0', version: '1.0.0' }));
    const info = getSystemInfoSafe();
    expect(info.windowWidth).toBe(375);
    expect(info.statusBarHeight).toBe(44);
    expect(info.platform).toBe('ios');
    expect(info.SDKVersion).toBe('3.0.0');
  });
});

describe('Utils: request.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uni.getSystemInfoSync.mockReturnValue({ statusBarHeight: 44 });
  });

  it('token 存在时 header 应携带 Authorization Bearer', async () => {
    uni.getStorageSync.mockImplementation((key) => (key === 'token' ? 'test_token' : undefined));
    let capturedOpts;
    uni.request.mockImplementation((opts) => {
      capturedOpts = opts;
      opts.success({ statusCode: 200, data: { code: 0, data: { ok: true } } });
    });
    const res = await request({ url: '/test', method: 'GET' });
    expect(capturedOpts.header.Authorization).toBe('Bearer test_token');
    expect(res.code).toBe(0);
  });

  it('401 应清除 token 并触发 auth:expired 事件', async () => {
    uni.getStorageSync.mockImplementation((key) => (key === 'token' ? 'expired_token' : undefined));
    uni.request.mockImplementation((opts) =>
      opts.success({ statusCode: 401, data: { code: 401, message: 'expired' } })
    );
    await expect(request({ url: '/test' })).rejects.toMatchObject({ code: 401 });
    expect(uni.removeStorageSync).toHaveBeenCalledWith('token');
    expect(uni.$emit).toHaveBeenCalledWith('auth:expired');
  });

  it('loading 为 true 时应显示并隐藏 loading', async () => {
    uni.getStorageSync.mockReturnValue(undefined);
    uni.request.mockImplementation((opts) =>
      opts.success({ statusCode: 200, data: { code: 0, data: {} } })
    );
    await request({ url: '/test', loading: true });
    expect(uni.showLoading).toHaveBeenCalled();
    expect(uni.hideLoading).toHaveBeenCalled();
  });
});

describe('Utils: navigate.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom 的 history.length 为只读访问器，直接赋值会抛错；
    // 用 Object.defineProperty 替换为可控 mock，length=0 跳过 H5 back 分支，走 getCurrentPages 分支
    Object.defineProperty(global.window, 'history', {
      value: { length: 0, back: vi.fn() },
      configurable: true,
      writable: true
    });
  });

  it('pages.length > 1 时应 navigateBack', () => {
    global.getCurrentPages.mockReturnValue([{ route: '/a' }, { route: '/b' }]);
    goBack();
    expect(uni.navigateBack).toHaveBeenCalledWith({ delta: 1 });
  });

  it('pages.length === 1 且 fallbackUrl 是 tab 页时应 switchTab', () => {
    global.getCurrentPages.mockReturnValue([{ route: '/pages/index/index' }]);
    goBack('/pages/index/index');
    expect(uni.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' });
  });

  it('pages.length === 1 且 fallbackUrl 非 tab 页时应 redirectTo', () => {
    global.getCurrentPages.mockReturnValue([{ route: '/pages/index/index' }]);
    goBack('/pages/user/profile');
    expect(uni.redirectTo).toHaveBeenCalledWith({ url: '/pages/user/profile' });
  });
});

describe('Utils: trial.js', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('应能从小程序 accountInfo 读取版本号', () => {
    uni.getAccountInfoSync = vi.fn(() => ({ miniProgram: { version: '1.2.3' } }));
    expect(getAppVersion()).toBe('1.2.3');
  });

  it('读取版本号失败时应返回默认版本', () => {
    uni.getAccountInfoSync = vi.fn(() => { throw new Error('not support'); });
    expect(getAppVersion()).toBe('1.0.0');
  });
});

describe('Store: user', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('login 应设置 token、userInfo 并持久化', () => {
    const store = useUserStore();
    store.login('test_token', { id: 1, nickname: '测试用户' });
    expect(store.token).toBe('test_token');
    expect(store.userInfo.nickname).toBe('测试用户');
    expect(uni.setStorageSync).toHaveBeenCalledWith('token', 'test_token');
  });

  it('logout 应清除登录态并删除 storage', () => {
    const store = useUserStore();
    store.login('test_token', { id: 1 });
    store.logout();
    expect(store.token).toBe('');
    expect(store.userInfo).toBeNull();
    expect(uni.removeStorageSync).toHaveBeenCalledWith('token');
  });

  it('requireAuth 未登录时应跳转登录页并返回 false', () => {
    const store = useUserStore();
    store.logout();
    const ok = store.requireAuth();
    expect(ok).toBe(false);
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/login/index' });
  });

  it('requireAuth 已登录时应返回 true', () => {
    const store = useUserStore();
    store.login('test_token', { id: 1 });
    const ok = store.requireAuth();
    expect(ok).toBe(true);
  });
});

describe('API: index.js', () => {
  it('应导出 authApi 及其 login/register 方法', () => {
    expect(authApi).toBeDefined();
    expect(authApi.login).toBeInstanceOf(Function);
    expect(authApi.register).toBeInstanceOf(Function);
  });

  it('应导出 userApi 及其 getMe/updateMe 方法', () => {
    expect(userApi).toBeDefined();
    expect(userApi.getMe).toBeInstanceOf(Function);
    expect(userApi.updateMe).toBeInstanceOf(Function);
  });

  it('应导出 chatApi 及其 send/getMessages 方法', () => {
    expect(chatApi).toBeDefined();
    expect(chatApi.send).toBeInstanceOf(Function);
    expect(chatApi.getMessages).toBeInstanceOf(Function);
  });

  it('应导出 recordApi 及其 getToday/saveDiet 方法', () => {
    expect(recordApi).toBeDefined();
    expect(recordApi.getToday).toBeInstanceOf(Function);
    expect(recordApi.saveDiet).toBeInstanceOf(Function);
  });

  it('应导出 museumApi 及其 getOverview/addItem 方法', () => {
    expect(museumApi).toBeDefined();
    expect(museumApi.getOverview).toBeInstanceOf(Function);
    expect(museumApi.addItem).toBeInstanceOf(Function);
  });
});

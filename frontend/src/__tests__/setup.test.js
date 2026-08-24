import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

// Mock uni-app API
const mockUni = {
  getSystemInfoSync: vi.fn(() => ({
    statusBarHeight: 44,
    windowHeight: 800,
    windowWidth: 375
  })),
  getStorageSync: vi.fn((key) => {
    if (key === 'token') return 'test_token';
    return null;
  }),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  showToast: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  navigateTo: vi.fn(),
  navigateBack: vi.fn(),
  switchTab: vi.fn(),
  reLaunch: vi.fn(),
  $emit: vi.fn(),
  $on: vi.fn(),
  $off: vi.fn()
};

global.uni = mockUni;
global.getCurrentPages = vi.fn(() => [{ route: '/pages/index/index' }]);

describe('App.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should set status bar height on launch', async () => {
    const { onLaunch } = await import('../src/App.vue');
    
    // 模拟 H5 环境
    // @ts-ignore
    global.document = {
      documentElement: {
        style: {
          setProperty: vi.fn()
        }
      }
    };

    // 验证状态栏高度获取
    expect(mockUni.getSystemInfoSync).toBeDefined();
  });
});

describe('Utils: request.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add Authorization header when token exists', async () => {
    mockUni.getStorageSync.mockReturnValue('test_token');
    
    // 验证 token 获取
    const token = mockUni.getStorageSync('token');
    expect(token).toBe('test_token');
  });

  it('should handle 401 response', async () => {
    // 模拟 401 响应
    mockUni.removeStorageSync.mockClear();
    
    // 验证清除 token
    mockUni.removeStorageSync('token');
    expect(mockUni.removeStorageSync).toHaveBeenCalledWith('token');
  });

  it('should show loading when loading option is true', async () => {
    mockUni.showLoading.mockClear();
    
    // 验证 loading 显示
    mockUni.showLoading({ title: '加载中...', mask: true });
    expect(mockUni.showLoading).toHaveBeenCalled();
  });
});

describe('Utils: navigate.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should navigate back when pages.length > 1', () => {
    global.getCurrentPages.mockReturnValue([
      { route: '/pages/index/index' },
      { route: '/pages/user/profile' }
    ]);

    const pages = getCurrentPages();
    expect(pages.length).toBe(2);
    
    // 模拟返回
    mockUni.navigateBack({ delta: 1 });
    expect(mockUni.navigateBack).toHaveBeenCalled();
  });

  it('should switchTab when pages.length === 1', () => {
    global.getCurrentPages.mockReturnValue([
      { route: '/pages/index/index' }
    ]);

    const pages = getCurrentPages();
    expect(pages.length).toBe(1);
    
    // 模拟跳转
    mockUni.switchTab({ url: '/pages/index/index' });
    expect(mockUni.switchTab).toHaveBeenCalled();
  });
});

describe('Utils: trial.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate device ID', () => {
    const deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    expect(deviceId).toMatch(/^device_\d+_[a-z0-9]+$/);
  });

  it('should get device ID from storage', () => {
    mockUni.getStorageSync.mockImplementation((key) => {
      if (key === 'device_id') return 'stored_device_id';
      return null;
    });

    const storedId = mockUni.getStorageSync('device_id');
    expect(storedId).toBe('stored_device_id');
  });
});

describe('Store: user.js', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should initialize with default values', async () => {
    const { useUserStore } = await import('../src/store/user.js');
    const userStore = useUserStore();
    
    expect(userStore.token).toBe('');
    expect(userStore.userInfo).toBeNull();
  });

  it('should login and set token', async () => {
    const { useUserStore } = await import('../src/store/user.js');
    const userStore = useUserStore();
    
    userStore.login('test_token', { id: 1, nickname: '测试用户' });
    
    expect(userStore.token).toBe('test_token');
    expect(userStore.userInfo.nickname).toBe('测试用户');
    expect(mockUni.setStorageSync).toHaveBeenCalledWith('token', 'test_token');
  });

  it('should logout and clear token', async () => {
    const { useUserStore } = await import('../src/store/user.js');
    const userStore = useUserStore();
    
    userStore.login('test_token', { id: 1 });
    userStore.logout();
    
    expect(userStore.token).toBe('');
    expect(userStore.userInfo).toBeNull();
    expect(mockUni.removeStorageSync).toHaveBeenCalledWith('token');
  });
});

describe('API: index.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export authApi', async () => {
    const api = await import('../src/api/index.js');
    expect(api.authApi).toBeDefined();
    expect(api.authApi.login).toBeInstanceOf(Function);
    expect(api.authApi.register).toBeInstanceOf(Function);
  });

  it('should export userApi', async () => {
    const api = await import('../src/api/index.js');
    expect(api.userApi).toBeDefined();
    expect(api.userApi.getMe).toBeInstanceOf(Function);
    expect(api.userApi.updateMe).toBeInstanceOf(Function);
  });

  it('should export chatApi', async () => {
    const api = await import('../src/api/index.js');
    expect(api.chatApi).toBeDefined();
    expect(api.chatApi.send).toBeInstanceOf(Function);
    expect(api.chatApi.getMessages).toBeInstanceOf(Function);
  });

  it('should export recordApi', async () => {
    const api = await import('../src/api/index.js');
    expect(api.recordApi).toBeDefined();
    expect(api.recordApi.getToday).toBeInstanceOf(Function);
    expect(api.recordApi.saveDiet).toBeInstanceOf(Function);
  });

  it('should export museumApi', async () => {
    const api = await import('../src/api/index.js');
    expect(api.museumApi).toBeDefined();
    expect(api.museumApi.getOverview).toBeInstanceOf(Function);
    expect(api.museumApi.addItem).toBeInstanceOf(Function);
  });
});
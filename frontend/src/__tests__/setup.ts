import { vi } from 'vitest';
import { config } from '@vue/test-utils';

// Mock uni-app API
const mockUni = {
  getSystemInfoSync: vi.fn(() => ({
    statusBarHeight: 44,
    windowHeight: 800,
    windowWidth: 375,
    platform: 'ios'
  })),
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  clearStorageSync: vi.fn(),
  showToast: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  showModal: vi.fn(),
  navigateTo: vi.fn(),
  navigateBack: vi.fn(),
  switchTab: vi.fn(),
  reLaunch: vi.fn(),
  redirectTo: vi.fn(),
  request: vi.fn(),
  uploadFile: vi.fn(),
  $emit: vi.fn(),
  $on: vi.fn(),
  $off: vi.fn(),
  login: vi.fn(),
  hideTabBar: vi.fn(),
  showTabBar: vi.fn(),
  saveImageToPhotosAlbum: vi.fn(),
  getRecorderManager: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onStart: vi.fn(),
    onStop: vi.fn()
  }))
};

global.uni = mockUni;
global.getCurrentPages = vi.fn(() => [{ route: '/pages/index/index' }]);

// Mock window
if (typeof window === 'undefined') {
  global.window = {
    history: { length: 2, back: vi.fn() },
    location: { href: 'http://localhost:3000' }
  };
}

// Vue Test Utils config
config.global.mocks = {
  $t: (key: string) => key
};

// Setup for Pinia
vi.mock('pinia', async () => {
  const pinia = await import('pinia');
  return {
    ...pinia,
    createPinia: vi.fn(() => ({
      state: {},
      install: vi.fn()
    }))
  };
});
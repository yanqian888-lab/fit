/**
 * 系统信息获取（兼容 wx 新细分 API，替代废弃的 wx.getSystemInfoSync）
 *
 * 背景：微信基础库 2.32+ 开始废弃 getSystemInfoSync，要求用
 * getWindowInfo / getDeviceInfo / getAppBaseInfo / getSystemSetting 等细分接口。
 * 本工具把三类信息合并成旧 getSystemInfoSync 的字段结构，
 * 既消除 deprecated 警告，又兼容旧基础库（fallback 旧 API）。
 */

/**
 * 获取系统信息（合并 window + device + app 三类信息）
 * 返回字段与旧 getSystemInfoSync 保持一致：
 *  - windowWidth / windowHeight / statusBarHeight / safeArea / pixelRatio
 *  - platform / system / SDKVersion / host / appVersion / brand / model
 * @returns {Object} 与旧 getSystemInfoSync 字段对齐的系统信息对象
 */
export function getSystemInfoSafe() {
  try {
    const uniW = (typeof uni !== 'undefined') ? uni : (typeof wx !== 'undefined' ? wx : globalThis);
    // 1) 窗口信息（尺寸/状态栏/安全区）
    let win = {};
    if (typeof uniW.getWindowInfo === 'function') {
      win = uniW.getWindowInfo();
    }
    // 2) 设备信息（系统/平台/品牌/型号）
    let dev = {};
    if (typeof uniW.getDeviceInfo === 'function') {
      dev = uniW.getDeviceInfo();
    }
    // 3) App 宿主信息（基础库版本/宿主版本）
    let app = {};
    if (typeof uniW.getAppBaseInfo === 'function') {
      app = uniW.getAppBaseInfo();
    }

    // 三个都拿不到 → 回退到旧 API（最低兼容兜底）
    if (!Object.keys(win).length && !Object.keys(dev).length && !Object.keys(app).length) {
      return uniW.getSystemInfoSync ? uniW.getSystemInfoSync() : {};
    }

    // 合并成旧字段结构
    return {
      // —— 窗口类 ——
      windowWidth: win.windowWidth,
      windowHeight: win.windowHeight,
      statusBarHeight: win.statusBarHeight,
      safeArea: win.safeArea,
      pixelRatio: win.pixelRatio,
      screenWidth: win.screenWidth,
      screenHeight: win.screenHeight,
      // —— 设备类 ——
      platform: dev.platform,
      system: dev.system,
      brand: dev.brand,
      model: dev.model,
      deviceAbi: dev.abi,
      benchmarkLevel: dev.benchmarkLevel,
      deviceOrientation: dev.deviceOrientation,
      // —— App 宿主类 ——
      SDKVersion: app.SDKVersion || app.SDKVersion,
      appVersion: app.version,
      host: app.host,
      language: app.language,
      theme: app.theme,
      enableDebug: app.enableDebug
    };
  } catch (e) {
    // 任何异常都回退旧 API（极端场景兜底）
    try {
      const uniW = (typeof uni !== 'undefined') ? uni : (typeof wx !== 'undefined' ? wx : globalThis);
      return uniW.getSystemInfoSync ? uniW.getSystemInfoSync() : {};
    } catch (err) {
      return {};
    }
  }
}

/**
 * 仅获取窗口信息（避免采集设备品牌/型号/系统等敏感信息）
 * 用于布局适配：statusBarHeight / windowWidth / windowHeight / safeArea 等
 */
export function getWindowInfoSafe() {
  try {
    const uniW = (typeof uni !== 'undefined') ? uni : (typeof wx !== 'undefined' ? wx : globalThis);
    if (typeof uniW.getWindowInfo === 'function') {
      const win = uniW.getWindowInfo();
      return {
        windowWidth: win.windowWidth,
        windowHeight: win.windowHeight,
        statusBarHeight: win.statusBarHeight,
        safeArea: win.safeArea,
        safeAreaInsets: win.safeAreaInsets,
        pixelRatio: win.pixelRatio,
        screenWidth: win.screenWidth,
        screenHeight: win.screenHeight
      };
    }
    // 兼容旧基础库
    if (typeof uniW.getSystemInfoSync === 'function') {
      const info = uniW.getSystemInfoSync();
      return {
        windowWidth: info.windowWidth,
        windowHeight: info.windowHeight,
        statusBarHeight: info.statusBarHeight,
        safeArea: info.safeArea,
        safeAreaInsets: info.safeAreaInsets,
        pixelRatio: info.pixelRatio,
        screenWidth: info.screenWidth,
        screenHeight: info.screenHeight
      };
    }
  } catch (e) {
    console.error('[systemInfo] 获取窗口信息失败', e);
  }
  return {};
}

export default { getSystemInfoSafe, getWindowInfoSafe };

/**
 * 配置监控服务
 * 实现配置变更监控和告警
 */

class ConfigMonitor {
  constructor() {
    this.metrics = {
      changeCount: 0,
      accessCount: 0,
      errorCount: 0,
      lastChangeTime: null,
      lastAccessTime: null
    };
    
    this.thresholds = {
      maxAccessPerMinute: 100,
      maxChangePerHour: 50,
      maxErrorPerHour: 10
    };
    
    this.accessLog = [];
    this.changeLog = [];
  }

  /**
   * 记录配置访问
   */
  recordAccess(userId, keys, ip) {
    const now = Date.now();
    
    this.metrics.accessCount++;
    this.metrics.lastAccessTime = now;
    
    this.accessLog.push({
      userId,
      keys,
      ip,
      timestamp: now
    });
    
    if (this.accessLog.length > 1000) {
      this.accessLog = this.accessLog.slice(-500);
    }
    
    const recentAccess = this.accessLog.filter(
      log => now - log.timestamp < 60000
    ).length;
    
    if (recentAccess > this.thresholds.maxAccessPerMinute) {
      this.sendAlert('配置访问频率异常', {
        count: recentAccess,
        threshold: this.thresholds.maxAccessPerMinute,
        userId,
        ip
      });
    }
  }

  /**
   * 记录配置变更
   */
  recordChange(key, oldValue, newValue, userId, ip) {
    const now = Date.now();
    
    this.metrics.changeCount++;
    this.metrics.lastChangeTime = now;
    
    this.changeLog.push({
      key,
      oldValue,
      newValue,
      userId,
      ip,
      timestamp: now
    });
    
    if (this.changeLog.length > 500) {
      this.changeLog = this.changeLog.slice(-250);
    }
    
    const recentChanges = this.changeLog.filter(
      log => now - log.timestamp < 3600000
    ).length;
    
    if (recentChanges > this.thresholds.maxChangePerHour) {
      this.sendAlert('配置变更频率异常', {
        count: recentChanges,
        threshold: this.thresholds.maxChangePerHour,
        userId,
        ip
      });
    }
    
    if (this.isSensitiveKey(key)) {
      this.sendAlert('敏感配置变更', {
        key,
        oldValue,
        newValue,
        userId,
        ip
      });
    }
  }

  /**
   * 记录配置错误
   */
  recordError(error, context) {
    const now = Date.now();
    
    this.metrics.errorCount++;
    
    console.error('[ConfigMonitor] 配置错误:', {
      error: error.message,
      context,
      timestamp: now
    });
    
    const recentErrors = this.changeLog.filter(
      log => now - log.timestamp < 3600000
    ).length;
    
    if (recentErrors > this.thresholds.maxErrorPerHour) {
      this.sendAlert('配置错误频率异常', {
        count: recentErrors,
        threshold: this.thresholds.maxErrorPerHour,
        error: error.message
      });
    }
  }

  /**
   * 检查是否为敏感配置
   */
  isSensitiveKey(key) {
    const sensitiveKeys = ['api_key', 'secret', 'password', 'token', 'key'];
    return sensitiveKeys.some(sk => key.toLowerCase().includes(sk));
  }

  /**
   * 发送告警
   */
  sendAlert(title, data) {
    const alert = {
      title,
      data,
      timestamp: Date.now()
    };
    
    console.error(`[CONFIG ALERT] ${title}`, data);
    
    // TODO: 集成到实际的告警系统
    // 例如：钉钉、企业微信、邮件等
  }

  /**
   * 获取监控指标
   */
  getMetrics() {
    return {
      ...this.metrics,
      recentAccess: this.accessLog.slice(-10),
      recentChanges: this.changeLog.slice(-10)
    };
  }
}

const configMonitor = new ConfigMonitor();

module.exports = configMonitor;
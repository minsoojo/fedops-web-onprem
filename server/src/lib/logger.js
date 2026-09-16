// 로깅 헬퍼 유틸리티
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const currentLogLevel = process.env.LOG_LEVEL || 'DEBUG';
const logLevelNum = LOG_LEVELS[currentLogLevel] || LOG_LEVELS.DEBUG;

export const logger = {
  error: (message, data = null) => {
    if (logLevelNum >= LOG_LEVELS.ERROR) {
      console.error(`❌ [ERROR] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  },
  warn: (message, data = null) => {
    if (logLevelNum >= LOG_LEVELS.WARN) {
      console.warn(`⚠️ [WARN] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  },
  info: (message, data = null) => {
    if (logLevelNum >= LOG_LEVELS.INFO) {
      console.log(`ℹ️ [INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  },
  debug: (message, data = null) => {
    if (logLevelNum >= LOG_LEVELS.DEBUG) {
      console.log(`🐛 [DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  },
  api: (title, details = {}) => {
    if (logLevelNum >= LOG_LEVELS.INFO) {
      console.log('\n' + '🔗'.repeat(50));
      console.log(`🔗 ${title}`);
      console.log('🔗'.repeat(50));
      Object.entries(details).forEach(([key, value]) => {
        console.log(`${key}: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`);
      });
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
      console.log('🔗'.repeat(50));
    }
  }
};

export default logger;
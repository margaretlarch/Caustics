require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,

  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  defaults: {
    apiProvider: process.env.DEFAULT_API_PROVIDER || 'anthropic',
    apiBaseUrl: process.env.DEFAULT_API_BASE_URL || 'https://api.anthropic.com/v1/messages',
    apiKey: process.env.DEFAULT_API_KEY || '',
    modelName: process.env.DEFAULT_MODEL_NAME || 'claude-haiku-4-5-20251001',
    fallbackProvider: process.env.DEFAULT_FALLBACK_PROVIDER || 'deepseek',
    fallbackApiBaseUrl: process.env.DEFAULT_FALLBACK_API_BASE_URL || 'https://api.deepseek.com/v1/chat/completions',
    fallbackApiKey: process.env.DEFAULT_FALLBACK_API_KEY || '',
    fallbackModelName: process.env.DEFAULT_FALLBACK_MODEL_NAME || 'deepseek-chat',
  },

  clawbot: {
    apiUrl: process.env.CLAWBOT_API_URL || 'http://localhost:8080',
    token: process.env.CLAWBOT_TOKEN || '',
    defaultUserId: process.env.WECHAT_DEFAULT_USER_ID || '',
  },

  // 默认时段配置 (数据库为空时的硬编码 fallback)
  defaultsSchedule: {
    checkinStartHour: 10,
    checkinEndHour: 23,
    quietStartHour: 3,
    quietEndHour: 10,
    checkinProbability: 0.3,  // 每次 /run-jobs 触发 check-in 的概率
    dailyLogHour: 22,         // 每日生成 diary 的小时 (UTC, 需按用户时区调整)
    timezone: 'Asia/Shanghai',
  },
};

module.exports = config;
const supabase = require('./supabase');
const config = require('../config');

let cache = {};
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 1000; // 30 秒

/**
 * 从 shadow_config 表加载全部配置到内存缓存
 */
async function loadConfigFromDB() {
  const { data, error } = await supabase
    .from('shadow_config')
    .select('key, value');

  if (error) {
    console.error('[configService] 无法加载数据库配置，使用环境变量 fallback:', error.message);
    return;
  }

  const map = {};
  for (const row of data) {
    map[row.key] = row.value;
  }
  cache = map;
  cacheTimestamp = Date.now();
  console.log('[configService] 配置已从数据库刷新，共', Object.keys(map).length, '项');
}

/**
 * 获取配置项，优先级：DB 缓存 > 环境变量 > 硬编码默认值
 */
async function get(key, defaultValue = '') {
  if (Date.now() - cacheTimestamp > CACHE_TTL) {
    await loadConfigFromDB();
  }
  if (cache[key] !== undefined) return cache[key];

  // fallback 到环境变量 / 默认值
  const envMap = {
    api_provider: config.defaults.apiProvider,
    api_base_url: config.defaults.apiBaseUrl,
    api_key: config.defaults.apiKey,
    model_name: config.defaults.modelName,
    fallback_provider: config.defaults.fallbackProvider,
    fallback_api_base_url: config.defaults.fallbackApiBaseUrl,
    fallback_api_key: config.defaults.fallbackApiKey,
    fallback_model_name: config.defaults.fallbackModelName,
    checkin_start_hour: String(config.defaultsSchedule.checkinStartHour),
    checkin_end_hour: String(config.defaultsSchedule.checkinEndHour),
    quiet_start_hour: String(config.defaultsSchedule.quietStartHour),
    quiet_end_hour: String(config.defaultsSchedule.quietEndHour),
  };

  return envMap[key] || defaultValue;
}

/**
 * 强制刷新缓存（Dashboard 保存配置后调用）
 */
async function invalidateCache() {
  cacheTimestamp = 0;
  await loadConfigFromDB();
}

module.exports = { get, invalidateCache, loadConfigFromDB };
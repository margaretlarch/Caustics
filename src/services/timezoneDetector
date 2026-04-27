const supabase = require('./supabase');
const configService = require('./configService');

/**
 * 根据微信消息时间戳计算用户本地时区偏移（分钟），并平滑更新
 * @param {number|string} messageTimestamp - 消息的秒级 Unix 时间戳（来自微信 CreateTime）
 */
async function updateTimezoneOffset(messageTimestamp) {
  if (!messageTimestamp) return;

  const msgTimeSec = parseInt(messageTimestamp, 10);
  if (isNaN(msgTimeSec)) return;

  // 1. 检查是否已手工锁定为固定时区名（非 auto 时跳过自动检测）
  const timezoneMode = await configService.get('timezone', 'auto');
  if (timezoneMode !== 'auto' && timezoneMode !== '') {
    console.log(`[timezone] 时区已手工设为 ${timezoneMode}，跳过自动检测`);
    return;
  }

  // 2. 计算本次偏移（分钟）
  const nowUtcSec = Math.floor(Date.now() / 1000);
  const diffSeconds = msgTimeSec - nowUtcSec;       // 正数 = 越东
  let newOffset = Math.round(diffSeconds / 60);     // 分钟

  // 限制合理范围 (UTC-12 ~ UTC+14)
  if (newOffset < -720) newOffset = -720;
  if (newOffset > 840)  newOffset = 840;

  // 3. 读取已保存的偏移，做指数平滑（权重 0.7 保留旧值，0.3 给新值）
  const oldOffsetStr = await configService.get('timezone_offset', '');
  let smoothedOffset = newOffset;
  if (oldOffsetStr !== '') {
    const oldOffset = parseInt(oldOffsetStr, 10);
    if (!isNaN(oldOffset)) {
      smoothedOffset = Math.round(oldOffset * 0.7 + newOffset * 0.3);
    }
  }

  // 4. 存入 shadow_config
  const { error } = await supabase
    .from('shadow_config')
    .upsert({ key: 'timezone_offset', value: String(smoothedOffset) }, { onConflict: 'key' });

  if (error) {
    console.warn('[timezone] 写入偏移失败:', error.message);
  } else {
    // 同时使配置缓存失效
    await configService.invalidateCache();
    console.log(`[timezone] 更新时区偏移至 UTC${smoothedOffset >= 0 ? '+' : ''}${smoothedOffset / 60}`);
  }
}

module.exports = { updateTimezoneOffset };

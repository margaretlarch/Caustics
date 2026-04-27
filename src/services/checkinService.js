const configService = require('./configService');
const config = require('../config');
const supabase = require('./supabase');
const wechatService = require('./wechatService');
const { generateReply } = require('../llm');
const { getContext, addMessage } = require('./contextCache');
const { buildSystemPrompt } = require('../templates/systemPrompt');

/**
 * 获取当前时间在用户本地时区的小时数
 * 优先使用手工时区名，其次使用自动计算的偏移，最后回退到 Asia/Shanghai
 */
async function getCurrentHour() {
  // 1. 手工时区名
  const manualTz = await configService.get('timezone', '');
  if (manualTz && manualTz !== 'auto') {
    try {
      const nowStr = new Date().toLocaleString('en-US', { timeZone: manualTz });
      return new Date(nowStr).getHours();
    } catch (e) {
      console.warn(`[checkinService] 无效时区名 ${manualTz}，回退到自动偏移`);
    }
  }

  // 2. 自动偏移（分钟）
  const offsetStr = await configService.get('timezone_offset', '480');  // 默认 +8
  const offsetMin = parseInt(offsetStr, 10) || 480;
  const utcHour = new Date().getUTCHours();
  const localHour = (utcHour + Math.floor(offsetMin / 60) + 24) % 24;
  return localHour;
}

/**
 * 判断当前时间是否在指定的时段内（基于用户本地时间）
 */
async function isInTimeWindow(startKey, endKey) {
  const startHour = parseInt(await configService.get(startKey, '0'));
  const endHour = parseInt(await configService.get(endKey, '24'));
  const currentHour = await getCurrentHour();
  return currentHour >= startHour && currentHour < endHour;
}

/**
 * 检查并可能发起一次主动 check-in
 */
async function tryCheckin(userId) {
  if (!userId) {
    console.log('[checkinService] 无用户 ID，跳过 check-in');
    return null;
  }

  // 1. 是否在 check-in 时段
  const inCheckinWindow = await isInTimeWindow('checkin_start_hour', 'checkin_end_hour');
  if (!inCheckinWindow) {
    console.log('[checkinService] 当前不在 check-in 时段，跳过');
    return null;
  }

  // 2. 是否在安静时段
  const inQuietWindow = await isInTimeWindow('quiet_start_hour', 'quiet_end_hour');
  if (inQuietWindow) {
    console.log('[checkinService] 当前在安静时段，不打扰');
    return null;
  }

  // 3. 随机概率
  const probability = parseFloat(await configService.get('checkin_probability', '0.3'));
  if (Math.random() > probability) {
    console.log('[checkinService] 随机未触发 check-in');
    return null;
  }

  try {
    const systemPrompt = await buildSystemPrompt(userId);
    const recentContext = getContext(userId);
    const messages = [
      {
        role: 'system',
        content:
          systemPrompt +
          '\n\n现在是你主动发起 check-in 的时刻。请自然地关心一下小橘的状态。不要问太宽泛的问题，可以具体一点（基于你从记忆库了解的信息）。保持简洁、温暖。',
      },
      ...recentContext.slice(-6),
    ];

    const reply = await generateReply(messages, userId);
    const sent = await wechatService.sendMessage(userId, reply);

    if (sent) {
      await supabase.from('shadow_checkins').insert({
        message: reply,
        user_response: null,
        checked_at: new Date().toISOString(),
      });
      addMessage(userId, 'assistant', reply);
      console.log('[checkinService] Check-in 发送成功');
      return reply;
    }
  } catch (error) {
    console.error('[checkinService] Check-in 失败:', error.message);
  }

  return null;
}

module.exports = { tryCheckin };

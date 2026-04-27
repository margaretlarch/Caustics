const configService = require('./configService');
const config = require('../config');
const supabase = require('./supabase');
const wechatService = require('./wechatService');
const { generateReply } = require('../llm');
const { getContext, addMessage } = require('./contextCache');
const { buildSystemPrompt } = require('../templates/systemPrompt');

/**
 * 判断当前时间是否在指定的时段内（基于配置时区）
 */
async function isInTimeWindow(startKey, endKey) {
  const startHour = parseInt(await configService.get(startKey, '0'));
  const endHour = parseInt(await configService.get(endKey, '24'));

  const now = new Date();
  // 简化：使用服务器本地时间，实际应基于 timezone 配置
  const currentHour = now.getHours();
  return currentHour >= startHour && currentHour < endHour;
}

/**
 * 检查并可能发起一次主动 check-in
 * 由外部 cron 定期调用（每 5-15 分钟）
 */
async function tryCheckin(userId) {
  if (!userId) {
    console.log('[checkinService] 无用户 ID，跳过 check-in');
    return null;
  }

  // 1. 检查是否在 check-in 时段
  const inCheckinWindow = await isInTimeWindow('checkin_start_hour', 'checkin_end_hour');
  if (!inCheckinWindow) {
    console.log('[checkinService] 当前不在 check-in 时段，跳过');
    return null;
  }

  // 2. 检查是否在安静时段
  const inQuietWindow = await isInTimeWindow('quiet_start_hour', 'quiet_end_hour');
  if (inQuietWindow) {
    console.log('[checkinService] 当前在安静时段，不打扰');
    return null;
  }

  // 3. 随机决定是否发起 check-in（避免每次 cron 都触发）
  const probability = parseFloat(await configService.get('checkin_probability', '0.3'));
  if (Math.random() > probability) {
    console.log('[checkinService] 随机未触发 check-in');
    return null;
  }

  // 4. 构建 check-in 消息上下文，让 LLM 生成自然的开场白
  try {
    const systemPrompt = await buildSystemPrompt(userId);
    const recentContext = getContext(userId);

    const messages = [
      { role: 'system', content: systemPrompt + '\n\n现在是你主动发起 check-in 的时刻。请自然地关心一下小橘的状态。不要问太宽泛的问题如"你在干嘛"，可以具体一点（基于你从记忆库了解的信息）。保持简洁、温暖。' },
      ...recentContext.slice(-6),
    ];

    const reply = await generateReply(messages, userId);

    // 5. 发送消息
    const sent = await wechatService.sendMessage(userId, reply);

    // 6. 记录到 shadow_checkins
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
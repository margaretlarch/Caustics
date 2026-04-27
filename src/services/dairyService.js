const supabase = require('./supabase');
const configService = require('./configService');
const { generateReply } = require('../llm');
const { buildSystemPrompt } = require('../templates/systemPrompt');

/**
 * 生成当日 Daily Log
 * 收集今天的 shadow_logs、shadow_checkins、shadow_schedule 活动
 * 交由 LLM 生成自然语言摘要，存入 shadow_diary
 */
async function generateDailyLog(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 1. 收集今日数据
  const [logsRes, checkinsRes, schedulesRes] = await Promise.all([
    supabase.from('shadow_logs').select('content, category, created_at').gte('created_at', today.toISOString()).lt('created_at', tomorrow.toISOString()),
    supabase.from('shadow_checkins').select('message, user_response, checked_at').gte('checked_at', today.toISOString()).lt('checked_at', tomorrow.toISOString()),
    supabase.from('shadow_schedule').select('title, status, completed_at').gte('created_at', today.toISOString()).lt('created_at', tomorrow.toISOString()),
  ]);

  const activities = {
    logs: logsRes.data || [],
    checkins: checkinsRes.data || [],
    schedules: schedulesRes.data || [],
  };

  const totalEntries = activities.logs.length + activities.checkins.length + activities.schedules.length;
  if (totalEntries === 0) {
    console.log('[diaryService] 今日无活动，跳过日记生成');
    // 仍可写入一条空日记表示"今日无特别"
    await supabase.from('shadow_diary').upsert({
      date: today.toISOString().split('T')[0],
      entries: [],
      summary: '今日风平浪静，小橘没有留下什么痕迹。',
    }, { onConflict: 'date' });
    return;
  }

  // 2. 构建摘要提示词
  try {
    const systemPrompt = await buildSystemPrompt(userId);
    const summaryInput = JSON.stringify(activities, null, 2);

    const messages = [
      { role: 'system', content: systemPrompt + '\n\n你需要根据以下今日活动数据，生成一份简洁的 Daily Log 摘要。用第一人称（"影"的视角），像写手账一样自然叙述。不要逐条罗列，而是捕捉今天的关键片段。' },
      { role: 'user', content: `今天的活动数据：\n${summaryInput}\n\n请生成今日摘要（200字以内）。` },
    ];

    const summary = await generateReply(messages, userId);

    // 3. 写入 shadow_diary
    const entries = [
      ...activities.logs.map(l => ({ time: new Date(l.created_at).toLocaleTimeString('zh-CN'), content: l.content, type: 'log' })),
      ...activities.checkins.map(c => ({ time: new Date(c.checked_at).toLocaleTimeString('zh-CN'), content: c.message, type: 'checkin' })),
      ...activities.schedules.map(s => ({ time: s.completed_at ? new Date(s.completed_at).toLocaleTimeString('zh-CN') : '', content: s.title, type: 'schedule' })),
    ];

    await supabase.from('shadow_diary').upsert({
      date: today.toISOString().split('T')[0],
      entries: entries,
      summary: summary,
    }, { onConflict: 'date' });

    console.log('[diaryService] Daily Log 已生成:', summary.substring(0, 80));
    return summary;
  } catch (error) {
    console.error('[diaryService] 生成 Daily Log 失败:', error.message);
  }
}

/**
 * 检查是否到了生成 Daily Log 的时间
 */
async function shouldGenerateDiary() {
  const logHour = parseInt(await configService.get('daily_log_hour', '22'));
  const now = new Date();
  // 允许在目标小时前后 5 分钟内执行
  return Math.abs(now.getHours() - logHour) <= 0 && now.getMinutes() < 5;
}

module.exports = { generateDailyLog, shouldGenerateDiary };
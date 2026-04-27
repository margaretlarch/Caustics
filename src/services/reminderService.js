const supabase = require('./supabase');
const wechatService = require('./wechatService');
const { generateReply } = require('../llm');
const { buildSystemPrompt } = require('../templates/systemPrompt');
const { addMessage } = require('./contextCache');

/**
 * 扫描 shadow_schedule 中待推送的提醒
 * 并发送给用户
 */
async function processReminders(userId) {
  if (!userId) {
    console.log('[reminderService] 无用户 ID，跳过提醒');
    return;
  }

  const now = new Date().toISOString();

  // 查询 status = 'pending' 且 remind_at <= 当前时间的提醒
  const { data: reminders, error } = await supabase
    .from('shadow_schedule')
    .select('*')
    .eq('status', 'pending')
    .lte('remind_at', now)
    .order('remind_at', { ascending: true })
    .limit(5);

  if (error) {
    console.error('[reminderService] 查询提醒失败:', error.message);
    return;
  }

  if (!reminders || reminders.length === 0) {
    return;
  }

  for (const reminder of reminders) {
    try {
      // 构建推送消息
      const message = `⏰ 提醒：${reminder.title}${reminder.description ? ' — ' + reminder.description : ''}`;
      await wechatService.sendMessage(userId, message);

      // 标记为已完成
      await supabase
        .from('shadow_schedule')
        .update({ status: 'done', completed_at: now })
        .eq('id', reminder.id);

      // 处理重复提醒
      if (reminder.repeat_rule && reminder.repeat_rule !== 'null') {
        await scheduleNextOccurrence(reminder);
      }

      console.log(`[reminderService] 提醒已推送: ${reminder.title}`);
    } catch (err) {
      console.error(`[reminderService] 推送提醒 ${reminder.id} 失败:`, err.message);
    }
  }
}

/**
 * 为重复提醒创建下一次实例
 */
async function scheduleNextOccurrence(reminder) {
  let nextTime = null;
  const rule = reminder.repeat_rule;

  if (rule === 'daily') {
    nextTime = new Date(reminder.remind_at);
    nextTime.setDate(nextTime.getDate() + 1);
  } else if (rule === 'weekly') {
    nextTime = new Date(reminder.remind_at);
    nextTime.setDate(nextTime.getDate() + 7);
  } else {
    // 其他 cron 规则暂不处理
    return;
  }

  await supabase.from('shadow_schedule').insert({
    title: reminder.title,
    description: reminder.description,
    remind_at: nextTime.toISOString(),
    repeat_rule: reminder.repeat_rule,
    status: 'pending',
  });
}

/**
 * 从用户消息中智能提取待办事项（由 LLM 辅助）
 * 可选：在每次对话后判断是否需要新建提醒
 */
async function maybeExtractReminder(userMessage, userId) {
  // 简单关键词匹配作为基础判断
  const reminderKeywords = ['提醒我', '记得', '别忘了', '帮我记', '待办', 'todo'];
  const hasKeyword = reminderKeywords.some(kw => userMessage.includes(kw));

  if (!hasKeyword) return null;

  // 使用 LLM 提取提醒内容（轻量调用）
  try {
    const systemPrompt = await buildSystemPrompt(userId);
    const extractMessages = [
      { role: 'system', content: systemPrompt + '\n\n用户刚才说的话里可能包含一个待办或提醒请求。请提取出：\n1. 标题\n2. 详情描述\n3. 提醒时间（ISO格式，如果提到了时间的话）\n请以JSON格式回复：{"title":"...", "description":"...", "remind_at":"..."}。如果无法提取，回复 {"none": true}。' },
      { role: 'user', content: userMessage },
    ];
    const reply = await generateReply(extractMessages, userId);
    // 尝试解析 JSON
    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.none) return null;

      await supabase.from('shadow_schedule').insert({
        title: parsed.title || '未命名提醒',
        description: parsed.description || '',
        remind_at: parsed.remind_at || new Date(Date.now() + 3600000).toISOString(),
        status: 'pending',
      });
      console.log('[reminderService] 已从消息中提取提醒:', parsed.title);
      return parsed;
    }
  } catch (e) {
    console.warn('[reminderService] 提取提醒失败:', e.message);
  }
  return null;
}

module.exports = { processReminders, maybeExtractReminder };
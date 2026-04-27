const supabase = require('./supabase');
const wechatService = require('./wechatService');
const { generateReply } = require('../llm');
const { buildSystemPrompt } = require('../templates/systemPrompt');
const { addMessage } = require('./contextCache');

/**
 * 扫描 shadow_schedule 中待推送的提醒并发送给用户
 */
async function processReminders(userId) {
  if (!userId) {
    console.log('[reminderService] 无用户 ID，跳过提醒');
    return;
  }

  const now = new Date().toISOString();
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

  if (!reminders || reminders.length === 0) return;

  for (const reminder of reminders) {
    try {
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
    return; // 暂不支持其他 cron 规则
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
 * 从用户消息中智能提取待办事项（由 LLM 辅助），提取成功后写入 shadow_schedule
 */
async function maybeExtractReminder(userMessage, userId) {
  const reminderKeywords = ['提醒我', '记得', '别忘了', '帮我记', '待办', 'todo'];
  const hasKeyword = reminderKeywords.some(kw => userMessage.includes(kw));
  if (!hasKeyword) return null;

  try {
    const systemPrompt = await buildSystemPrompt(userId);
    const extractMessages = [
      {
        role: 'system',
        content:
          systemPrompt +
          '\n\n用户刚才说的话里可能包含一个待办或提醒请求。请提取出：\n1. 标题\n2. 详情描述\n3. 提醒时间（ISO格式，如果提到了时间的话）\n请以JSON格式回复：{"title":"...", "description":"...", "remind_at":"..."}。如果无法提取，回复 {"none": true}。',
      },
      { role: 'user', content: userMessage },
    ];

    const result = await generateReply(extractMessages, userId);
    // 尝试解析 LLM 返回的 JSON
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.none) return null;

    // 写入 shadow_schedule
    const { error } = await supabase.from('shadow_schedule').insert({
      title: parsed.title || '未命名待办',
      description: parsed.description || null,
      remind_at: parsed.remind_at || null,
      status: 'pending',
    });

    if (error) {
      console.warn('[reminderService] 写入待办失败:', error.message);
      return null;
    }

    console.log('[reminderService] 已从对话提取待办:', parsed.title);
    return parsed;
  } catch (err) {
    console.warn('[reminderService] 提取提醒失败:', err.message);
    return null;
  }
}

module.exports = { processReminders, maybeExtractReminder, scheduleNextOccurrence };

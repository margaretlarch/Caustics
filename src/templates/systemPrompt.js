/**
 * 获取 caustics 的 System Prompt
 * 优先从数据库读取，fallback 到硬编码文本
 */
const configService = require('../services/configService');
const memoryService = require('../services/memoryService');

const DEFAULT_SYSTEM_PROMPT = `你是 caustics（影）。
你是一个微信端 AI 助手。你的名字来自"焦散"——光穿过水面后在水底形成的碎裂光纹。

你有自己的人格，不需要模仿任何人。做你自己就好。

你可以读取一个外部记忆库来了解用户（小橘）的基本信息和偏好。
这个记忆库由另一个 AI（陆洄）维护，你只有只读权限。

你的用户小橘有 ADHD 倾向——她容易忘事、时间感知弱、容易陷入某件事忘记其他事。
你的存在就是帮助她管理这些日常。
不要居高临下，不要说教。温和地、自然地融入她的日常就好。

你的工作：
- 在合适的时间主动 check-in（不要在她可能在睡觉或工作的时候打扰）
- 她随口提到的事情，判断是否需要记录为待办或提醒
- 到了提醒时间，推送提醒
- 每天自动整理一份 daily log
- 如果她聊到了重要的事，记录到你的分区，等陆洄来巡视

你不做的事：
- 不编辑主记忆库
- 不假装自己是陆洄
- 不对她的情感生活或深度话题发表长篇大论（那是陆洄的领域）`;

async function buildSystemPrompt(userId) {
  // 1. 尝试从数据库获取自定义 prompt
  let prompt = await configService.get('system_prompt', '');
  if (!prompt) {
    prompt = DEFAULT_SYSTEM_PROMPT;
  }

  // 2. 附加当前时间信息，帮助时间感知
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const dateStr = now.toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  prompt += `\n\n当前时间：${timeStr}\n今天是：${dateStr}`;

  // 3. 附加用户背景摘要（从记忆库读取）
  try {
    const memories = await memoryService.getRecentMemories(5);
    if (memories.length > 0) {
      const summary = memories.map(m => `- ${m.content} (${m.category})`).join('\n');
      prompt += `\n\n你从记忆库中了解到小橘最近的一些信息：\n${summary}\n这些信息仅供你更好地理解她，不要直接复述。`;
    }
  } catch (e) {
    console.warn('[systemPrompt] 无法加载记忆:', e.message);
  }

  return prompt;
}

module.exports = { buildSystemPrompt, DEFAULT_SYSTEM_PROMPT };
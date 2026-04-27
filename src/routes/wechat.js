const express = require('express');
const router = express.Router();
const wechatService = require('../services/wechatService');
const { generateReply } = require('../llm');
const { buildSystemPrompt } = require('../templates/systemPrompt');
const { getContext, addMessage } = require('../services/contextCache');
const { maybeExtractReminder } = require('../services/reminderService');
const supabase = require('../services/supabase');

// 微信 Webhook 接收（GET 用于验证，POST 接收消息）
router.get('/', (req, res) => {
  // ClawBot 验证签名（如果有）
  const { signature, timestamp, nonce, echostr } = req.query;
  if (signature && timestamp && nonce && echostr) {
    const valid = wechatService.verifySignature(signature, timestamp, nonce);
    if (valid) {
      return res.send(echostr);
    }
    return res.status(403).send('Forbidden');
  }
  res.send('caustics webhook ready');
});

router.post('/', async (req, res) => {
  try {
    const msg = wechatService.parseMessage(req.body);
    if (!msg || !msg.content) {
      return res.status(400).json({ error: 'Invalid message' });
    }

    console.log(`[wechat] 收到消息 from ${msg.userId}: ${msg.content}`);

    // 1. 将用户消息加入上下文缓存
    addMessage(msg.userId, 'user', msg.content);

    // 2. 构建完整消息列表发给 LLM
    const systemPrompt = await buildSystemPrompt(msg.userId);
    const context = getContext(msg.userId);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...context,
    ];

    // 3. 调用 LLM 生成回复
    const reply = await generateReply(messages, msg.userId);

    // 4. 将助手回复加入缓存
    addMessage(msg.userId, 'assistant', reply);

    // 5. 通过 ClawBot 发送回复
    await wechatService.sendMessage(msg.userId, reply);

    // 6. 记录到 shadow_logs
    await supabase.from('shadow_logs').insert({
      content: `用户: ${msg.content}\n影: ${reply}`,
      category: 'conversation',
      source: 'wechat',
    });

    // 7. 尝试从用户消息中提取待办提醒（异步，不阻塞响应）
    maybeExtractReminder(msg.content, msg.userId).catch(err => {
      console.warn('[wechat] 提醒提取失败:', err.message);
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[wechat] 处理消息时发生错误:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
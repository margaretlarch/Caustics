const axios = require('axios');
const config = require('../config');
const crypto = require('crypto');

/**
 * 验证微信 Webhook 签名 (ClawBot 协议可能类似)
 * 具体验签逻辑需根据 ClawBot 实际文档调整
 */
function verifySignature(signature, timestamp, nonce) {
  const token = config.clawbot.token;
  const arr = [token, timestamp, nonce].sort();
  const str = arr.join('');
  const hash = crypto.createHash('sha1').update(str).digest('hex');
  return hash === signature;
}

/**
 * 解析微信 Webhook 消息体
 * ClawBot 通常 POST JSON: { from_user, content, message_type, ... }
 */
function parseMessage(body) {
  try {
    const msg = typeof body === 'string' ? JSON.parse(body) : body;
    return {
      userId: msg.from_user || msg.FromUserName || '',
      content: msg.content || msg.Content || msg.text || '',
      messageId: msg.msg_id || msg.MsgId || '',
      timestamp: msg.create_time || Date.now(),
    };
  } catch (e) {
    console.error('[wechatService] 消息解析失败:', e.message);
    return null;
  }
}

/**
 * 主动发送消息给微信用户
 * ClawBot API: POST { to_user, content }
 */
async function sendMessage(userId, content) {
  if (!userId) {
    console.warn('[wechatService] 缺少目标用户 ID，使用默认用户');
    userId = config.clawbot.defaultUserId;
  }
  if (!userId) {
    console.error('[wechatService] 无可用用户 ID，消息发送失败');
    return false;
  }

  try {
    const url = `${config.clawbot.apiUrl}/send`;
    await axios.post(url, {
      to_user: userId,
      content: content,
    }, { timeout: 10000 });
    console.log(`[wechatService] 消息已发送至 ${userId}: ${content.substring(0, 50)}...`);
    return true;
  } catch (error) {
    console.error('[wechatService] 发送消息失败:', error.message);
    return false;
  }
}

module.exports = {
  verifySignature,
  parseMessage,
  sendMessage,
};
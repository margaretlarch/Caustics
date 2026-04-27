/**
 * 内存中保存每个用户的最近 N 条对话
 * 结构：
 *   conversations = {
 *     "user_123": [
 *       { role: "user", content: "..." },
 *       { role: "assistant", content: "..." },
 *       ...
 *     ]
 *   }
 */
const MAX_CONTEXT = 20;
const conversations = new Map();

function getContext(userId) {
  return conversations.get(userId) || [];
}

function addMessage(userId, role, content) {
  if (!conversations.has(userId)) {
    conversations.set(userId, []);
  }
  const ctx = conversations.get(userId);
  ctx.push({ role, content });

  // 保持长度在 MAX_CONTEXT 以内
  while (ctx.length > MAX_CONTEXT) {
    ctx.shift();
  }
}

function clearContext(userId) {
  conversations.delete(userId);
}

module.exports = { getContext, addMessage, clearContext };
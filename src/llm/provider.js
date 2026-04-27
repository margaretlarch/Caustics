/**
 * LLM Provider 抽象基类
 * 所有具体 Provider 必须实现 chat 方法
 */
class LLMProvider {
  /**
   * @param {Array} messages - 统一消息格式 [{ role, content }]
   * @param {Object} modelConfig - { apiBaseUrl, apiKey, modelName, ... }
   * @returns {Promise<string>} - 返回助手的回复文本
   */
  async chat(messages, modelConfig) {
    throw new Error('chat() must be implemented by subclass');
  }
}

module.exports = LLMProvider;
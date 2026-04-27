const LLMProvider = require('./provider');
const axios = require('axios');

class AnthropicProvider extends LLMProvider {
  async chat(messages, modelConfig) {
    const { apiBaseUrl, apiKey, modelName } = modelConfig;

    // 提取 system prompt（约定第一条 role 为 system 的消息）
    const systemMsg = messages.find(m => m.role === 'system');
    const system = systemMsg ? systemMsg.content : '';

    // 转换 messages 格式，去除 system 消息
    const convertedMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    const payload = {
      model: modelName,
      max_tokens: 1024,
      system: system || undefined,
      messages: convertedMessages,
    };

    const response = await axios.post(apiBaseUrl, payload, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      timeout: 30000,
    });

    const data = response.data;
    if (data.content && data.content[0] && data.content[0].text) {
      return data.content[0].text;
    }
    throw new Error('Unexpected Anthropic response structure');
  }
}

module.exports = AnthropicProvider;
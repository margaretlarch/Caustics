const LLMProvider = require('./provider');
const axios = require('axios');

class OpenAIProvider extends LLMProvider {
  async chat(messages, modelConfig) {
    const { apiBaseUrl, apiKey, modelName } = modelConfig;

    // OpenAI 格式原生接受 [{ role, content }]，直接使用
    const convertedMessages = messages.map(m => ({
      role: m.role === 'system' ? 'system' : (m.role === 'assistant' ? 'assistant' : 'user'),
      content: m.content,
    }));

    const payload = {
      model: modelName,
      messages: convertedMessages,
      max_tokens: 1024,
      temperature: 0.7,
    };

    const response = await axios.post(apiBaseUrl, payload, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    const data = response.data;
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }
    throw new Error('Unexpected OpenAI response structure');
  }
}

module.exports = OpenAIProvider;
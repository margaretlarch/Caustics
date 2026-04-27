const AnthropicProvider = require('./anthropic');
const OpenAIProvider = require('./openai');
const configService = require('../services/configService');

const providers = {
  anthropic: new AnthropicProvider(),
  openai: new OpenAIProvider(),
  deepseek: new OpenAIProvider(), // DeepSeek 兼容 OpenAI 格式
};

/**
 * 获取 provider 实例
 */
function getProvider(providerName) {
  const p = providers[providerName];
  if (!p) throw new Error(`Unknown provider: ${providerName}`);
  return p;
}

/**
 * 生成 AI 回复，自动 fallback
 * @param {Array} messages - [{ role, content }]
 * @param {string} userId - 用于日志
 * @returns {Promise<string>}
 */
async function generateReply(messages, userId = '') {
  // 1. 读取主模型配置
  const [providerName, apiBaseUrl, apiKey, modelName] = await Promise.all([
    configService.get('api_provider', 'anthropic'),
    configService.get('api_base_url'),
    configService.get('api_key'),
    configService.get('model_name'),
  ]);

  const primaryConfig = { apiBaseUrl, apiKey, modelName, provider: providerName };

  try {
    console.log(`[LLM] 使用 ${providerName}/${modelName} 生成回复`);
    const provider = getProvider(providerName);
    return await provider.chat(messages, primaryConfig);
  } catch (primaryError) {
    console.error(`[LLM] 主模型调用失败: ${primaryError.message}，尝试 fallback`);

    // 2. 读取 fallback 配置
    const [fbProvider, fbUrl, fbKey, fbModel] = await Promise.all([
      configService.get('fallback_provider', 'deepseek'),
      configService.get('fallback_api_base_url'),
      configService.get('fallback_api_key'),
      configService.get('fallback_model_name'),
    ]);

    const fallbackConfig = { apiBaseUrl: fbUrl, apiKey: fbKey, modelName: fbModel, provider: fbProvider };
    try {
      const fallbackProviderInstance = getProvider(fbProvider);
      return await fallbackProviderInstance.chat(messages, fallbackConfig);
    } catch (fallbackError) {
      console.error(`[LLM] Fallback 也失败了: ${fallbackError.message}`);
      throw new Error('所有模型调用均失败');
    }
  }
}

module.exports = { generateReply, getProvider };
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const configService = require('../services/configService');
const { authMiddleware } = require('../middleware/auth');
const { getProvider } = require('../llm');
const axios = require('axios');

// 获取配置（脱敏）
router.get('/', authMiddleware, async (req, res) => {
  try {
    const keys = [
      'api_provider',
      'api_base_url',
      'api_key',
      'model_name',
      'fallback_provider',
      'fallback_api_base_url',
      'fallback_api_key',
      'fallback_model_name',
      'checkin_start_hour',
      'checkin_end_hour',
      'quiet_start_hour',
      'quiet_end_hour',
      'timezone',
      'system_prompt',
    ];
    const config = {};
    for (const key of keys) {
      let value = await configService.get(key, '');
      if ((key === 'api_key' || key === 'fallback_api_key') && value.length > 4) {
        value = '****' + value.slice(-4);
      }
      config[key] = value;
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 保存配置
router.post('/', authMiddleware, async (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: '无效数据' });
  }

  try {
    const allowedKeys = [
      'api_provider',
      'api_base_url',
      'api_key',
      'model_name',
      'fallback_provider',
      'fallback_api_base_url',
      'fallback_api_key',
      'fallback_model_name',
      'checkin_start_hour',
      'checkin_end_hour',
      'quiet_start_hour',
      'quiet_end_hour',
      'system_prompt',
    ];

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedKeys.includes(key)) continue;
      const { error } = await supabase
        .from('shadow_config')
        .upsert({ key, value: String(value) }, { onConflict: 'key' });
      if (error) throw error;
    }

    await configService.invalidateCache();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 测试连通性
router.post('/test-connection', authMiddleware, async (req, res) => {
  const { provider: provName, api_base_url, api_key, model_name } = req.body;
  if (!provName || !api_key) {
    return res.status(400).json({ error: 'provider 和 api_key 必填' });
  }

  const start = Date.now();
  try {
    const provider = getProvider(provName);
    const messages = [{ role: 'user', content: 'hi' }];
    await provider.chat(messages, {
      apiBaseUrl: api_base_url,
      apiKey: api_key,
      modelName: model_name || 'gpt-3.5-turbo',
    });
    const latency = Date.now() - start;
    res.json({ success: true, latency_ms: latency });
  } catch (err) {
    const latency = Date.now() - start;
    res.json({ success: false, error: err.message, latency_ms: latency });
  }
});

// 获取模型列表（仅对 OpenAI 兼容格式有效）
router.get('/models', authMiddleware, async (req, res) => {
  const providerName =
    req.query.provider || (await configService.get('api_provider', 'anthropic'));
  const baseUrl =
    req.query.base_url || (await configService.get('api_base_url'));
  const apiKey =
    req.query.api_key || (await configService.get('api_key'));

  if (!baseUrl || !apiKey) {
    return res.status(400).json({ error: '缺少必要信息' });
  }

  // 仅 OpenAI / DeepSeek 支持模型列表
  if (providerName !== 'openai' && providerName !== 'deepseek') {
    return res.json({ models: [], note: '仅 OpenAI 兼容格式支持此功能' });
  }

  try {
    const modelsUrl = baseUrl.replace('/chat/completions', '/models');
    const response = await axios.get(modelsUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 10000,
    });
    res.json({ models: response.data.data || [] });
  } catch (err) {
    res.json({ models: [], error: err.message });
  }
});

module.exports = router;

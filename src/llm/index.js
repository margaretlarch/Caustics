// llm/index.js

const Anthropic = require("./providers/anthropic");
const OpenAI = require("./providers/openai");

function getProvider(name) {
  if (name === "anthropic") return new Anthropic();
  return new OpenAI();
}

async function generateReply({ messages, config }) {
  const primary = getProvider(config.provider);

  try {
    return await primary.chat(messages, config);
  } catch (e) {
    console.warn("Primary failed, fallback:", e);

    const fallback = getProvider(config.fallback_provider);

    return await fallback.chat(messages, {
      api_base_url: config.fallback_api_base_url,
      api_key: config.fallback_api_key,
      model_name: config.fallback_model_name,
    });
  }
}

module.exports = { generateReply };

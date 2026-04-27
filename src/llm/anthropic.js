// llm/providers/anthropic.js
const fetch = require("node-fetch");
const LLMProvider = require("./base");

class AnthropicProvider extends LLMProvider {
  async chat(messages, config) {
    const system = messages.find(m => m.role === "system")?.content;

    const filtered = messages.filter(m => m.role !== "system");

    const res = await fetch(config.api_base_url, {
      method: "POST",
      headers: {
        "x-api-key": config.api_key,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: config.model_name,
        system,
        messages: filtered,
        max_tokens: 1024
      })
    });

    const data = await res.json();

    return data?.content?.[0]?.text || "";
  }
}

module.exports = AnthropicProvider;

// llm/providers/openai.js
const fetch = require("node-fetch");
const LLMProvider = require("./base");

class OpenAIProvider extends LLMProvider {
  async chat(messages, config) {
    const res = await fetch(config.api_base_url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model_name,
        messages
      })
    });

    const data = await res.json();

    return data?.choices?.[0]?.message?.content || "";
  }
}

module.exports = OpenAIProvider;

// llm/providers/base.js
class LLMProvider {
  async chat(messages, config) {
    throw new Error("Not implemented");
  }
}

module.exports = LLMProvider;

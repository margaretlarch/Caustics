// services/configService.js

const CACHE_TTL = 30 * 1000; // 30秒

let cache = null;
let cacheTime = 0;

function buildFallback() {
  return {
    provider: process.env.DEFAULT_API_PROVIDER || "anthropic",
    api_base_url: process.env.DEFAULT_API_BASE_URL,
    api_key: process.env.DEFAULT_API_KEY,
    model_name: process.env.DEFAULT_MODEL_NAME,
    fallback_provider: process.env.DEFAULT_FALLBACK_PROVIDER || "openai",
    fallback_api_base_url: process.env.DEFAULT_FALLBACK_API_BASE_URL,
    fallback_api_key: process.env.DEFAULT_FALLBACK_API_KEY,
    fallback_model_name: process.env.DEFAULT_FALLBACK_MODEL_NAME,
  };
}

async function loadFromDB(supabase) {
  const { data, error } = await supabase
    .from("shadow_config")
    .select("key,value");

  if (error) throw error;

  const map = {};
  for (const row of data) {
    map[row.key] = row.value;
  }

  return map;
}

async function getConfig(supabase) {
  const now = Date.now();

  if (cache && now - cacheTime < CACHE_TTL) {
    return cache;
  }

  try {
    const dbConfig = await loadFromDB(supabase);
    const fallback = buildFallback();

    cache = { ...fallback, ...dbConfig };
    cacheTime = now;

    return cache;
  } catch (e) {
    console.error("config load failed, fallback to env:", e);
    return buildFallback();
  }
}

function invalidateCache() {
  cache = null;
}

module.exports = {
  getConfig,
  invalidateCache,
};

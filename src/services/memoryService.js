const supabase = require('./supabase');

/**
 * 获取用户的最近记忆摘要，供 caustics 理解用户背景
 * 只读操作，不使用写语句
 */
async function getRecentMemories(limit = 10) {
  const { data, error } = await supabase
    .from('memories')
    .select('content, category, created_at, importance')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[memoryService] 读取记忆失败:', error.message);
    return [];
  }

  return data;
}

/**
 * 获取用户基本信息（从记忆中提取，或从特定字段）
 * 可根据实际 memories 表结构调整
 */
async function getUserProfile() {
  // 示例：查找 core 分类的最新记忆作为用户画像线索
  const { data } = await supabase
    .from('memories')
    .select('content')
    .eq('category', 'core')
    .order('created_at', { ascending: false })
    .limit(3);

  return data ? data.map(r => r.content).join('；') : '';
}

module.exports = { getRecentMemories, getUserProfile };
const crypto = require('crypto');
const configService = require('../services/configService');

// 简单的内存 token 存储（单人使用，重启清空）
const validTokens = new Set();

/**
 * 验证密码，若匹配则签发一个临时 token
 * @param {string} password 用户输入的明文密码
 * @returns {string|null} 成功返回 token，失败返回 null
 */
async function verifyPasswordAndIssueToken(password) {
  const storedHash = await configService.get('dashboard_password', '');
  if (!storedHash) {
    console.warn('[auth] dashboard_password 未设置，使用默认密码 caustics');
    // 不存在时自动创建默认密码
    const defaultHash = crypto.createHash('sha256').update('caustics').digest('hex');
    // 这里不写回数据库，因为 service_role 可写但需通过 supabase，为避免启动时异步麻烦，可仅在内存中对比
    // 实际应确保数据库里有这个值，建议部署时手动执行 SQL 插入
    // 暂时直接用硬编码 fallback
    return password === 'caustics' ? generateToken() : null;
  }
  const inputHash = crypto.createHash('sha256').update(password).digest('hex');
  if (inputHash === storedHash) {
    return generateToken();
  }
  return null;
}

function generateToken() {
  const token = crypto.randomBytes(32).toString('hex');
  validTokens.add(token);
  // 可选：设置 token 过期时间（不实现，内存重启即失效）
  return token;
}

/**
 * Express 中间件：验证请求头中的 Bearer token
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权' });
  }
  const token = authHeader.split(' ')[1];
  if (!validTokens.has(token)) {
    return res.status(401).json({ error: 'token 无效或已过期' });
  }
  next();
}

module.exports = { verifyPasswordAndIssueToken, authMiddleware };
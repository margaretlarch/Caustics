const express = require('express');
const path = require('path');
const config = require('./config');
const { loadConfigFromDB } = require('./services/configService');

// 路由引入
const wechatRoutes = require('./routes/wechat');
const jobsRoutes = require('./routes/jobs');
const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/configRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');

const app = express();

// ---- 中间件 ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS 支持（允许 Dashboard 从其它域访问 API）
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// 提供 Dashboard 静态文件
app.use(express.static(path.join(__dirname, '..', 'public')));

// 保活自 ping — 让 Render 免费层保持唤醒
const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 每 14 分钟自 ping
const PORT = config.port;

function setupKeepAlive() {
  const keepAlive = () => {
    const url = `http://localhost:${PORT}/health`;
    require('http').get(url, res => {
      if (res.statusCode === 200) console.log('[keepalive] 自 ping 成功');
      else console.warn('[keepalive] 自 ping 返回', res.statusCode);
    }).on('error', e => console.warn(`[keepalive] 自 ping 失败: ${e.message}`));
  };
  setInterval(keepAlive, KEEP_ALIVE_INTERVAL);
}

// 健康检查
app.get('/health', (req, res) => {
  res.json({ name: 'caustics', status: 'online', time: new Date().toISOString() });
});

// 根路径重定向到 Dashboard
app.get('/', (req, res) => {
  res.redirect('/index.html');
});

// API 路由
app.use('/wechat', wechatRoutes);
app.use('/api/run-jobs', jobsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);
app.use('/api/schedule', scheduleRoutes);

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('[caustics] 未捕获错误:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 👇 放在所有 app.get / app.post 下面

const { canRun } = require("./services/jobLock");

app.post("/api/run-jobs", async (req, res) => {

  if (!canRun()) {
    return res.json({ skipped: true });
  }

  console.log("Running scheduled jobs...");

  // 👉 这里先写空也可以
  // 后面你再慢慢加功能
  // await runCheckins();
  // await runReminders();
  // await runDailyLog();

  res.json({ ok: true });
});

// 启动
async function start() {
  try {
    await loadConfigFromDB();
    console.log('[caustics] 配置缓存已初始化');
  } catch (e) {
    console.warn('[caustics] 无法加载数据库配置，将使用环境变量:', e.message);
  }

  app.listen(PORT, () => {
    console.log(`[caustics] 服务已启动，端口: ${PORT}`);
    console.log(`[caustics] Dashboard: http://localhost:${PORT}`);
    setupKeepAlive();
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});

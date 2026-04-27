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

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 提供 Dashboard 静态文件
app.use(express.static(path.join(__dirname, '..', 'public')));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ name: 'caustics', status: 'online', time: new Date().toISOString() });
});

// 如果直接访问根路径，重定向到 Dashboard
app.get('/', (req, res) => {
  res.redirect('/index.html');
});

// API 路由
app.use('/wechat', wechatRoutes);
app.use('/api/run-jobs', jobsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);
app.use('/api/schedule', scheduleRoutes);

// 启动
async function start() {
  try {
    await loadConfigFromDB();
    console.log('[caustics] 配置缓存已初始化');
  } catch (e) {
    console.warn('[caustics] 无法加载数据库配置，将使用环境变量:', e.message);
  }
  app.listen(config.port, () => {
    console.log(`[caustics] 服务已启动，端口: ${config.port}`);
    console.log(`[caustics] Dashboard: http://localhost:${config.port}`);
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
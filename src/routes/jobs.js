const express = require('express');
const router = express.Router();
const config = require('../config');
const checkinService = require('../services/checkinService');
const reminderService = require('../services/reminderService');
const diaryService = require('../services/diaryService');

/**
 * POST /api/run-jobs
 * 由外部 cron 服务 (cron-job.org / UptimeRobot) 定期调用
 * 统一执行：Check-in 检查、提醒扫描、Daily Log 生成
 */
router.post('/', async (req, res) => {
  const userId = config.clawbot.defaultUserId;

  // 并行执行各项任务（各自内部有条件判断）
  const results = await Promise.allSettled([
    checkinService.tryCheckin(userId),
    reminderService.processReminders(userId),
    diaryService.generateDailyLog(userId),
  ]);

  const summary = {
    checkin: results[0].status,
    reminders: results[1].status,
    diary: results[2].status,
    timestamp: new Date().toISOString(),
  };

  console.log('[jobs] 定时任务执行完毕:', summary);
  res.json(summary);
});

// 也支持 GET 请求（UptimeRobot 保活 ping）
router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
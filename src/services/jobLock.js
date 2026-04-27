// services/jobLock.js

let lastRun = 0;

const LOCK_WINDOW = 60 * 1000; // 1分钟

function canRun() {
  const now = Date.now();

  // 如果1分钟内已经运行过 → 拒绝
  if (now - lastRun < LOCK_WINDOW) {
    return false;
  }

  // 记录本次运行时间
  lastRun = now;

  return true;
}

module.exports = {
  canRun
};

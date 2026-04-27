const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

// 更新待办状态
router.patch('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'done' 或 'cancelled'
  if (!['done', 'cancelled', 'pending'].includes(status)) {
    return res.status(400).json({ error: '无效状态' });
  }
  try {
    const updateData = { status, updated_at: new Date().toISOString() };
    if (status === 'done') {
      updateData.completed_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from('shadow_schedule')
      .update(updateData)
      .eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const { verifyPasswordAndIssueToken } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: '密码不能为空' });
  }
  const token = await verifyPasswordAndIssueToken(password);
  if (token) {
    res.json({ token });
  } else {
    res.status(401).json({ error: '密码错误' });
  }
});

module.exports = router;
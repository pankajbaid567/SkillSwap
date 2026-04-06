const { Router } = require('express');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

const router = Router();

// Future user endpoints to be implemented
// These would be protected by verifyAccessToken typically

router.get('/me', verifyAccessToken, (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

module.exports = router;

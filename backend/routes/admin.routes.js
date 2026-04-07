const { Router } = require('express');
const reviewController = require('../controllers/review.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

const router = Router();

// All admin routes require authentication
router.use(verifyAccessToken);

// TODO: Add admin role verification middleware
// For now, any authenticated user can access admin routes
// In production, add: router.use(requireAdminRole);

/**
 * POST /api/admin/reviews/:id/flag
 * Flag a review as inappropriate (admin only).
 * Flagged reviews are excluded from avgRating calculation.
 */
router.post('/reviews/:id/flag', reviewController.flagReview);

module.exports = router;

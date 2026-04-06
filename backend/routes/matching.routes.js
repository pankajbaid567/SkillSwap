const { Router } = require('express');
const { z } = require('zod');
const matchingController = require('../controllers/matching.controller');
const { validateBody } = require('../middlewares/validate.middleware');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

const router = Router();

// All matching routes require authentication
router.use(verifyAccessToken);

/**
 * GET /api/matches
 * Find potential matches for the authenticated user.
 * 
 * Query params:
 *   - strategy: 'skill' | 'location' | 'hybrid' (default: 'skill')
 *   - page: number (default: 1)
 *   - limit: number (default: 20, max: 50)
 */
router.get('/', matchingController.findMatches);

/**
 * GET /api/matches/:id
 * Get details of a specific match.
 */
router.get('/:id', matchingController.getMatchById);

/**
 * POST /api/matches/:id/accept
 * Accept a pending match.
 */
router.post('/:id/accept', matchingController.acceptMatch);

/**
 * POST /api/matches/:id/decline
 * Decline a pending match.
 */
router.post('/:id/decline', matchingController.declineMatch);

module.exports = router;

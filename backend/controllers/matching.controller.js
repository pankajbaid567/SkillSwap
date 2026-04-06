const MatchingService = require('../services/matching.service');
const SkillBasedStrategy = require('../strategies/skill-based.strategy');
const LocationBasedStrategy = require('../strategies/location-based.strategy');
const AIHybridStrategy = require('../strategies/ai-hybrid.strategy');
const { sendSuccess } = require('../utils/response.util');

/**
 * Strategy registry — maps query param values to strategy constructors.
 * Adding a new strategy only requires a new entry here (OCP).
 */
const STRATEGY_MAP = {
  skill: () => new SkillBasedStrategy(),
  location: () => new LocationBasedStrategy(),
  hybrid: () => new AIHybridStrategy(),
};

/**
 * Controller for the matching engine endpoints.
 * Creates a fresh MatchingService per request with the selected strategy.
 */
class MatchingController {
  /**
   * GET /api/matches
   * Query params: ?strategy=skill|location|hybrid&page=1&limit=20
   */
  async findMatches(req, res, next) {
    try {
      const strategyName = req.query.strategy || 'skill';
      const strategyFactory = STRATEGY_MAP[strategyName];

      if (!strategyFactory) {
        const error = new Error(
          `Unknown strategy "${strategyName}". Supported: ${Object.keys(STRATEGY_MAP).join(', ')}`
        );
        error.statusCode = 400;
        error.errorCode = 'INVALID_STRATEGY';
        throw error;
      }

      const service = new MatchingService(strategyFactory());

      const results = await service.findMatches(req.user.id, {
        page: req.query.page,
        limit: req.query.limit,
      });

      return sendSuccess(res, 200, 'Matches retrieved successfully', results);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/matches/:id
   */
  async getMatchById(req, res, next) {
    try {
      const service = new MatchingService();
      const match = await service.getMatchById(req.params.id);

      // Ensure the requesting user is part of the match
      if (match.userId1 !== req.user.id && match.userId2 !== req.user.id) {
        const error = new Error('Forbidden: you are not part of this match');
        error.statusCode = 403;
        error.errorCode = 'FORBIDDEN';
        throw error;
      }

      return sendSuccess(res, 200, 'Match retrieved successfully', match);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/matches/:id/accept
   */
  async acceptMatch(req, res, next) {
    try {
      const service = new MatchingService();
      const result = await service.acceptMatch(req.params.id, req.user.id);
      return sendSuccess(res, 200, 'Match accepted successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/matches/:id/decline
   */
  async declineMatch(req, res, next) {
    try {
      const service = new MatchingService();
      const result = await service.declineMatch(req.params.id, req.user.id);
      return sendSuccess(res, 200, 'Match declined successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MatchingController();

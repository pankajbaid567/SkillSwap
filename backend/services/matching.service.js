const SkillBasedStrategy = require('../strategies/skill-based.strategy');
const defaultMatchRepository = require('../repositories/match.repository');
const defaultUserRepository = require('../repositories/user.repository');
const cache = require('../config/cache.config');

/**
 * Cache key prefix and TTL constants.
 */
const CACHE_PREFIX = 'matches';
const CACHE_TTL_SECONDS = 600; // 10 minutes
const DEFAULT_MATCH_EXPIRY_DAYS = 7;

/**
 * MatchingService — orchestrates the matching engine.
 * 
 * Design:
 *   - Strategy Pattern: #strategy is runtime-swappable via setStrategy()
 *   - OCP: closed for modification, open for extension (new strategies)
 *   - DIP: depends on abstractions (MatchingStrategy interface)
 */
class MatchingService {
  /** @type {import('../strategies/matching.strategy.interface')} */
  #strategy;

  /** @type {import('../repositories/match.repository')} */
  #matchRepository;

  /** @type {import('../repositories/user.repository')} */
  #userRepository;

  /** @type {import('../config/cache.config')} */
  #cache;

  /**
   * @param {import('../strategies/matching.strategy.interface')} [strategy]
   * @param {Object} [matchRepository]
   * @param {Object} [userRepository]
   * @param {Object} [cacheClient]
   */
  constructor(
    strategy = new SkillBasedStrategy(),
    matchRepository = defaultMatchRepository,
    userRepository = defaultUserRepository,
    cacheClient = cache,
  ) {
    this.#strategy = strategy;
    this.#matchRepository = matchRepository;
    this.#userRepository = userRepository;
    this.#cache = cacheClient;
  }

  /**
   * Swap the matching strategy at runtime.
   * Demonstrates the Strategy Pattern — callers can switch algorithms
   * without modifying MatchingService internals.
   * @param {import('../strategies/matching.strategy.interface')} strategy
   */
  setStrategy(strategy) {
    this.#strategy = strategy;
  }

  /**
   * Find and score matches for a user.
   * 
   * Flow:
   *  1. Check cache → return if hit
   *  2. Fetch user with skills + availability
   *  3. Get candidate pool (exclude existing active matches)
   *  4. Apply strategy.findCandidates() to pre-filter
   *  5. Score each candidate with strategy.calculateScore()
   *  6. Rank, paginate, and store match records
   *  7. Cache results for 10 minutes
   * 
   * @param {string} userId
   * @param {Object} [options]
   * @param {number} [options.page=1]
   * @param {number} [options.limit=20]
   * @returns {Promise<{data: Array, total: number, page: number, limit: number, totalPages: number}>}
   */
  async findMatches(userId, options = {}) {
    const page = parseInt(options.page, 10) || 1;
    const limit = parseInt(options.limit, 10) || 20;
    const cacheKey = `${CACHE_PREFIX}:${userId}:${this.#strategy.constructor.name}:p${page}:l${limit}`;

    // 1. Check cache
    const cached = await this.#cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // 2. Fetch the seeking user
    const user = await this.#userRepository.findWithSkillsAndAvailability(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      error.errorCode = 'USER_NOT_FOUND';
      throw error;
    }

    // 3. Get candidate pool (excludes existing matches/swaps)
    const pool = await this.#matchRepository.getActiveCandidatePool(userId);

    // 4. Pre-filter with strategy
    const candidates = this.#strategy.findCandidates(userId, pool);

    // 5. Score each candidate
    const scoredMatches = candidates.map((candidate) => {
      const score = this.#strategy.calculateScore(user, candidate);

      // Determine shared interests (skills both users engage with)
      const sharedInterests = this._findSharedInterests(user, candidate);

      return {
        user: candidate,
        score: parseFloat(score.toFixed(4)),
        sharedInterests,
      };
    });

    // 6. Rank by score
    const ranked = this.#strategy.rankMatches(scoredMatches);

    // Paginate
    const total = ranked.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginated = ranked.slice(start, start + limit);

    // Store match records in DB
    const matchExpiry = new Date();
    matchExpiry.setDate(matchExpiry.getDate() + DEFAULT_MATCH_EXPIRY_DAYS);

    const storedMatches = await Promise.all(
      paginated.map(async (match) => {
        // Avoid duplicating existing matches
        const existing = await this.#matchRepository.findExistingMatch(userId, match.user.id);
        if (existing) {
          return {
            ...match,
            matchId: existing.id,
            isExisting: true,
          };
        }

        const record = await this.#matchRepository.createMatch({
          userId1: userId,
          userId2: match.user.id,
          compatibilityScore: match.score,
          strategyUsed: this.#strategy.constructor.name,
          sharedInterests: match.sharedInterests,
          expiresAt: matchExpiry,
        });

        return {
          ...match,
          matchId: record.id,
          isExisting: false,
        };
      })
    );

    // Build safe response (strip passwords)
    const response = {
      data: storedMatches.map((m) => ({
        matchId: m.matchId,
        compatibilityScore: m.score,
        sharedInterests: m.sharedInterests,
        strategyUsed: this.#strategy.constructor.name,
        candidate: this._sanitizeUser(m.user),
      })),
      total,
      page,
      limit,
      totalPages,
    };

    // 7. Cache for 10 minutes
    await this.#cache.set(cacheKey, JSON.stringify(response), 'EX', CACHE_TTL_SECONDS);

    return response;
  }

  /**
   * Get a specific match by ID.
   * @param {string} matchId
   * @returns {Promise<Object>}
   */
  async getMatchById(matchId) {
    const match = await this.#matchRepository.findById(matchId);
    if (!match) {
      const error = new Error('Match not found');
      error.statusCode = 404;
      error.errorCode = 'MATCH_NOT_FOUND';
      throw error;
    }
    return match;
  }

  /**
   * Accept a match. Updates status and triggers swap creation.
   * @param {string} matchId
   * @param {string} userId - The user accepting the match
   * @returns {Promise<Object>}
   */
  async acceptMatch(matchId, userId) {
    const match = await this._validateMatchAction(matchId, userId);

    const updated = await this.#matchRepository.updateStatus(matchId, 'accepted');

    // Invalidate cached matches for both users
    await this._invalidateCache(match.userId1);
    await this._invalidateCache(match.userId2);

    // TODO: Phase 2 — Trigger SwapService.createSwap(match)
    // const swap = await swapService.createSwap({
    //   user1Id: match.userId1,
    //   user2Id: match.userId2,
    //   matchId: match.id,
    // });

    return updated;
  }

  /**
   * Decline a match. Updates status to 'declined'.
   * @param {string} matchId
   * @param {string} userId - The user declining the match
   * @returns {Promise<Object>}
   */
  async declineMatch(matchId, userId) {
    const match = await this._validateMatchAction(matchId, userId);

    const updated = await this.#matchRepository.updateStatus(matchId, 'declined');

    // Invalidate cached matches for both users
    await this._invalidateCache(match.userId1);
    await this._invalidateCache(match.userId2);

    return updated;
  }

  /**
   * Expire all stale pending matches past their expiresAt.
   * Intended to be called by a scheduled cron job.
   * @returns {Promise<{count: number}>}
   */
  async expireStaleMatches() {
    return await this.#matchRepository.expireStaleMatches();
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  /**
   * Validate that a match exists, is pending, and the user is a participant.
   * @private
   */
  async _validateMatchAction(matchId, userId) {
    const match = await this.#matchRepository.findById(matchId);

    if (!match) {
      const error = new Error('Match not found');
      error.statusCode = 404;
      error.errorCode = 'MATCH_NOT_FOUND';
      throw error;
    }

    if (match.status !== 'pending') {
      const error = new Error(`Match has already been ${match.status}`);
      error.statusCode = 400;
      error.errorCode = 'MATCH_ALREADY_RESOLVED';
      throw error;
    }

    // Ensure the acting user is part of this match
    if (match.userId1 !== userId && match.userId2 !== userId) {
      const error = new Error('Forbidden: you are not part of this match');
      error.statusCode = 403;
      error.errorCode = 'FORBIDDEN';
      throw error;
    }

    return match;
  }

  /**
   * Find overlapping skill interests between two users.
   * @private
   */
  _findSharedInterests(user1, user2) {
    const u1SkillIds = new Set((user1.skills || []).map((s) => s.skillId));
    const shared = (user2.skills || [])
      .filter((s) => u1SkillIds.has(s.skillId))
      .map((s) => ({
        skillId: s.skillId,
        skillName: s.skill?.name || 'Unknown',
      }));

    // Deduplicate by skillId
    const seen = new Set();
    return shared.filter((s) => {
      if (seen.has(s.skillId)) return false;
      seen.add(s.skillId);
      return true;
    });
  }

  /**
   * Remove sensitive data from user objects before returning.
   * @private
   */
  _sanitizeUser(user) {
    const { passwordHash, ...safe } = user;
    return safe;
  }

  /**
   * Invalidate all cached match results for a given user.
   * @private
   */
  async _invalidateCache(userId) {
    await this.#cache.delByPattern(`${CACHE_PREFIX}:${userId}:*`);
  }
}

module.exports = MatchingService;

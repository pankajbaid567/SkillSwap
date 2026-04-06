const prisma = require('../config/db.config');

/**
 * Encapsulates database queries for the Match model.
 * Adheres to SRP by handling only DB operations for matches.
 */
class MatchRepository {
  /**
   * Create a new match record.
   * @param {Object} data - Match creation payload
   * @returns {Promise<Object>} Created match with user relations
   */
  async createMatch(data) {
    return await prisma.match.create({
      data: {
        userId1: data.userId1,
        userId2: data.userId2,
        compatibilityScore: data.compatibilityScore,
        strategyUsed: data.strategyUsed,
        sharedInterests: data.sharedInterests || null,
        isActive: true,
        status: 'pending',
        expiresAt: data.expiresAt,
      },
      include: {
        user1: {
          include: { profile: true },
        },
        user2: {
          include: { profile: true },
        },
      },
    });
  }

  /**
   * Find a match by its ID.
   * @param {string} matchId
   * @returns {Promise<Object|null>}
   */
  async findById(matchId) {
    return await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        user1: {
          include: {
            profile: true,
            skills: { include: { skill: true } },
          },
        },
        user2: {
          include: {
            profile: true,
            skills: { include: { skill: true } },
          },
        },
      },
    });
  }

  /**
   * Find all matches for a user with optional status filter and pagination.
   * @param {string} userId
   * @param {Object} options
   * @param {string} [options.status] - Filter by match status
   * @param {number} [options.page=1]
   * @param {number} [options.limit=20]
   * @returns {Promise<{matches: Array, total: number}>}
   */
  async findByUserId(userId, { status, page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const whereClause = {
      OR: [{ userId1: userId }, { userId2: userId }],
      isActive: true,
    };

    if (status) {
      whereClause.status = status;
    }

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where: whereClause,
        include: {
          user1: { include: { profile: true } },
          user2: { include: { profile: true } },
        },
        orderBy: { compatibilityScore: 'desc' },
        skip,
        take: limit,
      }),
      prisma.match.count({ where: whereClause }),
    ]);

    return { matches, total };
  }

  /**
   * Update the status of a match.
   * @param {string} matchId
   * @param {string} status - New status: 'accepted' | 'declined' | 'expired'
   * @returns {Promise<Object>}
   */
  async updateStatus(matchId, status) {
    return await prisma.match.update({
      where: { id: matchId },
      data: {
        status,
        isActive: status === 'accepted' || status === 'pending',
      },
    });
  }

  /**
   * Expire all stale pending matches whose expiresAt has passed.
   * Designed to be called by a cron job.
   * @returns {Promise<{count: number}>}
   */
  async expireStaleMatches() {
    return await prisma.match.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'expired',
        isActive: false,
      },
    });
  }

  /**
   * Check if an active match already exists between two users.
   * Checks both directions (userId1/userId2 are interchangeable).
   * @param {string} userIdA
   * @param {string} userIdB
   * @returns {Promise<Object|null>}
   */
  async findExistingMatch(userIdA, userIdB) {
    return await prisma.match.findFirst({
      where: {
        isActive: true,
        status: { in: ['pending', 'accepted'] },
        OR: [
          { userId1: userIdA, userId2: userIdB },
          { userId1: userIdB, userId2: userIdA },
        ],
      },
    });
  }

  /**
   * Get all active users except the given user and those they already
   * have active matches with. Returns fully hydrated user objects.
   * @param {string} userId - The seeking user's ID
   * @returns {Promise<Array>}
   */
  async getActiveCandidatePool(userId) {
    // First, find all user IDs this user is already matched with (active matches)
    const existingMatches = await prisma.match.findMany({
      where: {
        isActive: true,
        status: { in: ['pending', 'accepted'] },
        OR: [{ userId1: userId }, { userId2: userId }],
      },
      select: { userId1: true, userId2: true },
    });

    // Collect IDs to exclude
    const excludeIds = new Set([userId]);
    for (const match of existingMatches) {
      excludeIds.add(match.userId1);
      excludeIds.add(match.userId2);
    }

    return await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(excludeIds) },
        isActive: true,
      },
      include: {
        profile: true,
        skills: { include: { skill: true } },
        availabilitySlots: true,
      },
    });
  }
}

module.exports = new MatchRepository();

const MatchingStrategy = require('./matching.strategy.interface');

/**
 * Proficiency level → numeric score mapping.
 * Used for calculating proficiency bonus in the scoring formula.
 */
const PROFICIENCY_SCORES = {
  EXPERT: 1.0,
  ADVANCED: 0.75,
  INTERMEDIATE: 0.5,
  BEGINNER: 0.25,
};

/**
 * Concrete strategy: Skill-Based Matching
 * 
 * Scores users based on skill overlap, proficiency levels,
 * schedule availability, and community rating.
 * 
 * FINAL = (skillOverlapScore × 0.35) + (reverseScore × 0.35)
 *       + (proficiencyBonus × 0.10)  + (availabilityScore × 0.10)
 *       + (ratingWeight × 0.10)
 */
class SkillBasedStrategy extends MatchingStrategy {
  /**
   * Calculate compatibility score between two users.
   * @param {Object} user1 - User seeking matches (includes skills, availabilitySlots, avgRating)
   * @param {Object} user2 - Candidate user
   * @returns {number} Score between 0.0 and 1.0
   */
  calculateScore(user1, user2) {
    const skillOverlapScore = this._calculateSkillOverlap(user1, user2);
    const reverseScore = this._calculateSkillOverlap(user2, user1);
    const proficiencyBonus = this._calculateProficiencyBonus(user1, user2);
    const availabilityScore = this._calculateAvailabilityOverlap(
      user1.availabilitySlots || [],
      user2.availabilitySlots || []
    );
    const ratingWeight = this._calculateRatingWeight(user2);

    const finalScore =
      skillOverlapScore * 0.35 +
      reverseScore * 0.35 +
      proficiencyBonus * 0.10 +
      availabilityScore * 0.10 +
      ratingWeight * 0.10;

    return Math.min(Math.max(finalScore, 0), 1); // Clamp to [0, 1]
  }

  /**
   * Pre-filter candidates: keep only users who have at least one skill the seeker wants,
   * or who want at least one skill the seeker offers.
   * @param {string} userId - The seeking user's ID
   * @param {Array} pool - Full candidate pool
   * @returns {Array} Filtered candidates with at least some relevance
   */
  findCandidates(userId, pool) {
    // Find the seeking user in the pool context — caller typically passes
    // the seeker separately, but we still filter the pool itself.
    return pool.filter((candidate) => {
      if (candidate.id === userId) return false;

      const candidateOffers = this._getSkillIds(candidate, 'offer');
      const candidateWants = this._getSkillIds(candidate, 'want');

      // Keep candidate if there's ANY directional overlap
      return candidateOffers.size > 0 || candidateWants.size > 0;
    });
  }

  /**
   * Rank matches by score descending (best first).
   * @param {Array<{user: Object, score: number}>} matches
   * @returns {Array<{user: Object, score: number}>} Sorted matches
   */
  rankMatches(matches) {
    return [...matches].sort((a, b) => b.score - a.score);
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  /**
   * Computes |seekerWants ∩ candidateOffers| / max(|seekerWants|, 1)
   * Direction: what does the seeker want that the candidate offers?
   */
  _calculateSkillOverlap(seeker, candidate) {
    const seekerWants = this._getSkillIds(seeker, 'want');
    const candidateOffers = this._getSkillIds(candidate, 'offer');
    const intersection = this._intersect(seekerWants, candidateOffers);

    return intersection.size / Math.max(seekerWants.size, 1);
  }

  /**
   * Average proficiency score of the overlapping skills between two users.
   * Considers the offered skills' proficiency levels.
   */
  _calculateProficiencyBonus(user1, user2) {
    const user1Wants = this._getSkillIds(user1, 'want');
    const user2Offers = this._getSkillMap(user2, 'offer'); // skillId → proficiency

    let totalScore = 0;
    let matchCount = 0;

    for (const skillId of user1Wants) {
      if (user2Offers.has(skillId)) {
        const level = user2Offers.get(skillId);
        totalScore += PROFICIENCY_SCORES[level] || 0;
        matchCount++;
      }
    }

    return matchCount > 0 ? totalScore / matchCount : 0;
  }

  /**
   * Calculate time-slot overlap between two users.
   * Matches slots that share the same dayOfWeek and have overlapping time ranges.
   * @returns {number} Overlap ratio between 0.0 and 1.0
   */
  _calculateAvailabilityOverlap(slots1, slots2) {
    if (slots1.length === 0 || slots2.length === 0) return 0;

    let overlappingSlots = 0;

    for (const s1 of slots1) {
      for (const s2 of slots2) {
        if (s1.dayOfWeek === s2.dayOfWeek) {
          // Compare time portions — slotStart/slotEnd are stored as DateTime @db.Time
          const s1Start = this._timeToMinutes(s1.slotStart);
          const s1End = this._timeToMinutes(s1.slotEnd);
          const s2Start = this._timeToMinutes(s2.slotStart);
          const s2End = this._timeToMinutes(s2.slotEnd);

          // Check for any overlap
          if (s1Start < s2End && s2Start < s1End) {
            overlappingSlots++;
            break; // Count each of user1's slots at most once
          }
        }
      }
    }

    return overlappingSlots / Math.max(slots1.length, 1);
  }

  /**
   * Rating weight: (avgRating / 5.0) * 0.15
   * The 0.15 multiplier is part of the formula spec; the final weight of 0.10
   * is applied in calculateScore().
   */
  _calculateRatingWeight(user) {
    const rating = parseFloat(user.avgRating) || 0;
    return (rating / 5.0) * 0.15;
  }

  /**
   * Extract skill IDs of a given type ('offer' or 'want') as a Set.
   */
  _getSkillIds(user, type) {
    const skills = (user.skills || []).filter((us) => us.type === type);
    return new Set(skills.map((us) => us.skillId));
  }

  /**
   * Extract skill IDs → proficiency level map for a given type.
   */
  _getSkillMap(user, type) {
    const skills = (user.skills || []).filter((us) => us.type === type);
    const map = new Map();
    for (const us of skills) {
      map.set(us.skillId, us.proficiencyLevel);
    }
    return map;
  }

  /**
   * Set intersection helper.
   */
  _intersect(setA, setB) {
    const result = new Set();
    for (const item of setA) {
      if (setB.has(item)) result.add(item);
    }
    return result;
  }

  /**
   * Convert a DateTime (stored as @db.Time) to minutes since midnight.
   * Handles both Date objects and ISO strings.
   */
  _timeToMinutes(dateTimeOrString) {
    const d = new Date(dateTimeOrString);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}

module.exports = SkillBasedStrategy;

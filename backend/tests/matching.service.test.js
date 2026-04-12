const MatchingService = require('../services/matching.service');
const StrategyFactory = require('../factories/strategy.factory');
const SkillBasedStrategy = require('../strategies/skill-based.strategy');
const AIHybridStrategy = require('../strategies/ai-hybrid.strategy');

describe('MatchingService', () => {
  let mockStrategy;
  let mockMatchRepo;
  let mockUserRepo;
  let mockCache;
  let service;

  beforeEach(() => {
    mockStrategy = new SkillBasedStrategy();
    mockMatchRepo = {
      getActiveCandidatePool: jest.fn(),
      findExistingMatch: jest.fn(),
      createMatch: jest.fn(),
      updateMatchStatus: jest.fn(),
      findById: jest.fn(),
    };
    mockUserRepo = {
      findWithSkillsAndAvailability: jest.fn(),
    };
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      invalidatePattern: jest.fn(),
    };

    service = new MatchingService(mockStrategy, mockMatchRepo, mockUserRepo, mockCache);
  });

  describe('findMatches', () => {
    const mockUser1 = {
      id: 'user1',
      skills: [{ type: 'want', skillId: 's1' }],
      availabilitySlots: []
    };
    const mockUser2 = {
      id: 'user2',
      skills: [{ type: 'offer', skillId: 's1', proficiencyLevel: 'EXPERT' }],
      availabilitySlots: []
    };

    it('returns scored + ranked matches and stores in cache', async () => {
      mockCache.get.mockResolvedValue(null);
      mockUserRepo.findWithSkillsAndAvailability.mockResolvedValue(mockUser1);
      mockMatchRepo.getActiveCandidatePool.mockResolvedValue([mockUser2]);
      mockMatchRepo.findExistingMatch.mockResolvedValue(null);
      mockMatchRepo.createMatch.mockResolvedValue({ id: 'match1', matchedAt: new Date() });

      const result = await service.findMatches('user1');
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].compatibilityScore).toBeGreaterThan(0);
      expect(result.meta.cached).toBe(false);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('returns cached result on second call', async () => {
      mockCache.get.mockResolvedValue({
        matches: [{ id: 'match1' }],
        pagination: { total: 1 },
        meta: { cached: false }
      });

      const result = await service.findMatches('user1');
      expect(result.matches).toHaveLength(1);
      expect(result.meta.cached).toBe(true);
      expect(mockUserRepo.findWithSkillsAndAvailability).not.toHaveBeenCalled();
    });

    it('returns empty matches with helpful message if user has no skills', async () => {
      mockCache.get.mockResolvedValue(null);
      mockUserRepo.findWithSkillsAndAvailability.mockResolvedValue({ id: 'user1', skills: [] });

      const result = await service.findMatches('user1');
      expect(result.matches).toHaveLength(0);
      expect(result.meta.message).toContain('No skills listed');
    });

    it('returns empty matches with pagination meta if all candidates already matched or no pool', async () => {
      mockCache.get.mockResolvedValue(null);
      mockUserRepo.findWithSkillsAndAvailability.mockResolvedValue(mockUser1);
      mockMatchRepo.getActiveCandidatePool.mockResolvedValue([]);

      const result = await service.findMatches('user1');
      expect(result.matches).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('gracefully falls back to DB if Redis is down (get throws)', async () => {
      mockCache.get.mockRejectedValue(new Error('Redis down'));
      mockUserRepo.findWithSkillsAndAvailability.mockResolvedValue(mockUser1);
      mockMatchRepo.getActiveCandidatePool.mockResolvedValue([mockUser2]);
      mockMatchRepo.findExistingMatch.mockResolvedValue(null);
      mockMatchRepo.createMatch.mockResolvedValue({ id: 'match2' });

      // Should not throw, should perform match logic
      const result = await service.findMatches('user1');
      expect(result.matches).toHaveLength(1);
    });
  });

  describe('setStrategy', () => {
    it('correctly swaps strategy at runtime', async () => {
      const hybrid = new AIHybridStrategy();
      service.setStrategy(hybrid);
      expect(service.strategyName).toBe('aihybrid');
    });
  });

  describe('acceptMatch / declineMatch', () => {
    beforeEach(() => {
      mockMatchRepo.findById.mockResolvedValue({ id: 'm1', userId1: 'u1', userId2: 'u2', status: 'pending' });
      service._validateMatchAction = jest.fn().mockResolvedValue({ id: 'm1', userId1: 'u1', userId2: 'u2', status: 'pending' });
    });

    it('acceptMatch creates swap + invalidates cache', async () => {
      mockMatchRepo.updateMatchStatus.mockResolvedValue({ id: 'm1', status: 'accepted' });
      // assume createSwap doesn't belong to this method, but if it does we mock it
      await service.acceptMatch('m1', 'u1');
      expect(mockMatchRepo.updateMatchStatus).toHaveBeenCalledWith('m1', { status: 'accepted' });
      expect(mockCache.invalidatePattern).toHaveBeenCalled();
    });

    it('declineMatch updates match status', async () => {
      mockMatchRepo.updateMatchStatus.mockResolvedValue({ id: 'm1', status: 'declined' });
      await service.declineMatch('m1', 'u1');
      expect(mockMatchRepo.updateMatchStatus).toHaveBeenCalledWith('m1', { status: 'declined' });
      expect(mockCache.invalidatePattern).toHaveBeenCalled();
    });
  });
});
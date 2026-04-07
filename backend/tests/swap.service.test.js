// Mock the config/db.config.js before any imports
jest.mock('../config/db.config', () => ({}));

// Mock the repositories before importing SwapService
jest.mock('../repositories/swap.repository');
jest.mock('../repositories/match.repository');
jest.mock('../repositories/user.repository');

const SwapService = require('../services/swap.service');
const { SwapStatus, SwapStateError } = require('../utils/swap-state-machine');
const { SwapEvents } = require('../events/swap.events');

describe('SwapService', () => {
  let swapService;
  let mockSwapRepository;
  let mockMatchRepository;
  let mockUserRepository;
  let mockEventEmitter;

  // Mock data
  const mockMatch = {
    id: 'match-123',
    userId1: 'user-1',
    userId2: 'user-2',
    status: 'accepted',
  };

  const mockInitiator = {
    id: 'user-1',
    email: 'initiator@test.com',
    skills: [
      { id: 'skill-1', skillId: 's1', type: 'offer' },
      { id: 'skill-2', skillId: 's2', type: 'want' },
    ],
    profile: { displayName: 'Alice' },
  };

  const mockReceiver = {
    id: 'user-2',
    email: 'receiver@test.com',
    skills: [
      { id: 'skill-3', skillId: 's1', type: 'want' },
      { id: 'skill-4', skillId: 's2', type: 'offer' },
    ],
    profile: { displayName: 'Bob' },
  };

  const createMockSwap = (overrides = {}) => ({
    id: 'swap-123',
    matchId: 'match-123',
    initiatorId: 'user-1',
    receiverId: 'user-2',
    offeredSkillId: 'skill-1',
    requestedSkillId: 'skill-4',
    status: SwapStatus.PENDING,
    terms: 'Test terms',
    initiatorConfirmed: false,
    receiverConfirmed: false,
    initiator: mockInitiator,
    receiver: mockReceiver,
    ...overrides,
  });

  beforeEach(() => {
    // Reset mocks
    mockSwapRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      findActiveSwaps: jest.fn(),
      findSwapHistory: jest.fn(),
      findExpiredPendingSwaps: jest.fn(),
      expireSwaps: jest.fn(),
      findExistingSwapForMatch: jest.fn(),
      getSwapStats: jest.fn(),
      incrementUserSwapCounts: jest.fn(),
    };

    mockMatchRepository = {
      findById: jest.fn(),
    };

    mockUserRepository = {
      findById: jest.fn(),
    };

    mockEventEmitter = {
      emitSwapCreated: jest.fn(),
      emitSwapAccepted: jest.fn(),
      emitSwapDeclined: jest.fn(),
      emitSwapInProgress: jest.fn(),
      emitSwapCompleted: jest.fn(),
      emitSwapCancelled: jest.fn(),
      emitSwapExpired: jest.fn(),
    };

    swapService = new SwapService(
      mockSwapRepository,
      mockMatchRepository,
      mockUserRepository,
      mockEventEmitter
    );
  });

  describe('createSwap', () => {
    beforeEach(() => {
      mockMatchRepository.findById.mockResolvedValue(mockMatch);
      mockSwapRepository.findExistingSwapForMatch.mockResolvedValue(null);
      mockUserRepository.findById.mockImplementation((id) => {
        if (id === mockInitiator.id) return Promise.resolve(mockInitiator);
        if (id === mockReceiver.id) return Promise.resolve(mockReceiver);
        return Promise.resolve(null);
      });
    });

    it('should create a swap successfully', async () => {
      const mockCreatedSwap = createMockSwap();
      mockSwapRepository.create.mockResolvedValue(mockCreatedSwap);

      const result = await swapService.createSwap('match-123', 'user-1', {
        offeredSkillId: 'skill-1',
        requestedSkillId: 'skill-4',
        terms: 'Test terms',
      });

      expect(result).toBe(mockCreatedSwap);
      expect(mockSwapRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          matchId: 'match-123',
          initiatorId: 'user-1',
          receiverId: 'user-2',
          offeredSkillId: 'skill-1',
          requestedSkillId: 'skill-4',
          terms: 'Test terms',
        })
      );
    });

    it('should emit SWAP_CREATED event', async () => {
      const mockCreatedSwap = createMockSwap();
      mockSwapRepository.create.mockResolvedValue(mockCreatedSwap);

      await swapService.createSwap('match-123', 'user-1', {
        offeredSkillId: 'skill-1',
        requestedSkillId: 'skill-4',
      });

      expect(mockEventEmitter.emitSwapCreated).toHaveBeenCalledWith(
        mockCreatedSwap,
        mockCreatedSwap.initiator,
        mockCreatedSwap.receiver
      );
    });

    it('should set expiresAt to 48 hours from now', async () => {
      const mockCreatedSwap = createMockSwap();
      mockSwapRepository.create.mockResolvedValue(mockCreatedSwap);

      const before = Date.now();
      await swapService.createSwap('match-123', 'user-1', {
        offeredSkillId: 'skill-1',
        requestedSkillId: 'skill-4',
      });
      const after = Date.now();

      const createCall = mockSwapRepository.create.mock.calls[0][0];
      const expiresAt = createCall.expiresAt.getTime();
      const fortyEightHours = 48 * 60 * 60 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(before + fortyEightHours);
      expect(expiresAt).toBeLessThanOrEqual(after + fortyEightHours);
    });

    it('should throw if match not found', async () => {
      mockMatchRepository.findById.mockResolvedValue(null);

      await expect(
        swapService.createSwap('match-123', 'user-1', {
          offeredSkillId: 'skill-1',
          requestedSkillId: 'skill-4',
        })
      ).rejects.toThrow('Match not found');
    });

    it('should throw if user is not a participant in the match', async () => {
      await expect(
        swapService.createSwap('match-123', 'user-3', {
          offeredSkillId: 'skill-1',
          requestedSkillId: 'skill-4',
        })
      ).rejects.toThrow('User is not a participant in this match');
    });

    it('should throw if active swap already exists for match', async () => {
      mockSwapRepository.findExistingSwapForMatch.mockResolvedValue(createMockSwap());

      await expect(
        swapService.createSwap('match-123', 'user-1', {
          offeredSkillId: 'skill-1',
          requestedSkillId: 'skill-4',
        })
      ).rejects.toThrow('An active swap already exists for this match');
    });
  });

  describe('acceptSwap', () => {
    it('should accept a pending swap', async () => {
      const pendingSwap = createMockSwap({ status: SwapStatus.PENDING });
      const acceptedSwap = createMockSwap({ status: SwapStatus.ACCEPTED });
      
      mockSwapRepository.findById.mockResolvedValue(pendingSwap);
      mockSwapRepository.update.mockResolvedValue(acceptedSwap);
      mockSwapRepository.incrementUserSwapCounts.mockResolvedValue();

      const result = await swapService.acceptSwap('swap-123', 'user-2');

      expect(result.status).toBe(SwapStatus.ACCEPTED);
      expect(mockSwapRepository.update).toHaveBeenCalledWith('swap-123', {
        status: SwapStatus.ACCEPTED,
      });
    });

    it('should increment totalSwaps for both users', async () => {
      const pendingSwap = createMockSwap({ status: SwapStatus.PENDING });
      const acceptedSwap = createMockSwap({ status: SwapStatus.ACCEPTED });
      
      mockSwapRepository.findById.mockResolvedValue(pendingSwap);
      mockSwapRepository.update.mockResolvedValue(acceptedSwap);
      mockSwapRepository.incrementUserSwapCounts.mockResolvedValue();

      await swapService.acceptSwap('swap-123', 'user-2');

      expect(mockSwapRepository.incrementUserSwapCounts).toHaveBeenCalledWith(
        'user-1',
        'user-2'
      );
    });

    it('should emit SWAP_ACCEPTED event', async () => {
      const pendingSwap = createMockSwap({ status: SwapStatus.PENDING });
      const acceptedSwap = createMockSwap({ status: SwapStatus.ACCEPTED });
      
      mockSwapRepository.findById.mockResolvedValue(pendingSwap);
      mockSwapRepository.update.mockResolvedValue(acceptedSwap);
      mockSwapRepository.incrementUserSwapCounts.mockResolvedValue();

      await swapService.acceptSwap('swap-123', 'user-2');

      expect(mockEventEmitter.emitSwapAccepted).toHaveBeenCalled();
    });

    it('should throw if user is not the receiver', async () => {
      const pendingSwap = createMockSwap({ status: SwapStatus.PENDING });
      mockSwapRepository.findById.mockResolvedValue(pendingSwap);

      await expect(
        swapService.acceptSwap('swap-123', 'user-1')
      ).rejects.toThrow('Only the receiver can accept this swap');
    });

    it('should throw SwapStateError for invalid transition', async () => {
      const acceptedSwap = createMockSwap({ status: SwapStatus.ACCEPTED });
      mockSwapRepository.findById.mockResolvedValue(acceptedSwap);

      await expect(
        swapService.acceptSwap('swap-123', 'user-2')
      ).rejects.toThrow(SwapStateError);
    });
  });

  describe('startSwap', () => {
    it('should start an accepted swap', async () => {
      const acceptedSwap = createMockSwap({ status: SwapStatus.ACCEPTED });
      const inProgressSwap = createMockSwap({ status: SwapStatus.IN_PROGRESS });
      
      mockSwapRepository.findById.mockResolvedValue(acceptedSwap);
      mockSwapRepository.update.mockResolvedValue(inProgressSwap);

      const result = await swapService.startSwap('swap-123', 'user-1');

      expect(result.status).toBe(SwapStatus.IN_PROGRESS);
      expect(mockEventEmitter.emitSwapInProgress).toHaveBeenCalled();
    });

    it('should allow either participant to start', async () => {
      const acceptedSwap = createMockSwap({ status: SwapStatus.ACCEPTED });
      const inProgressSwap = createMockSwap({ status: SwapStatus.IN_PROGRESS });
      
      mockSwapRepository.findById.mockResolvedValue(acceptedSwap);
      mockSwapRepository.update.mockResolvedValue(inProgressSwap);

      // Both users should be able to start
      await expect(swapService.startSwap('swap-123', 'user-1')).resolves.toBeDefined();
      await expect(swapService.startSwap('swap-123', 'user-2')).resolves.toBeDefined();
    });

    it('should throw SwapStateError when trying to start a pending swap', async () => {
      const pendingSwap = createMockSwap({ status: SwapStatus.PENDING });
      mockSwapRepository.findById.mockResolvedValue(pendingSwap);

      await expect(
        swapService.startSwap('swap-123', 'user-1')
      ).rejects.toThrow(SwapStateError);
    });
  });

  describe('completeSwap', () => {
    it('should mark initiator confirmation', async () => {
      const inProgressSwap = createMockSwap({ 
        status: SwapStatus.IN_PROGRESS,
        initiatorConfirmed: false,
        receiverConfirmed: false,
      });
      const updatedSwap = createMockSwap({
        status: SwapStatus.IN_PROGRESS,
        initiatorConfirmed: true,
        receiverConfirmed: false,
      });
      
      mockSwapRepository.findById.mockResolvedValue(inProgressSwap);
      mockSwapRepository.update.mockResolvedValue(updatedSwap);

      const result = await swapService.completeSwap('swap-123', 'user-1');

      expect(mockSwapRepository.update).toHaveBeenCalledWith('swap-123', {
        initiatorConfirmed: true,
      });
      expect(mockEventEmitter.emitSwapCompleted).not.toHaveBeenCalled();
    });

    it('should complete swap when both confirm', async () => {
      const inProgressSwap = createMockSwap({ 
        status: SwapStatus.IN_PROGRESS,
        initiatorConfirmed: true,  // Initiator already confirmed
        receiverConfirmed: false,
      });
      const completedSwap = createMockSwap({
        status: SwapStatus.COMPLETED,
        initiatorConfirmed: true,
        receiverConfirmed: true,
        completedAt: new Date(),
      });
      
      mockSwapRepository.findById.mockResolvedValue(inProgressSwap);
      mockSwapRepository.update.mockResolvedValue(completedSwap);

      const result = await swapService.completeSwap('swap-123', 'user-2');

      expect(mockSwapRepository.update).toHaveBeenCalledWith('swap-123', 
        expect.objectContaining({
          receiverConfirmed: true,
          status: SwapStatus.COMPLETED,
          completedAt: expect.any(Date),
        })
      );
      expect(mockEventEmitter.emitSwapCompleted).toHaveBeenCalled();
    });

    it('should throw SwapStateError if swap is not in progress', async () => {
      const acceptedSwap = createMockSwap({ status: SwapStatus.ACCEPTED });
      mockSwapRepository.findById.mockResolvedValue(acceptedSwap);

      await expect(
        swapService.completeSwap('swap-123', 'user-1')
      ).rejects.toThrow(SwapStateError);
    });
  });

  describe('cancelSwap', () => {
    it('should cancel a pending swap', async () => {
      const pendingSwap = createMockSwap({ status: SwapStatus.PENDING });
      const cancelledSwap = createMockSwap({ 
        status: SwapStatus.CANCELLED,
        cancelReason: 'Changed my mind',
      });
      
      mockSwapRepository.findById.mockResolvedValue(pendingSwap);
      mockSwapRepository.update.mockResolvedValue(cancelledSwap);

      const result = await swapService.cancelSwap('swap-123', 'user-1', 'Changed my mind');

      expect(result.status).toBe(SwapStatus.CANCELLED);
      expect(mockEventEmitter.emitSwapCancelled).toHaveBeenCalled();
    });

    it('should cancel an accepted swap', async () => {
      const acceptedSwap = createMockSwap({ status: SwapStatus.ACCEPTED });
      const cancelledSwap = createMockSwap({ status: SwapStatus.CANCELLED });
      
      mockSwapRepository.findById.mockResolvedValue(acceptedSwap);
      mockSwapRepository.update.mockResolvedValue(cancelledSwap);

      await expect(
        swapService.cancelSwap('swap-123', 'user-2', 'No longer available')
      ).resolves.toBeDefined();
    });

    it('should throw SwapStateError when cancelling an in-progress swap', async () => {
      const inProgressSwap = createMockSwap({ status: SwapStatus.IN_PROGRESS });
      mockSwapRepository.findById.mockResolvedValue(inProgressSwap);

      await expect(
        swapService.cancelSwap('swap-123', 'user-1', 'Emergency')
      ).rejects.toThrow(SwapStateError);
    });

    it('should throw SwapStateError when cancelling a completed swap', async () => {
      const completedSwap = createMockSwap({ status: SwapStatus.COMPLETED });
      mockSwapRepository.findById.mockResolvedValue(completedSwap);

      await expect(
        swapService.cancelSwap('swap-123', 'user-1', 'Too late')
      ).rejects.toThrow(SwapStateError);
    });
  });

  describe('declineSwap', () => {
    it('should decline a pending swap', async () => {
      const pendingSwap = createMockSwap({ status: SwapStatus.PENDING });
      const cancelledSwap = createMockSwap({ 
        status: SwapStatus.CANCELLED,
        cancelReason: 'Not interested',
      });
      
      mockSwapRepository.findById.mockResolvedValue(pendingSwap);
      mockSwapRepository.update.mockResolvedValue(cancelledSwap);

      const result = await swapService.declineSwap('swap-123', 'user-2', 'Not interested');

      expect(result.status).toBe(SwapStatus.CANCELLED);
      expect(mockEventEmitter.emitSwapDeclined).toHaveBeenCalled();
    });

    it('should throw if non-receiver tries to decline', async () => {
      const pendingSwap = createMockSwap({ status: SwapStatus.PENDING });
      mockSwapRepository.findById.mockResolvedValue(pendingSwap);

      await expect(
        swapService.declineSwap('swap-123', 'user-1', 'Not interested')
      ).rejects.toThrow('Only the receiver can decline this swap');
    });
  });

  describe('expirePendingSwaps', () => {
    it('should expire pending swaps past expiresAt', async () => {
      const expiredSwaps = [
        createMockSwap({ id: 'swap-1' }),
        createMockSwap({ id: 'swap-2' }),
      ];
      
      mockSwapRepository.findExpiredPendingSwaps.mockResolvedValue(expiredSwaps);
      mockSwapRepository.expireSwaps.mockResolvedValue({ count: 2 });

      const count = await swapService.expirePendingSwaps();

      expect(count).toBe(2);
      expect(mockSwapRepository.expireSwaps).toHaveBeenCalledWith(['swap-1', 'swap-2']);
      expect(mockEventEmitter.emitSwapExpired).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no expired swaps found', async () => {
      mockSwapRepository.findExpiredPendingSwaps.mockResolvedValue([]);

      const count = await swapService.expirePendingSwaps();

      expect(count).toBe(0);
      expect(mockSwapRepository.expireSwaps).not.toHaveBeenCalled();
      expect(mockEventEmitter.emitSwapExpired).not.toHaveBeenCalled();
    });
  });

  describe('getSwapById', () => {
    it('should return swap if user is a participant', async () => {
      const swap = createMockSwap();
      mockSwapRepository.findById.mockResolvedValue(swap);

      const result = await swapService.getSwapById('swap-123', 'user-1');
      expect(result).toBe(swap);
    });

    it('should throw if user is not a participant', async () => {
      const swap = createMockSwap();
      mockSwapRepository.findById.mockResolvedValue(swap);

      await expect(
        swapService.getSwapById('swap-123', 'user-3')
      ).rejects.toThrow('User is not a participant in this swap');
    });

    it('should throw if swap not found', async () => {
      mockSwapRepository.findById.mockResolvedValue(null);

      await expect(
        swapService.getSwapById('swap-123', 'user-1')
      ).rejects.toThrow('Swap not found');
    });
  });

  describe('getSwapHistory', () => {
    it('should return paginated swap history', async () => {
      const mockHistory = {
        data: [createMockSwap()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockSwapRepository.findSwapHistory.mockResolvedValue(mockHistory);

      const result = await swapService.getSwapHistory('user-1', { page: 1, limit: 20 });

      expect(result).toBe(mockHistory);
      expect(mockSwapRepository.findSwapHistory).toHaveBeenCalledWith('user-1', { page: 1, limit: 20 });
    });
  });

  describe('getActiveSwaps', () => {
    it('should return only active swaps', async () => {
      const activeSwaps = [
        createMockSwap({ status: SwapStatus.ACCEPTED }),
        createMockSwap({ status: SwapStatus.IN_PROGRESS }),
      ];
      mockSwapRepository.findActiveSwaps.mockResolvedValue(activeSwaps);

      const result = await swapService.getActiveSwaps('user-1');

      expect(result).toBe(activeSwaps);
      expect(mockSwapRepository.findActiveSwaps).toHaveBeenCalledWith('user-1');
    });
  });
});

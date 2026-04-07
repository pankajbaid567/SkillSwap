// Mock the config/db.config.js before any imports
jest.mock('../config/db.config', () => ({}));

jest.mock('../repositories/session.repository');
jest.mock('../repositories/swap.repository');
jest.mock('../repositories/user.repository');

const SessionService = require('../services/session.service');
const { SwapStatus, SwapStateError } = require('../utils/swap-state-machine');

describe('SessionService', () => {
  let sessionService;
  let mockSessionRepository;
  let mockSwapRepository;
  let mockUserRepository;
  let mockEventEmitter;

  const mockInitiator = {
    id: 'user-1',
    email: 'initiator@test.com',
    profile: { displayName: 'Alice' },
    availabilitySlots: [],
    skills: [],
  };

  const mockReceiver = {
    id: 'user-2',
    email: 'receiver@test.com',
    profile: { displayName: 'Bob' },
    availabilitySlots: [],
    skills: [],
  };

  const createMockSwap = (overrides = {}) => ({
    id: 'swap-123',
    matchId: 'match-123',
    initiatorId: 'user-1',
    receiverId: 'user-2',
    status: SwapStatus.ACCEPTED,
    initiator: mockInitiator,
    receiver: mockReceiver,
    ...overrides,
  });

  const createMockSession = (overrides = {}) => ({
    id: 'session-123',
    swapId: 'swap-123',
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    durationMins: 60,
    status: 'SCHEDULED',
    meetingUrl: 'https://meet.skillswap.ai/swap-123',
    rescheduledCount: 0,
    swap: createMockSwap(),
    ...overrides,
  });

  beforeEach(() => {
    mockSessionRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findBySwapId: jest.fn(),
      update: jest.fn(),
      findUpcomingSessions: jest.fn(),
      findConflictingSessions: jest.fn(),
      createCompletionConfirmation: jest.fn(),
      countCompletionConfirmations: jest.fn(),
    };

    mockSwapRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    mockUserRepository = {
      findWithSkillsAndAvailability: jest.fn(),
    };

    mockEventEmitter = {
      emitSessionScheduled: jest.fn(),
      emitSessionRescheduled: jest.fn(),
      emitSessionCompleted: jest.fn(),
    };

    sessionService = new SessionService(
      mockSessionRepository,
      mockSwapRepository,
      mockUserRepository,
      mockEventEmitter
    );
  });

  describe('scheduleSession', () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    beforeEach(() => {
      mockSwapRepository.findById.mockResolvedValue(createMockSwap());
      mockSessionRepository.findBySwapId.mockResolvedValue(null);
      mockSessionRepository.findConflictingSessions.mockResolvedValue([]);
      mockUserRepository.findWithSkillsAndAvailability.mockResolvedValue({
        ...mockInitiator,
        availabilitySlots: [],
      });
    });

    it('should create a session for an accepted swap', async () => {
      const mockSession = createMockSession();
      mockSessionRepository.create.mockResolvedValue(mockSession);
      mockSwapRepository.update.mockResolvedValue(createMockSwap({ status: SwapStatus.IN_PROGRESS }));

      const result = await sessionService.scheduleSession('swap-123', 'user-1', {
        scheduledAt: futureDate,
        durationMins: 60,
      });

      expect(result).toBe(mockSession);
      expect(mockSessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          swapId: 'swap-123',
          durationMins: 60,
          meetingUrl: 'https://meet.skillswap.ai/swap-123',
        })
      );
    });

    it('should transition swap to IN_PROGRESS', async () => {
      const mockSession = createMockSession();
      mockSessionRepository.create.mockResolvedValue(mockSession);
      mockSwapRepository.update.mockResolvedValue(createMockSwap({ status: SwapStatus.IN_PROGRESS }));

      await sessionService.scheduleSession('swap-123', 'user-1', {
        scheduledAt: futureDate,
      });

      expect(mockSwapRepository.update).toHaveBeenCalledWith('swap-123', expect.objectContaining({
        status: SwapStatus.IN_PROGRESS,
      }));
    });

    it('should emit SESSION_SCHEDULED event', async () => {
      const mockSession = createMockSession();
      mockSessionRepository.create.mockResolvedValue(mockSession);
      mockSwapRepository.update.mockResolvedValue(createMockSwap({ status: SwapStatus.IN_PROGRESS }));

      await sessionService.scheduleSession('swap-123', 'user-1', {
        scheduledAt: futureDate,
      });

      expect(mockEventEmitter.emitSessionScheduled).toHaveBeenCalled();
    });

    it('should throw if swap is not in ACCEPTED state', async () => {
      mockSwapRepository.findById.mockResolvedValue(createMockSwap({ status: SwapStatus.PENDING }));

      await expect(
        sessionService.scheduleSession('swap-123', 'user-1', { scheduledAt: futureDate })
      ).rejects.toThrow('Swap must be in ACCEPTED state');
    });

    it('should throw if scheduled time is in the past', async () => {
      await expect(
        sessionService.scheduleSession('swap-123', 'user-1', {
          scheduledAt: new Date(Date.now() - 1000),
        })
      ).rejects.toThrow('Scheduled time must be in the future');
    });

    it('should throw if session already exists for swap', async () => {
      mockSessionRepository.findBySwapId.mockResolvedValue(createMockSession());

      await expect(
        sessionService.scheduleSession('swap-123', 'user-1', { scheduledAt: futureDate })
      ).rejects.toThrow('A session already exists for this swap');
    });

    it('should throw on time conflict', async () => {
      mockSessionRepository.findConflictingSessions.mockResolvedValue([createMockSession()]);

      await expect(
        sessionService.scheduleSession('swap-123', 'user-1', { scheduledAt: futureDate })
      ).rejects.toThrow('Time conflict');
    });
  });

  describe('rescheduleSession', () => {
    const newTime = new Date(Date.now() + 48 * 60 * 60 * 1000);

    it('should reschedule a session', async () => {
      const session = createMockSession();
      const updatedSession = createMockSession({ scheduledAt: newTime, rescheduledCount: 1 });

      mockSessionRepository.findById.mockResolvedValue(session);
      mockSessionRepository.findConflictingSessions.mockResolvedValue([]);
      mockSessionRepository.update.mockResolvedValue(updatedSession);
      mockSwapRepository.update.mockResolvedValue({});

      const result = await sessionService.rescheduleSession('session-123', 'user-1', newTime);

      expect(result.rescheduledCount).toBe(1);
      expect(mockEventEmitter.emitSessionRescheduled).toHaveBeenCalled();
    });

    it('should throw after max reschedules (2)', async () => {
      const session = createMockSession({ rescheduledCount: 2 });
      mockSessionRepository.findById.mockResolvedValue(session);

      await expect(
        sessionService.rescheduleSession('session-123', 'user-1', newTime)
      ).rejects.toThrow('Maximum reschedules');
    });

    it('should throw if session is not SCHEDULED', async () => {
      const session = createMockSession({ status: 'COMPLETED' });
      mockSessionRepository.findById.mockResolvedValue(session);

      await expect(
        sessionService.rescheduleSession('session-123', 'user-1', newTime)
      ).rejects.toThrow('Only SCHEDULED sessions');
    });
  });

  describe('completeSession', () => {
    it('should record confirmation and wait for other party', async () => {
      const session = createMockSession();
      mockSessionRepository.findById.mockResolvedValue(session);
      mockSessionRepository.createCompletionConfirmation.mockResolvedValue({});
      mockSessionRepository.countCompletionConfirmations.mockResolvedValue(1);

      const result = await sessionService.completeSession('session-123', 'user-1');

      expect(result.bothConfirmed).toBe(false);
      expect(result.confirmCount).toBe(1);
    });

    it('should complete when both confirm', async () => {
      const session = createMockSession();
      const swap = createMockSwap({ status: SwapStatus.IN_PROGRESS });

      mockSessionRepository.findById.mockResolvedValue(session);
      mockSessionRepository.createCompletionConfirmation.mockResolvedValue({});
      mockSessionRepository.countCompletionConfirmations.mockResolvedValue(2);
      mockSwapRepository.findById.mockResolvedValue(swap);
      mockSwapRepository.update.mockResolvedValue({});
      mockSessionRepository.update.mockResolvedValue(createMockSession({ status: 'COMPLETED' }));

      const result = await sessionService.completeSession('session-123', 'user-2');

      expect(result.bothConfirmed).toBe(true);
      expect(mockSwapRepository.update).toHaveBeenCalledWith('swap-123', expect.objectContaining({
        status: SwapStatus.COMPLETED,
      }));
      expect(mockEventEmitter.emitSessionCompleted).toHaveBeenCalled();
    });
  });

  describe('getUpcomingSessions', () => {
    it('should return upcoming sessions', async () => {
      const sessions = [createMockSession()];
      mockSessionRepository.findUpcomingSessions.mockResolvedValue(sessions);

      const result = await sessionService.getUpcomingSessions('user-1');

      expect(result).toBe(sessions);
      expect(mockSessionRepository.findUpcomingSessions).toHaveBeenCalledWith('user-1', 7);
    });
  });

  describe('getSessionById', () => {
    it('should return session by ID', async () => {
      const session = createMockSession();
      mockSessionRepository.findById.mockResolvedValue(session);

      const result = await sessionService.getSessionById('session-123');

      expect(result).toBe(session);
    });

    it('should throw if session not found', async () => {
      mockSessionRepository.findById.mockResolvedValue(null);

      await expect(
        sessionService.getSessionById('session-999')
      ).rejects.toThrow('Session not found');
    });
  });
});

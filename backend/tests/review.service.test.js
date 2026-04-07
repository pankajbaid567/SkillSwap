// Mock the config/db.config.js before any imports
jest.mock('../config/db.config', () => ({}));

jest.mock('../repositories/review.repository');
jest.mock('../repositories/swap.repository');
jest.mock('../repositories/user.repository');

const ReviewService = require('../services/review.service');
const { SwapStatus } = require('../utils/swap-state-machine');

describe('ReviewService', () => {
  let reviewService;
  let mockReviewRepository;
  let mockSwapRepository;
  let mockUserRepository;
  let mockEventEmitter;

  const mockInitiator = {
    id: 'user-1',
    email: 'alice@test.com',
    profile: { displayName: 'Alice' },
  };

  const mockReceiver = {
    id: 'user-2',
    email: 'bob@test.com',
    profile: { displayName: 'Bob' },
  };

  const createMockSwap = (overrides = {}) => ({
    id: 'swap-123',
    matchId: 'match-123',
    initiatorId: 'user-1',
    receiverId: 'user-2',
    status: SwapStatus.COMPLETED,
    initiator: mockInitiator,
    receiver: mockReceiver,
    ...overrides,
  });

  const createMockReview = (overrides = {}) => ({
    id: 'review-123',
    swapId: 'swap-123',
    reviewerId: 'user-1',
    revieweeId: 'user-2',
    rating: 5,
    comment: 'Great swap!',
    isFlagged: false,
    isPublic: true,
    createdAt: new Date(),
    reviewer: mockInitiator,
    reviewee: mockReceiver,
    ...overrides,
  });

  beforeEach(() => {
    mockReviewRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findBySwapAndReviewer: jest.fn(),
      update: jest.fn(),
      findReviewsForUser: jest.fn(),
      findReviewsForSwap: jest.fn(),
      calculateUserRating: jest.fn(),
      updateUserRatingAndTrust: jest.fn(),
      getUserSwapStats: jest.fn(),
    };

    mockSwapRepository = {
      findById: jest.fn(),
    };

    mockUserRepository = {
      findById: jest.fn(),
    };

    mockEventEmitter = {
      emitReviewReceived: jest.fn(),
      emitReviewUpdated: jest.fn(),
      emitReviewFlagged: jest.fn(),
    };

    // Default: recalculate returns clean values
    mockReviewRepository.calculateUserRating.mockResolvedValue({ avgRating: 4.5, totalReviews: 10 });
    mockReviewRepository.getUserSwapStats.mockResolvedValue({
      totalSwaps: 20, completedSwaps: 15, totalIncoming: 10, respondedIn24h: 8,
    });
    mockReviewRepository.updateUserRatingAndTrust.mockResolvedValue({});

    reviewService = new ReviewService(
      mockReviewRepository,
      mockSwapRepository,
      mockUserRepository,
      mockEventEmitter
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // submitReview()
  // ─────────────────────────────────────────────────────────────────────────

  describe('submitReview', () => {
    it('should submit a review successfully (success path)', async () => {
      const swap = createMockSwap();
      const review = createMockReview();

      mockSwapRepository.findById.mockResolvedValue(swap);
      mockReviewRepository.findBySwapAndReviewer.mockResolvedValue(null);
      mockReviewRepository.create.mockResolvedValue(review);

      const result = await reviewService.submitReview('swap-123', 'user-1', {
        rating: 5,
        comment: 'Great swap!',
      });

      expect(result).toBe(review);
      expect(mockReviewRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          swapId: 'swap-123',
          reviewerId: 'user-1',
          revieweeId: 'user-2',
          rating: 5,
          comment: 'Great swap!',
        })
      );
      expect(mockEventEmitter.emitReviewReceived).toHaveBeenCalled();
    });

    it('should throw 409 for duplicate review (unique constraint)', async () => {
      const swap = createMockSwap();
      const existingReview = createMockReview();

      mockSwapRepository.findById.mockResolvedValue(swap);
      mockReviewRepository.findBySwapAndReviewer.mockResolvedValue(existingReview);

      try {
        await reviewService.submitReview('swap-123', 'user-1', { rating: 5 });
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toBe('You have already reviewed this swap');
        expect(error.statusCode).toBe(409);
      }
    });

    it('should throw 400 if swap is not completed', async () => {
      const swap = createMockSwap({ status: SwapStatus.IN_PROGRESS });

      mockSwapRepository.findById.mockResolvedValue(swap);

      try {
        await reviewService.submitReview('swap-123', 'user-1', { rating: 5 });
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toBe('Can only review completed swaps');
        expect(error.statusCode).toBe(400);
      }
    });

    it('should throw 403 if user is not a participant', async () => {
      const swap = createMockSwap();

      mockSwapRepository.findById.mockResolvedValue(swap);

      try {
        await reviewService.submitReview('swap-123', 'user-3', { rating: 5 });
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toBe('User is not a participant in this swap');
        expect(error.statusCode).toBe(403);
      }
    });

    it('should correctly determine revieweeId (initiator reviews receiver)', async () => {
      const swap = createMockSwap();
      const review = createMockReview();

      mockSwapRepository.findById.mockResolvedValue(swap);
      mockReviewRepository.findBySwapAndReviewer.mockResolvedValue(null);
      mockReviewRepository.create.mockResolvedValue(review);

      await reviewService.submitReview('swap-123', 'user-1', { rating: 4 });

      expect(mockReviewRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ revieweeId: 'user-2' })
      );
    });

    it('should correctly determine revieweeId (receiver reviews initiator)', async () => {
      const swap = createMockSwap();
      const review = createMockReview({ reviewerId: 'user-2', revieweeId: 'user-1' });

      mockSwapRepository.findById.mockResolvedValue(swap);
      mockReviewRepository.findBySwapAndReviewer.mockResolvedValue(null);
      mockReviewRepository.create.mockResolvedValue(review);

      await reviewService.submitReview('swap-123', 'user-2', { rating: 4 });

      expect(mockReviewRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ revieweeId: 'user-1' })
      );
    });

    it('should throw for invalid rating', async () => {
      const swap = createMockSwap();
      mockSwapRepository.findById.mockResolvedValue(swap);

      try {
        await reviewService.submitReview('swap-123', 'user-1', { rating: 6 });
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toBe('Rating must be between 1 and 5');
        expect(error.statusCode).toBe(400);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // recalculateUserRating()
  // ─────────────────────────────────────────────────────────────────────────

  describe('recalculateUserRating', () => {
    it('should compute correct average and trust score', async () => {
      mockReviewRepository.calculateUserRating.mockResolvedValue({
        avgRating: 4.0,
        totalReviews: 10,
      });
      mockReviewRepository.getUserSwapStats.mockResolvedValue({
        totalSwaps: 20,
        completedSwaps: 16,
        totalIncoming: 10,
        respondedIn24h: 8,
      });

      await reviewService.recalculateUserRating('user-2');

      // Trust score = (4.0/5 * 0.50) + (16/20 * 0.30) + (8/10 * 0.20)
      //            = (0.8 * 0.50) + (0.80 * 0.30) + (0.80 * 0.20)
      //            = 0.40 + 0.24 + 0.16 = 0.80
      expect(mockReviewRepository.updateUserRatingAndTrust).toHaveBeenCalledWith(
        'user-2',
        4.0,
        10,
        0.8
      );
    });

    it('should handle zero swaps gracefully', async () => {
      mockReviewRepository.calculateUserRating.mockResolvedValue({
        avgRating: 0,
        totalReviews: 0,
      });
      mockReviewRepository.getUserSwapStats.mockResolvedValue({
        totalSwaps: 0,
        completedSwaps: 0,
        totalIncoming: 0,
        respondedIn24h: 0,
      });

      await reviewService.recalculateUserRating('user-new');

      expect(mockReviewRepository.updateUserRatingAndTrust).toHaveBeenCalledWith(
        'user-new',
        0,
        0,
        0
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // editReview()
  // ─────────────────────────────────────────────────────────────────────────

  describe('editReview', () => {
    it('should edit review successfully within 24h', async () => {
      const review = createMockReview({
        createdAt: new Date(), // just created
      });
      const updatedReview = createMockReview({ rating: 4, comment: 'Updated' });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockReviewRepository.update.mockResolvedValue(updatedReview);

      const result = await reviewService.editReview('review-123', 'user-1', {
        rating: 4,
        comment: 'Updated',
      });

      expect(result.rating).toBe(4);
      expect(mockEventEmitter.emitReviewUpdated).toHaveBeenCalled();
    });

    it('should fail after 24h', async () => {
      const review = createMockReview({
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      });

      mockReviewRepository.findById.mockResolvedValue(review);

      try {
        await reviewService.editReview('review-123', 'user-1', { rating: 3 });
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('24 hours');
        expect(error.statusCode).toBe(400);
      }
    });

    it('should throw 403 if not the owner', async () => {
      const review = createMockReview();
      mockReviewRepository.findById.mockResolvedValue(review);

      try {
        await reviewService.editReview('review-123', 'user-3', { rating: 3 });
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('your own reviews');
        expect(error.statusCode).toBe(403);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // flagReview()
  // ─────────────────────────────────────────────────────────────────────────

  describe('flagReview', () => {
    it('should flag review and trigger rating recalculation', async () => {
      const review = createMockReview();
      const flaggedReview = createMockReview({ isFlagged: true });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockReviewRepository.update.mockResolvedValue(flaggedReview);

      const result = await reviewService.flagReview('review-123', 'admin-1');

      expect(result.isFlagged).toBe(true);
      expect(mockReviewRepository.update).toHaveBeenCalledWith('review-123', { isFlagged: true });
      expect(mockEventEmitter.emitReviewFlagged).toHaveBeenCalled();
    });

    it('should exclude flagged reviews from rating (via recalculation)', async () => {
      const review = createMockReview();
      const flaggedReview = createMockReview({ isFlagged: true });

      mockReviewRepository.findById.mockResolvedValue(review);
      mockReviewRepository.update.mockResolvedValue(flaggedReview);

      await reviewService.flagReview('review-123', 'admin-1');

      // Wait for async recalculation
      await new Promise((r) => setTimeout(r, 50));

      // Recalculation should have been triggered
      expect(mockReviewRepository.calculateUserRating).toHaveBeenCalledWith('user-2');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getReviewsForUser()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getReviewsForUser', () => {
    it('should return paginated reviews with avgRating', async () => {
      const mockResult = {
        data: [createMockReview()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        avgRating: 5,
      };
      mockReviewRepository.findReviewsForUser.mockResolvedValue(mockResult);

      const result = await reviewService.getReviewsForUser('user-2', { page: 1, limit: 20 });

      expect(result).toBe(mockResult);
      expect(result.avgRating).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getReviewsForSwap()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getReviewsForSwap', () => {
    it('should return reviews for a swap', async () => {
      const swap = createMockSwap();
      const reviews = [createMockReview()];

      mockSwapRepository.findById.mockResolvedValue(swap);
      mockReviewRepository.findReviewsForSwap.mockResolvedValue(reviews);

      const result = await reviewService.getReviewsForSwap('swap-123', 'user-1');

      expect(result).toBe(reviews);
    });

    it('should throw 403 if user is not a participant', async () => {
      const swap = createMockSwap();
      mockSwapRepository.findById.mockResolvedValue(swap);

      try {
        await reviewService.getReviewsForSwap('swap-123', 'user-3');
        fail('Should have thrown');
      } catch (error) {
        expect(error.statusCode).toBe(403);
      }
    });
  });
});

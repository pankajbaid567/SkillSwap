const NotificationService = require('../services/notification.service');
const { SwapEvents, SwapEventEmitter } = require('../events/swap.events');

describe('NotificationService', () => {
  let notificationService;
  let emitter;

  const mockSwap = { id: 'swap-123', status: 'PENDING' };
  const mockInitiator = {
    id: 'user-1',
    email: 'initiator@test.com',
    profile: { displayName: 'Alice' },
  };
  const mockReceiver = {
    id: 'user-2',
    email: 'receiver@test.com',
    profile: { displayName: 'Bob' },
  };

  beforeEach(() => {
    emitter = new SwapEventEmitter();
    notificationService = new NotificationService(emitter);
    notificationService.registerListeners();
  });

  afterEach(() => {
    emitter.removeAllListeners();
  });

  it('should handle SWAP_CREATED and notify receiver', (done) => {
    // Spy on handleSwapEvent
    const spy = jest.spyOn(notificationService, 'handleSwapEvent');

    emitter.emitSwapCreated(mockSwap, mockInitiator, mockReceiver);

    // handleSwapEvent is synchronous, so we can check immediately
    setImmediate(() => {
      expect(spy).toHaveBeenCalledWith(
        SwapEvents.SWAP_CREATED,
        expect.objectContaining({
          event: SwapEvents.SWAP_CREATED,
          swap: mockSwap,
          notifyUserId: mockReceiver.id,
          message: expect.stringContaining('Alice'),
        })
      );
      spy.mockRestore();
      done();
    });
  });

  it('should handle SWAP_ACCEPTED and notify initiator', (done) => {
    const spy = jest.spyOn(notificationService, 'handleSwapEvent');

    emitter.emitSwapAccepted(mockSwap, mockInitiator, mockReceiver);

    setImmediate(() => {
      expect(spy).toHaveBeenCalledWith(
        SwapEvents.SWAP_ACCEPTED,
        expect.objectContaining({
          event: SwapEvents.SWAP_ACCEPTED,
          notifyUserId: mockInitiator.id,
          message: expect.stringContaining('accepted'),
        })
      );
      spy.mockRestore();
      done();
    });
  });

  it('should handle SWAP_COMPLETED and notify both users', (done) => {
    const spy = jest.spyOn(notificationService, 'handleSwapEvent');

    emitter.emitSwapCompleted(mockSwap, mockInitiator, mockReceiver);

    setImmediate(() => {
      expect(spy).toHaveBeenCalledWith(
        SwapEvents.SWAP_COMPLETED,
        expect.objectContaining({
          event: SwapEvents.SWAP_COMPLETED,
          notifyUserIds: [mockInitiator.id, mockReceiver.id],
          message: expect.stringContaining('review'),
        })
      );
      spy.mockRestore();
      done();
    });
  });

  it('should handle SWAP_CANCELLED and notify the other party', (done) => {
    const spy = jest.spyOn(notificationService, 'handleSwapEvent');

    emitter.emitSwapCancelled(
      mockSwap,
      mockInitiator,
      mockReceiver,
      mockInitiator.id,
      'Changed mind'
    );

    setImmediate(() => {
      expect(spy).toHaveBeenCalledWith(
        SwapEvents.SWAP_CANCELLED,
        expect.objectContaining({
          event: SwapEvents.SWAP_CANCELLED,
          notifyUserId: mockReceiver.id,
        })
      );
      spy.mockRestore();
      done();
    });
  });

  it('should handle SWAP_EXPIRED and notify both users', (done) => {
    const spy = jest.spyOn(notificationService, 'handleSwapEvent');

    emitter.emitSwapExpired(mockSwap, mockInitiator, mockReceiver);

    setImmediate(() => {
      expect(spy).toHaveBeenCalledWith(
        SwapEvents.SWAP_EXPIRED,
        expect.objectContaining({
          event: SwapEvents.SWAP_EXPIRED,
          notifyUserIds: [mockInitiator.id, mockReceiver.id],
          message: expect.stringContaining('expired'),
        })
      );
      spy.mockRestore();
      done();
    });
  });

  it('should handle SWAP_DECLINED and notify initiator', (done) => {
    const spy = jest.spyOn(notificationService, 'handleSwapEvent');

    emitter.emitSwapDeclined(mockSwap, mockInitiator, mockReceiver, 'Not interested');

    setImmediate(() => {
      expect(spy).toHaveBeenCalledWith(
        SwapEvents.SWAP_DECLINED,
        expect.objectContaining({
          event: SwapEvents.SWAP_DECLINED,
          notifyUserId: mockInitiator.id,
          reason: 'Not interested',
        })
      );
      spy.mockRestore();
      done();
    });
  });

  it('should handle SWAP_IN_PROGRESS and notify both users', (done) => {
    const spy = jest.spyOn(notificationService, 'handleSwapEvent');

    emitter.emitSwapInProgress(mockSwap, mockInitiator, mockReceiver);

    setImmediate(() => {
      expect(spy).toHaveBeenCalledWith(
        SwapEvents.SWAP_IN_PROGRESS,
        expect.objectContaining({
          event: SwapEvents.SWAP_IN_PROGRESS,
          notifyUserIds: [mockInitiator.id, mockReceiver.id],
          message: expect.stringContaining('started'),
        })
      );
      spy.mockRestore();
      done();
    });
  });
});

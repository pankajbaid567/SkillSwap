const { SwapEvents, swapEventEmitter } = require('../events/swap.events');
const logger = require('../utils/logger');

/**
 * NotificationService — Handles swap lifecycle notifications via Observer pattern.
 *
 * Design:
 *   - DIP: Decoupled from SwapService via EventEmitter (SwapService emits, this listens)
 *   - SRP: Only handles notification dispatch logic
 *   - Observer Pattern: Subscribes to SwapEvents and processes them
 *
 * Currently logs notifications. In production, this would integrate with:
 *   - Email service (SendGrid, SES)
 *   - Push notification service (FCM, APNs)
 *   - In-app notification system (WebSocket / SSE)
 */
class NotificationService {
  /** @type {import('../events/swap.events').SwapEventEmitter} */
  #eventEmitter;

  /**
   * @param {import('../events/swap.events').SwapEventEmitter} [eventEmitter]
   */
  constructor(eventEmitter = swapEventEmitter) {
    this.#eventEmitter = eventEmitter;
  }

  /**
   * Register all swap event listeners.
   * Call this once during application bootstrap.
   */
  registerListeners() {
    this.#eventEmitter.on(SwapEvents.SWAP_CREATED, (payload) =>
      this.handleSwapEvent(SwapEvents.SWAP_CREATED, payload)
    );

    this.#eventEmitter.on(SwapEvents.SWAP_ACCEPTED, (payload) =>
      this.handleSwapEvent(SwapEvents.SWAP_ACCEPTED, payload)
    );

    this.#eventEmitter.on(SwapEvents.SWAP_DECLINED, (payload) =>
      this.handleSwapEvent(SwapEvents.SWAP_DECLINED, payload)
    );

    this.#eventEmitter.on(SwapEvents.SWAP_IN_PROGRESS, (payload) =>
      this.handleSwapEvent(SwapEvents.SWAP_IN_PROGRESS, payload)
    );

    this.#eventEmitter.on(SwapEvents.SWAP_COMPLETED, (payload) =>
      this.handleSwapEvent(SwapEvents.SWAP_COMPLETED, payload)
    );

    this.#eventEmitter.on(SwapEvents.SWAP_CANCELLED, (payload) =>
      this.handleSwapEvent(SwapEvents.SWAP_CANCELLED, payload)
    );

    this.#eventEmitter.on(SwapEvents.SWAP_EXPIRED, (payload) =>
      this.handleSwapEvent(SwapEvents.SWAP_EXPIRED, payload)
    );

    logger.info('NotificationService: swap event listeners registered');
  }

  /**
   * Handle a swap lifecycle event and dispatch notifications.
   *
   * @param {string} event - The event type (from SwapEvents)
   * @param {Object} payload - Event payload containing swap, users, and message
   * @param {Object} payload.swap - The swap object
   * @param {Object} payload.initiator - Initiator user object
   * @param {Object} payload.receiver - Receiver user object
   * @param {string} payload.message - Human-readable notification message
   * @param {string} [payload.notifyUserId] - Single user to notify
   * @param {string[]} [payload.notifyUserIds] - Multiple users to notify
   * @param {Date} payload.timestamp - Event timestamp
   */
  handleSwapEvent(event, payload) {
    const { swap, message, notifyUserId, notifyUserIds, timestamp } = payload;

    // Determine recipients
    const recipients = notifyUserIds || (notifyUserId ? [notifyUserId] : []);

    if (recipients.length === 0) {
      logger.warn(`NotificationService: No recipients for event ${event}`, {
        swapId: swap?.id,
      });
      return;
    }

    // Dispatch notification to each recipient
    for (const userId of recipients) {
      this.#dispatchNotification({
        userId,
        event,
        swapId: swap?.id,
        message,
        timestamp,
      });
    }
  }

  /**
   * Dispatch a notification to a single user.
   * This is the integration point for real notification channels.
   *
   * @param {Object} notification
   * @param {string} notification.userId - Target user ID
   * @param {string} notification.event - Event type
   * @param {string} notification.swapId - Related swap ID
   * @param {string} notification.message - Notification message
   * @param {Date} notification.timestamp - When the event occurred
   * @private
   */
  #dispatchNotification({ userId, event, swapId, message, timestamp }) {
    // TODO: Replace with actual notification channel integration
    // e.g., email, push notification, WebSocket, in-app notification store
    logger.info('NotificationService: dispatching notification', {
      userId,
      event,
      swapId,
      message,
      timestamp: timestamp?.toISOString(),
    });
  }
}

module.exports = NotificationService;

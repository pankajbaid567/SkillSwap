const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/response.util');

const env = global.process?.env || {};
const windowMs = Number(env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const maxRequests = Number(env.RATE_LIMIT_MAX || 100);
const disabled = String(env.RATE_LIMIT_DISABLED || '').toLowerCase() === 'true';

const authRateLimiter = disabled
  ? (req, res, next) => next()
  : rateLimit({
      windowMs,
      max: maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res, next, options) => {
        sendError(res, options.statusCode, 'TOO_MANY_REQUESTS', options.message);
      },
    });

module.exports = authRateLimiter;

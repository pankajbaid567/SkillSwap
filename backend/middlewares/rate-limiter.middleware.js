const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/response.util');

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next, options) => {
    sendError(res, options.statusCode, 'TOO_MANY_REQUESTS', options.message);
  }
});

module.exports = authRateLimiter;

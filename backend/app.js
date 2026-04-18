const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimiter = require('./middlewares/rate-limiter.middleware');
const errorHandler = require('./middlewares/error.middleware');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const matchingRoutes = require('./routes/matching.routes');
const swapRoutes = require('./routes/swap.routes');
const reviewRoutes = require('./routes/review.routes');
const adminRoutes = require('./routes/admin.routes');
const chatRoutes = require('./routes/chat.routes');
const notificationRoutes = require('./routes/notification.routes');
const reviewController = require('./controllers/review.controller');
const { verifyAccessToken } = require('./middlewares/auth.middleware');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger.config');

const app = express();

const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

const isLocalDevOrigin = (origin) => {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
};

const corsOriginValidator = (origin, callback) => {
  // Allow non-browser tools (curl/Postman) that do not send Origin
  if (!origin) return callback(null, true);

  if (configuredOrigins.length > 0) {
    return callback(null, configuredOrigins.includes(origin));
  }

  return callback(null, isLocalDevOrigin(origin));
};

// Global Middlewares
app.use(helmet());
app.use(cors({
  origin: corsOriginValidator,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply Rate Limiting globally or specific to auth
// As per instructions, rateLimiter is applied. We can apply it to API routes.
app.use('/api', rateLimiter);

// Swagger Documentation Route
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/matches', matchingRoutes);
app.use('/api/swaps', swapRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/notifications', notificationRoutes);

// User review route (public — GET /api/users/:id/reviews)
app.get('/api/users/:id/reviews', verifyAccessToken, reviewController.getReviewsForUser);

// Root Endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to SkillSwap AI Backend' });
});

// 404 Handler
app.use((req, res, next) => {
  const err = new Error('Route not found');
  err.statusCode = 404;
  err.errorCode = 'NOT_FOUND';
  next(err);
});

// Centralized Error Handling
app.use(errorHandler);

module.exports = app;

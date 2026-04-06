const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimiter = require('./middlewares/rate-limiter.middleware');
const errorHandler = require('./middlewares/error.middleware');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');

const app = express();

// Global Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply Rate Limiting globally or specific to auth
// As per instructions, rateLimiter is applied. We can apply it to API routes.
app.use('/api', rateLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

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

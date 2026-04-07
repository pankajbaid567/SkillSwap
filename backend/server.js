require('dotenv').config();
const app = require('./app');
const { envConfig } = require('./config/env.config');
const prisma = require('./config/db.config');
const redisClient = require('./cache/redis.client');
const logger = require('./utils/logger');
const NotificationService = require('./services/notification.service');
const CronJobManager = require('./cron/session-reminders.cron');

// Register swap event listeners (Observer pattern — decoupled from SwapService)
const notificationService = new NotificationService();
notificationService.registerListeners();

const PORT = envConfig.PORT || 3000;

async function startServer() {
  try {
    // Attempt DB connect validation
    await prisma.$connect();
    logger.info('Connected to database successfully');

    // Start cron jobs
    const cronManager = new CronJobManager();
    cronManager.startAll();

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start the server', { error: error.message });
    process.exit(1);
  }
}

startServer();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await redisClient.disconnect();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await redisClient.disconnect();
  await prisma.$disconnect();
  process.exit(0);
});

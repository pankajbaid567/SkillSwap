require('dotenv').config();
const app = require('./app');
const { envConfig } = require('./config/env.config');
const prisma = require('./config/db.config');

const PORT = envConfig.PORT || 3000;

async function startServer() {
  try {
    // Attempt DB connect validation
    await prisma.$connect();
    console.log('✅ Connected to database successfully.');

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start the server:');
    console.error(error);
    process.exit(1);
  }
}

startServer();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await prisma.$disconnect();
  process.exit(0);
});

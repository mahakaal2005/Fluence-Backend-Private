import { createServer } from 'http';
import app from './app.js';
import { getConfig } from './config/index.js';
import { BackgroundJobsService } from './services/background-jobs.service.js';
import { migrate } from './db/pool.js';

const { port } = getConfig();

// Initialize database
async function initializeDatabase() {
  try {
    await migrate();
    console.log('✅ Database migration completed');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  }
}

const server = createServer(app);

// Start server after database initialization
initializeDatabase().then(() => {
  server.listen(port, '0.0.0.0', () => {
    console.log(`Auth service listening on port ${port}`);
    console.log(`🌐 Network: Listening on all interfaces (0.0.0.0:${port})`);

    // Temporarily disabled background jobs due to SIGSEGV crash with node-cron
    // TODO: Fix node-cron issue or replace with alternative scheduling library
    // Background jobs initialization disabled to prevent service crashes
    console.log('⚠️  Background jobs disabled temporarily due to node-cron SIGSEGV issue');
    // setImmediate(() => {
    //   try {
    //     BackgroundJobsService.initialize();
    //   } catch (error) {
    //     console.error('⚠️  Failed to initialize background jobs:', error.message);
    //     console.log('⚠️  Service will continue without background jobs');
    //   }
    // });
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  try {
    BackgroundJobsService.stopAllJobs();
  } catch (error) {
    // Ignore errors if jobs are disabled
  }
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  try {
    BackgroundJobsService.stopAllJobs();
  } catch (error) {
    // Ignore errors if jobs are disabled
  }
  server.close(() => {
    console.log('Process terminated');
  });
});



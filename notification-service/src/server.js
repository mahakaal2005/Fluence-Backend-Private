import cron from 'node-cron';
import app from './app.js';
import { getConfig } from './config/index.js';
import { testConnection, migrate } from './config/database.js';
import { SchedulerService } from './services/scheduler.service.js';

const config = getConfig();

async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Run migrations in development
    if (config.nodeEnv === 'development') {
      try {
        await migrate();
        console.log('Database migrations completed');
      } catch (migrationError) {
        console.warn('Database migration failed:', migrationError.message);
        // Don't exit in development, just warn
      }
    }

    // Start server - listen on all network interfaces
    const server = app.listen(config.port, '0.0.0.0', () => {
      console.log(`🚀 Notification Service running on port ${config.port}`);
      console.log(`📊 Environment: ${config.nodeEnv}`);
      console.log(`🔗 Health check: http://localhost:${config.port}/health`);
      console.log(`📚 API Documentation: http://localhost:${config.port}/`);
      console.log(`🌐 Network: Listening on all interfaces (0.0.0.0:${config.port})`);
      
      // Initialize scheduled notifications processor
      // Runs every minute to check for due notifications
      console.log('⏰ Initializing scheduled notifications processor...');
      
      const schedulerJob = cron.schedule('* * * * *', async () => {
        try {
          await SchedulerService.processScheduledNotifications();
        } catch (error) {
          console.error('Scheduler job error:', error);
        }
      });

      console.log('✓ Scheduler initialized - checking for scheduled notifications every minute');
      
      // Run immediately on startup to catch any missed notifications
      setTimeout(async () => {
        console.log('🔄 Running initial scheduled notifications check...');
        try {
          await SchedulerService.processScheduledNotifications();
        } catch (error) {
          console.error('Initial scheduler run error:', error);
        }
      }, 5000); // Wait 5 seconds after startup
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);

      server.close((err) => {
        if (err) {
          console.error('Error during server shutdown:', err);
          process.exit(1);
        }

        console.log('Server closed successfully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

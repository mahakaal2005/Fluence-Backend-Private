import app from './app.js';
import { getConfig } from './config/index.js';
import { testConnection, migrate } from './config/database.js';

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
      console.log(`🚀 Merchant Onboarding Service running on port ${config.port}`);
      console.log(`📊 Environment: ${config.nodeEnv}`);
      console.log(`🔗 Health check: http://localhost:${config.port}/health`);
      console.log(`📚 API Documentation: http://localhost:${config.port}/`);
      console.log(`🌐 Network: Listening on all interfaces (0.0.0.0:${config.port})`);
    });

    // Configure server timeouts to prevent socket hangup errors
    server.keepAliveTimeout = 65000; // 65 seconds (slightly longer than default 60s)
    server.headersTimeout = 66000; // 66 seconds (must be > keepAliveTimeout)
    server.timeout = 120000; // 2 minutes for request timeout

    // Handle server errors
    server.on('error', (err) => {
      console.error('Server error:', err);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${config.port} is already in use`);
        process.exit(1);
      }
    });

    // Handle client errors (socket hangup, etc.)
    server.on('clientError', (err, socket) => {
      console.error('Client error:', err.message);
      if (!socket.writable) {
        socket.destroy();
      } else {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      }
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

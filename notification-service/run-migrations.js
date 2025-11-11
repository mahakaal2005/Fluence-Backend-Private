#!/usr/bin/env node

/**
 * Manual Migration Runner
 * Run this script to manually execute database migrations
 * Usage: node run-migrations.js
 */

import { migrate, testConnection } from './src/config/database.js';

async function runMigrations() {
    console.log('🚀 Manual Migration Runner');
    console.log('==========================\n');

    try {
        // Test database connection first
        console.log('Testing database connection...');
        const connected = await testConnection();

        if (!connected) {
            console.error('❌ Failed to connect to database');
            console.error('Please check your database configuration in .env file');
            process.exit(1);
        }

        console.log('✓ Database connection successful\n');

        // Run migrations
        console.log('Running migrations...\n');
        await migrate();

        console.log('\n✓ All migrations completed successfully!');
        console.log('\nYou can now restart your notification service.');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\nError details:', error);
        process.exit(1);
    }
}

// Run migrations
runMigrations();

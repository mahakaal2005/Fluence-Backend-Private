#!/usr/bin/env node

/**
 * Migration Runner Script for Auth Service
 * This script runs a specific migration file against the database
 * 
 * Usage: node scripts/run-migration.js <migration-file>
 * Example: node scripts/run-migration.js sql/migrations/add_suspended_status.sql
 */

import { getPool } from '../src/db/pool.js';
import { getConfig } from '../src/config/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration(migrationFile) {
  const client = await getPool().connect();
  
  try {
    console.log('🚀 Running Migration...');
    console.log('=====================================\n');

    const config = getConfig();
    console.log(`📊 Database: ${config.pg.database}`);
    console.log(`🏠 Host: ${config.pg.host}:${config.pg.port}`);
    console.log(`👤 User: ${config.pg.user}`);
    console.log(`📄 Migration: ${migrationFile}\n`);

    // Resolve migration file path
    const migrationPath = path.isAbsolute(migrationFile) 
      ? migrationFile 
      : path.join(__dirname, '..', migrationFile);

    // Check if file exists
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    // Read migration SQL
    console.log('📖 Reading migration file...');
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');
    
    if (!sqlContent.trim()) {
      throw new Error('Migration file is empty');
    }

    // Begin transaction
    await client.query('BEGIN');
    console.log('✅ Transaction started\n');

    // Execute migration
    console.log('⚙️  Executing migration...');
    await client.query(sqlContent);
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const verifyResult = await client.query(`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'users'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%status%IN%'
      LIMIT 1;
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Status constraint found:');
      console.log(`   ${verifyResult.rows[0].constraint_definition}`);
      
      // Check if 'suspended' is in the constraint
      if (verifyResult.rows[0].constraint_definition.includes('suspended')) {
        console.log('\n✅ SUCCESS: "suspended" status is now allowed!');
      } else {
        console.log('\n⚠️  WARNING: "suspended" not found in constraint definition');
      }
    } else {
      console.log('⚠️  No status constraint found');
    }

    // Show current user status distribution
    const statusCount = await client.query(`
      SELECT 
        status,
        COUNT(*) as user_count
      FROM users
      GROUP BY status
      ORDER BY status;
    `);
    
    if (statusCount.rows.length > 0) {
      console.log('\n📊 Current user status distribution:');
      statusCount.rows.forEach(row => {
        console.log(`   ${row.status}: ${row.user_count} user(s)`);
      });
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('   You can now suspend users from the admin panel.');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error('   Error details:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure PostgreSQL is running');
    console.log('   2. Check your database connection settings');
    console.log('   3. Ensure the users table exists');
    console.log('   4. Verify your credentials');
    process.exit(1);
  } finally {
    client.release();
  }
}

// Get migration file from command line arguments
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Error: Migration file path is required');
  console.log('\nUsage: node scripts/run-migration.js <migration-file>');
  console.log('Example: node scripts/run-migration.js sql/migrations/add_suspended_status.sql');
  process.exit(1);
}

// Run the migration
runMigration(migrationFile);


import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

let pool = null;

function createPool() {
  if (pool) return pool;

  const config = {
    host: process.env.NOTIFICATION_DB_HOST || '161.248.37.208',
    port: parseInt(process.env.NOTIFICATION_DB_PORT || '5432'),
    database: process.env.NOTIFICATION_DB_NAME || 'postgres',
    user: process.env.NOTIFICATION_DB_USER || 'bp-user',
    password: process.env.NOTIFICATION_DB_PASSWORD || 'k?b0fY3ZB!lB6lJiB*7EqaK',
    ssl: process.env.NOTIFICATION_DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.NOTIFICATION_DB_MAX_CONNECTIONS || '10'),
    idleTimeoutMillis: parseInt(process.env.NOTIFICATION_DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.NOTIFICATION_DB_CONNECTION_TIMEOUT || '15000'),
  };

  pool = new Pool(config);

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  return pool;
}

export function getPool() {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

export async function migrate() {
  const client = await getPool().connect();
  try {
    console.log('🔄 Starting database migration...');
    await client.query('BEGIN');

    // Import required modules
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Step 1: Create migrations_log table if it doesn't exist
    console.log('📋 Creating migrations_log table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations_log (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        success BOOLEAN NOT NULL DEFAULT true,
        error_message TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_migrations_log_name ON migrations_log (migration_name);
    `);

    // Step 2: Run init.sql (base schema)
    console.log('📦 Running base schema (init.sql)...');
    const sqlPath = path.join(__dirname, '../../sql/init.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sqlContent);
    console.log('✓ Base schema completed');

    // Step 3: Run migration files from migrations/ folder
    const migrationsDir = path.join(__dirname, '../../migrations');

    // Check if migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️ No migrations directory found, skipping migrations');
      await client.query('COMMIT');
      console.log('✓ Database migration completed successfully');
      return;
    }

    // Read all .sql files from migrations directory
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort alphabetically (001_, 002_, etc.)

    if (migrationFiles.length === 0) {
      console.log('ℹ️ No migration files found');
      await client.query('COMMIT');
      console.log('✓ Database migration completed successfully');
      return;
    }

    console.log(`📁 Found ${migrationFiles.length} migration file(s)`);

    // Step 4: Execute each migration that hasn't been run yet
    for (const migrationFile of migrationFiles) {
      const migrationName = migrationFile;

      // Check if this migration has already been run
      const checkResult = await client.query(
        'SELECT id FROM migrations_log WHERE migration_name = $1',
        [migrationName]
      );

      if (checkResult.rows.length > 0) {
        console.log(`⏭️  Skipping ${migrationName} (already executed)`);
        continue;
      }

      // Execute the migration
      console.log(`🔧 Executing migration: ${migrationName}`);
      try {
        const migrationPath = path.join(migrationsDir, migrationFile);
        const migrationContent = fs.readFileSync(migrationPath, 'utf8');

        // Execute the migration SQL
        await client.query(migrationContent);

        // Log successful migration
        await client.query(
          'INSERT INTO migrations_log (migration_name, success) VALUES ($1, true)',
          [migrationName]
        );

        console.log(`✓ Migration ${migrationName} completed successfully`);
      } catch (migrationError) {
        console.error(`✗ Migration ${migrationName} failed:`, migrationError.message);

        // Log failed migration
        await client.query(
          'INSERT INTO migrations_log (migration_name, success, error_message) VALUES ($1, false, $2)',
          [migrationName, migrationError.message]
        );

        throw new Error(`Migration ${migrationName} failed: ${migrationError.message}`);
      }
    }

    await client.query('COMMIT');
    console.log('✓ Database migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Database migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

export async function testConnection() {
  try {
    const client = await getPool().connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('Notification service database connection successful');
    return true;
  } catch (err) {
    console.error('Notification service database connection failed:', err);
    return false;
  }
}

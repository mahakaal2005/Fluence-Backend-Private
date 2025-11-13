import { Pool } from 'pg';
import { getConfig } from '../config/index.js';

const config = getConfig();

let pool;

function createPool() {
  return new Pool({
    host: config.pg.host,
    port: config.pg.port,
    database: config.pg.database,
    user: config.pg.user,
    password: config.pg.password,
    ssl: config.pg.ssl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
}

export function getPool() {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

// Function to clear the pool (useful after migrations)
export async function clearPool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database connection pool cleared');
  }
}

export async function migrate() {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    
    // Read and execute the init.sql file
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const sqlPath = path.join(__dirname, '../../sql/init.sql');
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sqlContent);
    
    await client.query('COMMIT');
    console.log('Auth service database migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Database migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}




import { Pool } from 'pg';
import { getConfig } from '../config/index.js';

const config = getConfig();

let pool;

function createPool() {
  const newPool = new Pool({
    host: config.pg.host,
    port: config.pg.port,
    database: config.pg.database,
    user: config.pg.user,
    password: config.pg.password,
    ssl: config.pg.ssl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000, // Increased from 10s to 30s to prevent socket hangup
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  });

  // Handle connection errors to prevent unhandled rejections
  newPool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  // Handle connect errors
  newPool.on('connect', (client) => {
    client.on('error', (err) => {
      console.error('Database client error:', err);
    });
  });

  return newPool;
}

export function getPool() {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

/**
 * Execute a database query with timeout handling
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @param {number} timeoutMs - Query timeout in milliseconds (default: 25000)
 * @returns {Promise} Query result
 */
export async function queryWithTimeout(text, params, timeoutMs = 25000) {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    // Set statement timeout for this query
    await client.query(`SET statement_timeout = ${timeoutMs}`);
    
    // Execute the actual query
    const result = await client.query(text, params);
    
    // Reset statement timeout
    await client.query('RESET statement_timeout');
    
    return result;
  } catch (err) {
    // Reset statement timeout on error
    try {
      await client.query('RESET statement_timeout');
    } catch (resetErr) {
      // Ignore reset errors
    }
    throw err;
  } finally {
    client.release();
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




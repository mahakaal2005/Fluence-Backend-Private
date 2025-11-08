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
    console.log('Notification service database migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Database migration failed:', err);
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

import { getPool } from '../db/pool.js';

const sanitizeEmail = (email) => (email ? email.toLowerCase() : null);

export async function createUser({
  name,
  email = null,
  password_hash = null,
  auth_provider = 'password',
  provider_id = null,
  phone = null,
  phone_verified_at = null,
  email_verified_at = null,
  date_of_birth = null,
  role = 'user',
  status = 'active',
  is_approved = false
}) {
  const result = await getPool().query(
    `INSERT INTO users (
      name,
      email,
      password_hash,
      auth_provider,
      provider_id,
      phone,
      phone_verified_at,
      email_verified_at,
      date_of_birth,
      role,
      status,
      is_approved
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      name,
      sanitizeEmail(email),
      password_hash,
      auth_provider,
      provider_id,
      phone,
      phone_verified_at,
      email_verified_at,
      date_of_birth,
      role,
      status,
      is_approved
    ]
  );
  return result.rows[0];
}

export async function findUserByEmail(email) {
  if (!email) {
    return null;
  }
  const result = await getPool().query(`SELECT * FROM users WHERE email = $1 LIMIT 1`, [email.toLowerCase()]);
  return result.rows[0] || null;
}

export async function findUserByPhone(phone) {
  if (!phone) {
    return null;
  }
  const result = await getPool().query(`SELECT * FROM users WHERE phone = $1 LIMIT 1`, [phone]);
  return result.rows[0] || null;
}

export async function findUserById(id) {
  const result = await getPool().query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [id]);
  return result.rows[0] || null;
}

export async function findUserByProvider(provider, providerId) {
  const result = await getPool().query(`SELECT * FROM users WHERE auth_provider = $1 AND provider_id = $2 LIMIT 1`, [provider, providerId]);
  return result.rows[0] || null;
}

export async function updateUserStatus(id, status) {
  const result = await getPool().query(`UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, status]);
  return result.rows[0] || null;
}

export async function updateUserProfile(id, name, email, phone, date_of_birth) {
  const result = await getPool().query(
    `UPDATE users SET name = $2, email = $3, phone = $4, date_of_birth = $5, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, name, sanitizeEmail(email), phone || null, date_of_birth || null]
  );
  return result.rows[0] || null;
}

export async function updateUserApprovalStatus(id, isApproved) {
  const result = await getPool().query(
    `UPDATE users SET is_approved = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, isApproved]
  );
  return result.rows[0] || null;
}

export async function markPhoneVerified(userId) {
  const result = await getPool().query(
    `UPDATE users SET phone_verified_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function updateUserEmailIfMissing(userId, email) {
  if (!email) {
    return null;
  }
  const result = await getPool().query(
    `UPDATE users SET email = $2, email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW()
     WHERE id = $1 AND (email IS NULL OR email LIKE 'phone-user-%') RETURNING *`,
    [userId, sanitizeEmail(email)]
  );
  return result.rows[0] || null;
}

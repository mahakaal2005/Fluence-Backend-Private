import { getPool } from '../db/pool.js';

export async function getPhoneOtp(phone) {
  const result = await getPool().query(
    `SELECT phone, otp_hash, retry_count, resend_count, last_sent_at, expires_at, created_at, updated_at
     FROM phone_verification_tokens
     WHERE phone = $1`,
    [phone]
  );
  return result.rows[0] || null;
}

export async function upsertPhoneOtp({ phone, otpHash, expiresAt, resetResendCount = false }) {
  const result = await getPool().query(
    `INSERT INTO phone_verification_tokens (phone, otp_hash, expires_at, retry_count, resend_count, last_sent_at, updated_at)
     VALUES ($1, $2, $3, 0, 1, NOW(), NOW())
     ON CONFLICT (phone) DO UPDATE
     SET otp_hash = EXCLUDED.otp_hash,
         expires_at = EXCLUDED.expires_at,
         retry_count = 0,
         resend_count = CASE WHEN $4 THEN 1 ELSE phone_verification_tokens.resend_count + 1 END,
         last_sent_at = NOW(),
         updated_at = NOW()
     RETURNING *`,
    [phone, otpHash, expiresAt, resetResendCount]
  );
  return result.rows[0] || null;
}

export async function incrementOtpRetry({ phone }) {
  const result = await getPool().query(
    `UPDATE phone_verification_tokens
     SET retry_count = retry_count + 1,
         updated_at = NOW()
     WHERE phone = $1
     RETURNING retry_count, expires_at`,
    [phone]
  );
  return result.rows[0] || null;
}

export async function deletePhoneOtp(phone) {
  await getPool().query(
    `DELETE FROM phone_verification_tokens WHERE phone = $1`,
    [phone]
  );
}


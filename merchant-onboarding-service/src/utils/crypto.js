import bcrypt from 'bcrypt';

const DEFAULT_ROUNDS = 10;

export async function hashPassword(plain) {
  const saltRounds = Number(process.env.BCRYPT_ROUNDS || DEFAULT_ROUNDS);
  return await bcrypt.hash(plain, saltRounds);
}

export async function comparePassword(plain, hash) {
  if (!hash) return false;
  return await bcrypt.compare(plain, hash);
}



import admin from 'firebase-admin';

let initialized = false;

export function initializeFirebase() {
  if (initialized) return admin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase service account env vars');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });

  initialized = true;
  return admin;
}

function getFirestore() {
  return initializeFirebase().firestore();
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Collection name in Firestore to store OTPs
const OTP_COLLECTION = 'merchant_email_otps';

export async function createEmailOtp(email, ttlMinutes = 10) {
  const db = getFirestore();
  const code = generateOtpCode();
  const now = Date.now();
  const expiresAt = new Date(now + ttlMinutes * 60 * 1000);

  const docRef = db.collection(OTP_COLLECTION).doc(email.toLowerCase());
  await docRef.set({
    email: email.toLowerCase(),
    code,
    createdAt: admin.firestore.Timestamp.fromDate(new Date(now)),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    attempts: 0
  });

  return { code, expiresAt };
}

export async function verifyEmailOtp(email, code) {
  const db = getFirestore();
  const docRef = db.collection(OTP_COLLECTION).doc(email.toLowerCase());
  const snap = await docRef.get();
  if (!snap.exists) return { ok: false, reason: 'not_found' };

  const data = snap.data();
  const now = new Date();
  const expired = data.expiresAt && data.expiresAt.toDate() < now;
  const match = data.code === code;

  if (expired || !match) {
    await docRef.update({ attempts: (data.attempts || 0) + 1 });
    return { ok: false, reason: expired ? 'expired' : 'mismatch' };
  }

  await docRef.delete();
  return { ok: true };
}



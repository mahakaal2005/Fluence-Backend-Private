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

export async function isEmailVerified(email) {
  const auth = initializeFirebase().auth();
  try {
    const user = await auth.getUserByEmail(email.toLowerCase());
    return Boolean(user.emailVerified);
  } catch (e) {
    // If user not found in Firebase, treat as not verified
    return false;
  }
}



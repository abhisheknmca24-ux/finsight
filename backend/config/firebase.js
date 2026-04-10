const admin = require("firebase-admin");

let db = null;
let firebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK from environment variables.
 * Fails gracefully — if credentials are missing the app still runs
 * (MongoDB remains the source of truth).
 */
const initializeFirebase = () => {
  if (firebaseInitialized) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      "[Firebase] Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY. " +
        "Firestore sync and Firebase token verification disabled."
    );
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        // Private key comes with escaped newlines from .env
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });

    db = admin.firestore();
    firebaseInitialized = true;
    console.log("[Firebase] Admin SDK initialized — Firestore sync enabled");
  } catch (err) {
    console.error("[Firebase] Initialization failed:", err.message);
  }
};

// Initialize on require
initializeFirebase();

/**
 * Verify a Firebase ID token (from client-side Google Sign-In).
 * Returns decoded token or null.
 */
const verifyFirebaseToken = async (idToken) => {
  if (!firebaseInitialized) return null;
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    console.error("[Firebase] Token verification failed:", err.message);
    return null;
  }
};

module.exports = {
  admin,
  getDb: () => db,
  isFirebaseReady: () => firebaseInitialized,
  verifyFirebaseToken,
};

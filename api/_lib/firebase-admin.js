import admin from 'firebase-admin';

// Ensure we don't re-initialize on serverless cold starts
if (!admin.apps.length) {
  try {
    // Attempt to initialize using environment variables securely stored in Vercel
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
      });
    } else {
      // Fallback: If deployed in an environment where GOOGLE_APPLICATION_CREDENTIALS is set automatically
      admin.initializeApp();
    }
  } catch (error) {
    console.error('Firebase admin initialization error:', error.stack);
  }
}

export const db = admin.firestore();

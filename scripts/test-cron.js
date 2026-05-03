import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const DEVICE_ID = "8857215964D"; // Change to your device ID
const ITEM_ID = "item_1";       // Change to your item ID
const TARGET_DATE = "2026-05-01"; // Format: YYYY-MM-DD
// ---------------------

// Mock readings for the day (decreasing weight = consumption)
const mockReadings = [
  { timestamp: new Date(`${TARGET_DATE}T08:00:00Z`).getTime(), weight: 2000 },
  { timestamp: new Date(`${TARGET_DATE}T10:00:00Z`).getTime(), weight: 1950 }, // -50g
  { timestamp: new Date(`${TARGET_DATE}T14:00:00Z`).getTime(), weight: 1800 }, // -150g
  { timestamp: new Date(`${TARGET_DATE}T18:00:00Z`).getTime(), weight: 1700 }, // -100g
  { timestamp: new Date(`${TARGET_DATE}T21:00:00Z`).getTime(), weight: 1650 }, // -50g
];
// Total expected consumption: 350g

async function seedData() {
  console.log(`🚀 Seeding mock data for ${DEVICE_ID}/${ITEM_ID} on ${TARGET_DATE}...`);

  // Initialize Firebase Admin
  // If you are running this locally, make sure you have the service account key
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  
  if (!serviceAccountKey) {
    console.error("❌ Error: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
    console.log("Please export it first: export FIREBASE_SERVICE_ACCOUNT_KEY='{...json...}'");
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountKey))
    });
  }

  const db = admin.firestore();
  const batch = db.batch();
  const logsRef = db.collection('Kitchen_Readings').doc(DEVICE_ID).collection(ITEM_ID);

  for (const reading of mockReadings) {
    const docId = `mock_${reading.timestamp}`;
    const docRef = logsRef.doc(docId);
    batch.set(docRef, reading);
  }

  await batch.commit();
  console.log(`✅ Successfully inserted ${mockReadings.length} readings.`);
  console.log(`\nNext steps:`);
  console.log(`1. Run your Vercel dev server: vercel dev`);
  console.log(`2. Visit: http://localhost:3000/api/cron?date=${TARGET_DATE}`);
  console.log(`3. Check 'daily_consumption' collection for ${DEVICE_ID}_${ITEM_ID}_${TARGET_DATE}`);
}

seedData().catch(console.error);

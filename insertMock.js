import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDJvF_9cpWpfVpHedKVtxvxYdetGVu7lLA",
  authDomain: "smart-kitchen-935d1.firebaseapp.com",
  projectId: "smart-kitchen-935d1",
  storageBucket: "smart-kitchen-935d1.firebasestorage.app",
  messagingSenderId: "1026838934043",
  appId: "1:1026838934043:web:ee64e8e11859236783bebe",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const deviceId = "8857215964D";
  
  // Previous month is April 2026.
  const monthKey = "2026-04";

  const consumption = {
    item_1: { total_consumed: 14500, refill_count: 2 }, // Rice
    item_2: { total_consumed: 1200, refill_count: 1 },  // Tea powder
    item_3: { total_consumed: 850, refill_count: 1 },   // Salt
    item_4: { total_consumed: 3800, refill_count: 1 }   // Sugar
  };

  const analyticsRef = doc(db, 'analytics', deviceId, 'months', monthKey);
  await setDoc(analyticsRef, {
    device_id: deviceId,
    month: monthKey,
    consumption,
    updated_at: serverTimestamp()
  }, { merge: true });

  console.log("Successfully inserted mock data for previous month.");
  process.exit(0);
}

run().catch(console.error);

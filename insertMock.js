import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD0qQ3wuCrC-0zQPUaRN5RPrpImRVMlgO4",
  authDomain: "smartkitchen-8c101.firebaseapp.com",
  projectId: "smartkitchen-8c101",
  databaseURL: "https://smartkitchen-8c101-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "smartkitchen-8c101.firebasestorage.app",
  messagingSenderId: "702839426372",
  appId: "1:702839426372:web:85e0c92766e4b50f939b11",
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

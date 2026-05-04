import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, serverTimestamp, query, orderBy, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDJvF_9cpWpfVpHedKVtxvxYdetGVu7lLA",
  authDomain: "smart-kitchen-935d1.firebaseapp.com",
  projectId: "smart-kitchen-935d1",
  storageBucket: "smart-kitchen-935d1.firebasestorage.app",
  messagingSenderId: "1026838934043",
  appId: "1:1026838934043:web:ee64e8e11859236783bebe"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const NOISE_THRESHOLD_GRAMS = 5;
const AUTO_REFILL_THRESHOLD = 1000;

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function runTest() {
  const targetDate = "2026-05-02";
  const deviceId = "8857215964D";
  const items = ["item_1", "item_2", "item_3", "item_4"];

  console.log(`🧪 Testing Consumption Calculation for ${targetDate}...`);

  for (const itemId of items) {
    console.log(`\nProcessing ${itemId}:`);
    
    // 1. Fetch readings (Ordered by ID/Time)
    const readingsPath = `Kitchen_Readings/${deviceId}/${itemId}`;
    const snap = await getDocs(query(collection(db, readingsPath), orderBy("__name__", "asc")));
    
    if (snap.empty) {
      console.log(`  - No readings found. Skipping.`);
      continue;
    }

    const readings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`  - Found ${readings.length} readings.`);

    let dailyConsumption = 0;
    let refillCount = 0;
    let previousWeight = readings[0].curr_weight;

    // 2. Perform Delta Analysis
    for (let i = 1; i < readings.length; i++) {
      const currentWeight = readings[i].curr_weight;
      const delta = currentWeight - previousWeight;
      const absDelta = Math.abs(delta);

      if (absDelta < NOISE_THRESHOLD_GRAMS) continue;

      if (delta < 0) {
        // Consumption detected (weight dropped)
        dailyConsumption += absDelta;
      } else if (delta > AUTO_REFILL_THRESHOLD) {
        // Refill detected (weight increased)
        refillCount++;
      }
      
      previousWeight = currentWeight;
    }

    dailyConsumption = round2(dailyConsumption);
    console.log(`  - Result: ${dailyConsumption}g consumed, ${refillCount} refills detected.`);

    // 3. Save to days_consumption / deviceId / itemId / date
    const targetPath = `days_consumption/${deviceId}/${itemId}`;
    await setDoc(doc(db, targetPath, targetDate), {
      consumption: dailyConsumption,
      refill_count: refillCount,
      date: targetDate,
      device_id: deviceId,
      item_id: itemId,
      status: "SUCCESS_TEST",
      created_at: serverTimestamp()
    });

    console.log(`  - Saved to days_consumption/${deviceId}/${itemId}/${targetDate}`);

    // 4. Cleanup (Optional for test)
    // console.log(`  - Cleaning up raw readings...`);
    // for (const d of snap.docs) { await deleteDoc(d.ref); }
  }

  console.log("\n✅ Test completed successfully!");
  process.exit(0);
}

runTest().catch(console.error);

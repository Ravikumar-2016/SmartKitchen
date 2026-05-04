import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

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

async function run() {
  const deviceId = "8857215964D";
  const itemId = "item_1";
  
  // Calculate the window that the cron will process now
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const minutes = istNow.getUTCMinutes();
  const roundedMinutes = Math.floor(minutes / 6) * 6;
  const windowEndIST = new Date(istNow);
  windowEndIST.setUTCMinutes(roundedMinutes, 0, 0);
  windowEndIST.setUTCSeconds(0, 0);
  const windowStartIST = new Date(windowEndIST.getTime() - (6 * 60 * 1000));
  
  const windowStartTs = windowStartIST.getTime() - istOffset;
  const windowEndTs = windowEndIST.getTime() - istOffset;

  console.log(`Inserting test readings for window: ${windowStartIST.toISOString()} to ${windowEndIST.toISOString()}`);

  const baseWeight = 5000;
  const drops = [10, 20, 5, 15, 25]; // Total consumption: 75
  
  for (let i = 0; i < 6; i++) {
    const ts = windowStartTs + (i * 60 * 1000) + 1000; // spread across the 6 mins
    const weight = baseWeight - (drops.slice(0, i).reduce((a, b) => a + b, 0));
    
    await addDoc(collection(db, 'kitchen_Readings'), {
      device_id: deviceId,
      item_id: itemId,
      ts: ts,
      curr_weight: weight,
      created_at: serverTimestamp()
    });
    console.log(`  Inserted reading at ${new Date(ts).toISOString()}: ${weight}g`);
  }

  console.log("Success: Test readings inserted. Now trigger the cron job to process them.");
  process.exit(0);
}

run().catch(console.error);

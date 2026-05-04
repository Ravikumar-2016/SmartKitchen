import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

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

async function clearCollection(path) {
  try {
    const colRef = collection(db, path);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) return;
    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  } catch (e) {}
}

function formatIST(hour) {
  const day = "02";
  const month = "05";
  const year = "2026";
  const hourStr = String(hour).padStart(2, '0');
  return `${day}/${month}/${year}, ${hourStr}:30:00`;
}

async function run() {
  const deviceId = "8857215964D";
  const items = ["item_1", "item_2", "item_3", "item_4"];
  const targetDateStr = "2026-05-02";

  console.log("Regenerating readings and refills with new structure...");

  for (const itemId of items) {
    const readingPath = `Kitchen_Readings/${deviceId}/${itemId}`;
    const refillPath = `Refills/${deviceId}/${itemId}`;
    
    await clearCollection(readingPath);
    await clearCollection(refillPath);

    let currentWeight = 0;
    if (itemId === 'item_1') currentWeight = 22000;
    if (itemId === 'item_2') currentWeight = 12000;
    if (itemId === 'item_3') currentWeight = 6000;
    if (itemId === 'item_4') currentWeight = 15000;

    for (let hour = 0; hour < 24; hour++) {
      const timestampStr = formatIST(hour);
      const docId = `hour_${String(hour).padStart(2, '0')}`;

      const consumption = Math.floor(Math.random() * 150) + 50; 
      currentWeight -= consumption;

      // Practical Refills
      if ((itemId === 'item_1' && (hour === 8 || hour === 18)) || 
          (itemId === 'item_2' && hour === 12) ||
          (itemId === 'item_4' && hour === 20)) {
        
        const refillAmt = 5000;
        const previousWeight = currentWeight;
        currentWeight += refillAmt;
        
        const refillId = `refill_${hour}`;
        try {
          await setDoc(doc(db, refillPath, refillId), {
            amount: refillAmt,
            previous_weight: previousWeight,
            updated_weight: currentWeight,
            timestamp: timestampStr,
            date: targetDateStr,
            created_at: serverTimestamp()
          });
        } catch (e) {
          console.error(`  Failed to log refill for ${itemId}: ${e.message}`);
        }
      }

      if (currentWeight < 0) currentWeight = 0;

      await setDoc(doc(db, readingPath, docId), {
        curr_weight: currentWeight,
        timestamp: timestampStr,
        created_at: serverTimestamp()
      });
    }
    console.log(`  Done: ${itemId}`);
  }

  console.log("\nSuccess: Readings and Refills (in Refills collection) generated.");
  process.exit(0);
}

run().catch(console.error);

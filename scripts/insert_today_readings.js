import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

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
  const items = ["item_1", "item_2", "item_3", "item_4"];
  
  const now = new Date();
  // Start of today: 2026-05-03 00:00:00
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  
  console.log(`Inserting readings for today: ${startOfToday.toDateString()}`);

  for (const itemId of items) {
    let currentWeight = 0;
    if (itemId === 'item_1') currentWeight = 10000;
    if (itemId === 'item_2') currentWeight = 5000;
    if (itemId === 'item_3') currentWeight = 2000;
    if (itemId === 'item_4') currentWeight = 8000;

    console.log(`Processing ${itemId}...`);

    for (let hour = 0; hour <= 10; hour++) {
      const readingTime = new Date(startOfToday.getTime() + hour * 60 * 60 * 1000);
      
      // Consumption simulation
      let consumption = 0;
      if (hour > 0) {
        consumption = Math.floor(Math.random() * 100) + 20; // 20-120g drop
        currentWeight -= consumption;
      }

      // Refill simulation for item_2 at 5 AM
      let refillDetected = false;
      let quantityAdded = 0;
      if (itemId === 'item_2' && hour === 5) {
        quantityAdded = 3000;
        currentWeight += quantityAdded;
        refillDetected = true;
        console.log(`  [REFILL] Added 3000g to item_2 at 5:00 AM`);
      }

      if (currentWeight < 0) currentWeight = 0;

      const readingPath = `Kitchen_Readings/${deviceId}/${itemId}`;
      const readingsRef = collection(db, readingPath);

      await addDoc(readingsRef, {
        timestamp: readingTime.getTime(),
        weight: currentWeight,
        refill_detected: refillDetected,
        quantity_added: quantityAdded,
        timestamp_ist: readingTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        created_at: serverTimestamp()
      });

      console.log(`  Hour ${hour}: ${currentWeight}g (${readingTime.toLocaleTimeString()})`);
    }
  }

  console.log("\nSuccessfully inserted 11 readings (00:00 to 10:00) for 4 items.");
  process.exit(0);
}

run().catch(console.error);

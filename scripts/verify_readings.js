import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function verify() {
  const deviceId = "8857215964D";
  const items = ["item_1", "item_2", "item_3", "item_4"];
  
  console.log("Verifying Kitchen_Readings content...");
  for (const itemId of items) {
    const path = `Kitchen_Readings/${deviceId}/${itemId}`;
    const snap = await getDocs(collection(db, path));
    console.log(`${itemId}: ${snap.size} readings found.`);
    if (snap.size > 0) {
      console.log(`  Sample ID: ${snap.docs[0].id}`);
    }
  }
  process.exit(0);
}

verify().catch(console.error);

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

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

const mapping = {
  "item_1": "Sugar",
  "item_2": "Salt",
  "item_3": "Rice",
  "item_4": "Dal"
};

async function fixMappings() {
  const deviceId = "8857215964D";
  console.log(`Aligning items for device: ${deviceId}...`);

  for (const [itemId, name] of Object.entries(mapping)) {
    const itemRef = doc(db, 'items', deviceId, 'slots', itemId);
    const snap = await getDoc(itemRef);
    
    if (snap.exists()) {
      await updateDoc(itemRef, { 
        name: name,
        updated_at: serverTimestamp() 
      });
      console.log(`  Updated ${itemId} to "${name}"`);
    } else {
      // Create if missing
      await setDoc(itemRef, {
        name: name,
        capacity: 1000,
        threshold: 200,
        unit: 'g',
        current_quantity: 0,
        expiry_date: "2026-12-31",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      console.log(`  Created ${itemId} as "${name}"`);
    }
  }
  console.log("\nSuccess: UI and Hardware mappings are now synchronized.");
  process.exit(0);
}

fixMappings().catch(console.error);

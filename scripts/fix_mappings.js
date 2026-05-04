import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

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

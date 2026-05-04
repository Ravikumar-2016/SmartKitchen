# 🍲 Smart Kitchen: AI-Powered Inventory & Consumption Analytics

Smart Kitchen is a cutting-edge IoT ecosystem designed to automate pantry management and minimize food waste. By integrating high-precision weight sensors with a real-time cloud-native architecture, it provides households with predictive insights into their consumption patterns.

---

## 🚀 Key Features

- **Real-Time Inventory**: Track the exact weight of pantry staples (Rice, Sugar, etc.) in real-time.
- **AI Consumption Engine**: Automatically calculates daily usage using Exponential Moving Averages (EMA).
- **Predictive Analytics**: Estimates "Days Left" and "Threshold Alerts" based on learned usage patterns.
- **Waste Tracking**: Financial analysis of expired items and quantity lost.
- **Automated Refill Detection**: Smart logic to distinguish between consumption and refills.
- **Responsive Dashboard**: Premium, glassmorphic UI with dynamic charts and micro-animations.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, Vite, TailwindCSS, Recharts, Lucide Icons |
| **Backend** | Firebase (Firestore, Realtime Database, Cloud Functions) |
| **Authentication**| Firebase Auth |
| **Deployment** | Vercel (Frontend), Firebase CLI (Functions) |
| **Hardware** | ESP32/ESP8266, HX711 Load Cell Amplifier, 5kg/10kg Load Cells |

---

## 🔄 System Workflow

1.  **Sensing**: Load cells measure the weight of containers and send data to the **ESP32**.
2.  **Transmission**: ESP32 pushes raw weight logs to **Firebase Realtime Database (RTDB)**.
3.  **Processing**: A **Firebase Cloud Function** (triggered by RTDB changes) filters noise and calculates delta consumption.
4.  **Storage**: Aggregated daily consumption and item metadata are stored in **Firestore**.
5.  **Visualization**: The **React Web App** fetches Firestore data to display real-time status and analytics.

---

## 🔌 Hardware Guide

### Components Needed
- ESP32 or ESP8266 (NodeMCU)
- HX711 Amplifier Module
- 4x Load Cells (up to 10kg each for 4 slots)
- Custom 3D-printed or wooden base for containers

### Wiring Diagram (Standard HX711 to ESP32)
| HX711 Pin | ESP32 Pin |
| :--- | :--- |
| VCC | 3.3V / 5V |
| GND | GND |
| DT (Data) | GPIO 21 |
| SCK (Clock) | GPIO 22 |

### Connecting to Hardware
The hardware expects a REST or Socket connection to Firebase. The contract for raw logs is:
```json
{
  "timestamp": 1714824000000,
  "weight": 1450
}
```
Path in RTDB: `Devices/{device_id}/{slot_id}/{log_id}`

---

## 💻 Software Setup & Cloning

### 1. Clone the Repository
```bash
git clone https://github.com/Ravikumar-2016/SmartKitchen.git
cd smart-kitchen
```

### 2. Install Dependencies
```bash
npm install
cd functions && npm install && cd ..
```

### 3. Environment Configuration
Create a `.env.local` file in the root with your Firebase credentials:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Run Locally
```bash
npm run dev
```

---

## 🧪 Development Utilities

We have included several scripts in the `scripts/` directory to help you test the system without hardware:
- `npm run seed`: Seeds the analytics database with historical data.
- `node scripts/insert_today_readings.js`: Simulates real-time consumption for today.
- `node scripts/run_consumption_test.js`: Validates the EMA calculation logic.

---

## 🛡️ Security Note
This project utilizes environment variables for all sensitive credentials. Ensure that `.env.local` is never committed to version control. If you find any exposed secrets in the git history, rotate them immediately.

---

## 📄 License
MIT License - See [LICENSE](LICENSE) for details.

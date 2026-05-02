# Smart Kitchen Consumption Tracking

Smart Kitchen is an IoT inventory system that tracks pantry usage with ESP8266 + load cells, Firebase Realtime Database (raw logs), Firestore (metadata + daily aggregates), and Cloud Functions (consumption processor).

## Architecture

1. ESP8266 sends weight logs to RTDB.
2. Web app stores users/items metadata in Firestore.
3. Web app sends manual refill events to Firestore `daily_logs`.
4. Cloud Function listens to RTDB log creation and computes consumption.
5. Firestore stores per-day totals and event history.

## Data Model

### Realtime Database (raw logs)

Path: `Devices/{device_id}/{item_id}/{log_id}`

```json
{
  "timestamp": 1711281300000,
  "weight": 1450.2
}
```

### Firestore

`users/{user_id}`

```json
{
  "name": "Ravi",
  "email": "ravi@example.com",
  "device_id": "BCDDC2020C98",
  "created_at": "server timestamp"
}
```

`items/{device_id}_{item_id}` (fixed slots: `item_1`..`item_4`)

```json
{
  "device_id": "BCDDC2020C98",
  "item_id": "item_1",
  "name": "Rice",
  "capacity": 5000,
  "threshold": 1000,
  "expiry_date": "2026-12-01"
}
```

`consumption/{device_id}*{item_id}*{YYYY-MM-DD}`

```json
{
  "device_id": "BCDDC2020C98",
  "item_id": "item_1",
  "date": "2026-03-24",
  "total_consumption": 180.4
}
```

`daily_logs/{device_id}*{item_id}*{YYYY-MM-DD}`

```json
{
  "device_id": "BCDDC2020C98",
  "item_id": "item_1",
  "date": "2026-03-24",
  "events": [
    { "type": "reading", "time": 1711281300000, "weight": 1450.2 },
    { "type": "refill", "time": 1711281400000 }
  ]
}
```

## Cloud Function Logic

Trigger: `onValueCreated` at `/Devices/{device_id}/{item_id}/{log_id}`

Processing rules:

- Ignore missing/malformed logs
- Ignore negative weights
- Append each reading into `daily_logs.events` as `{ type: "reading", time, weight }`
- If last daily event is `refill`: use new reading as baseline and exit
- Auto refill detection: if weight increase is greater than threshold, append `{ type: "refill", time }` and exit
- Noise filter: ignore absolute weight changes `< 5g`
- If weight decreases: add `(prev_weight - current_weight)` to `consumption/{device_id}*{item_id}*{date}`

## Frontend Features Implemented

- Add item with fixed slot selection (`item_1` to `item_4`)
- Enforces one item per slot using Firestore doc ID: `{device_id}_{item_id}`
- Refill button writes manual refill event to Firestore `daily_logs`
- Device-aware item listing by slot order

## Setup

## 1) Install app dependencies

```bash
npm install
```

## 2) Configure environment

Create `.env` (or update `.env.local`) with:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 3) Run web app

```bash
npm run dev
```

## Cloud Functions Setup

This repo includes a `functions/` folder with the RTDB consumption trigger.

### 1) Install Firebase CLI (if needed)

```bash
npm install -g firebase-tools
```

### 2) Initialize Firebase project binding (once)

```bash
firebase login
firebase use <your_project_id>
```

### 3) Install functions dependencies

```bash
cd functions
npm install
```

### 4) Deploy functions

```bash
npm run deploy
```

## ESP8266 Payload Contract

For regular sensor logs, post:

```json
{
  "timestamp": <unix_ms>,
  "weight": <grams>
}
```

## Notes

- Keep RTDB and Functions in the same region (`asia-southeast1`) for lower latency.
- Do not delete raw logs; aggregation is append-only and date-based.
- The current function uses UTC day keys via `toISOString().slice(0, 10)`.
- Device IDs are stored in normalized format: remove `:` and `-`, then uppercase.

import admin from 'firebase-admin'

let appInstance = null

function parseServiceAccount(raw) {
  if (!raw) {
    throw new Error('Missing FIREBASE_ADMIN_KEY environment variable.')
  }

  const candidates = [raw]

  // Support base64-encoded JSON key to simplify Vercel env setup.
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8')
    if (decoded && decoded.trim().startsWith('{')) {
      candidates.push(decoded)
    }
  } catch {
    // Ignore decode failures and try plain JSON next.
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed.private_key) {
        parsed.private_key = String(parsed.private_key).replace(/\\n/g, '\n')
      }
      return parsed
    } catch {
      // Continue trying other candidate formats.
    }
  }

  throw new Error('FIREBASE_ADMIN_KEY must be valid JSON or base64-encoded JSON.')
}

export function getFirebaseAdmin() {
  if (appInstance) {
    return {
      firestore: admin.firestore(appInstance),
      database: admin.database(appInstance),
      admin,
    }
  }

  const databaseURL = process.env.FIREBASE_DB_URL
  if (!databaseURL) {
    throw new Error('Missing FIREBASE_DB_URL environment variable.')
  }

  const credential = admin.credential.cert(parseServiceAccount(process.env.FIREBASE_ADMIN_KEY))

  appInstance = admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        credential,
        databaseURL,
      })

  return {
    firestore: admin.firestore(appInstance),
    database: admin.database(appInstance),
    admin,
  }
}

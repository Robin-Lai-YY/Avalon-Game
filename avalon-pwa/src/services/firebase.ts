import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL
if (!databaseURL) {
  throw new Error(
    'Missing VITE_FIREBASE_DATABASE_URL. Copy .env.example to .env and add your Firebase config. See FIREBASE_SETUP.md.'
  )
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

export { app, db }

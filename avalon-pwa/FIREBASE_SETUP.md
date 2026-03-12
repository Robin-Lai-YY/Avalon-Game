# Firebase Setup (Tasks 5 & 6)

## Task 5 — Create Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or **Create a project**).
3. Enter a project name (e.g. `avalon-assistant`) and follow the steps (Google Analytics optional).
4. When the project is ready, click **Continue**.

## Task 6 — Enable Realtime Database

1. In the Firebase Console, open your project.
2. In the left sidebar, go to **Build** → **Realtime Database**.
3. Click **Create Database**.
4. Choose a location (e.g. `us-central1`) and **Next**.
5. Start in **test mode** for development (you can lock rules later), then **Enable**.
6. Note your **Database URL** (e.g. `https://YOUR_PROJECT-default-rtdb.firebaseio.com` or `https://YOUR_PROJECT-default-rtdb.REGION.firebasedatabase.app`).

## Connect the app (for Task 7)

1. In the project overview, click the **</>** (Web) icon to add an app.
2. Register the app with a nickname (e.g. "Avalon PWA"). Do not enable Firebase Hosting if you use Cloudflare Pages.
3. Copy the `firebaseConfig` object.
4. In the repo, copy `.env.example` to `.env` and fill in the values from the config and your Realtime Database URL:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...   # From Realtime Database tab
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Do not commit `.env` (it should be in `.gitignore`).

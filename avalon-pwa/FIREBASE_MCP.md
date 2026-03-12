# Using Firebase MCP to Set Up This Project

## Fix: 403 "The caller does not have permission" (cloudbilling.googleapis.com)

If the Firebase MCP log shows:

```text
FirebaseError: Request to https://cloudbilling.googleapis.com/v1/projects/carpals-470a2/billingInfo had HTTP Error: 403, The caller does not have permission
```

then the **project is selected** (e.g. `carpals-470a2`), but the **Google account you used for `firebase login` does not have permission** to access **Cloud Billing** for that project. The Firebase MCP / Firebase CLI tries to read billing info on startup and crashes when it gets 403.

**Pick one fix:**

### Option A – Use a project you own (recommended for Avalon)

1. Create a **new** Firebase project that you own: [Firebase Console](https://console.firebase.google.com/) → **Add project** → e.g. name it `avalon-assistant`.
2. In your Avalon app folder, point Firebase to that project:
   ```bash
   cd avalon-pwa
   firebase use --add
   ```
   Select the **new** project (e.g. `avalon-assistant`) and use alias `default`.
3. Restart or reload the Firebase MCP in Cursor. It should start without the billing 403.

### Option B – Get billing permission on the current project

If you must use **carpals-470a2**:

- Have a **project Owner** add your Google account in [Google Cloud Console](https://console.cloud.google.com/) → **IAM & Admin** → **IAM** with one of:
  - **Owner**, or
  - **Editor** plus the role **Cloud Billing** → **Billing Account Viewer** (or **User** if you will manage billing).
- Or in [Firebase Console](https://console.firebase.google.com/) → **carpals-470a2** → ⚙️ **Project settings** → **Users and permissions** → add your account as **Owner**.

Then run `firebase login` again with that account and reload the Firebase MCP.

### Option C – Ignore MCP and use the app

Realtime Database is free; you don’t need billing for Avalon. You can skip the Firebase MCP and set up manually:

1. In [Firebase Console](https://console.firebase.google.com/), use any project you can access (or create one).
2. Enable **Realtime Database**, add a **Web app**, copy the config and Database URL.
3. In `avalon-pwa`, copy `.env.example` to `.env` and fill in the values (see **FIREBASE_SETUP.md**).

The app will work; only the MCP will keep erroring until the billing permission issue is fixed.

---

## Fix: "Project not selected" / project did not selected correctly

Firebase CLI and the Firebase MCP need to know **which Firebase project** to use. That’s stored in a file called `.firebaserc` in the **same folder as `firebase.json`** (the `avalon-pwa` folder).

**Do this first:**

1. Open a terminal and go into the app folder:
   ```bash
   cd /Users/robinlai/Documents/Avalon\ Game/avalon-pwa
   ```
   (Or from the repo root: `cd avalon-pwa`.)

2. Link your Firebase project (this creates or updates `.firebaserc`):
   ```bash
   firebase use --add
   ```
   - If you see a list of projects: choose the one you use for Avalon (or create a new one in the [Firebase Console](https://console.firebase.google.com/) first, then run `firebase use --add` again).
   - When asked for an alias, press Enter to use `default`.

3. Confirm the project is set:
   ```bash
   firebase use
   ```
   You should see something like: `Active Project: your-project-id`.

4. **If the Firebase MCP runs from a different directory**, it may not see this `.firebaserc`. Ensure your Cursor workspace root or the MCP’s working directory is the **`avalon-pwa`** folder (where `firebase.json` and `.firebaserc` live). In Cursor: **File → Open Folder** and open `avalon-pwa` so the project root is the app folder.

**Manual alternative:** Copy `.firebaserc.example` to `.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID` with your real project ID from [Firebase Console](https://console.firebase.google.com/) → Project settings → General → Project ID.

**If you opened the parent folder ("Avalon Game") in Cursor:** The Firebase MCP may run from that folder and not see `firebase.json` (which is inside `avalon-pwa`). Then it won’t know the project. Fix: **File → Open Folder** and open the **`avalon-pwa`** folder so the workspace root is the app. Then run `firebase use --add` again in the terminal from `avalon-pwa`.

---

## 1. Get the Firebase MCP running

1. **Cursor Settings → MCP**  
   Find the **Firebase** (or `user-firebase`) server and check its status. If it shows an error, open the log to see why (e.g. missing CLI, not logged in).

2. **Install Firebase CLI and log in** (if needed):
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

3. **MCP config** (in Cursor MCP settings) should look like:
   ```json
   {
     "mcpServers": {
       "firebase": {
         "command": "npx",
         "args": ["-y", "firebase-tools@latest", "experimental:mcp"]
       }
     }
   }
   ```

4. Restart Cursor or reload the MCP server so the Firebase server starts without errors.

## 2. Link this app to a Firebase project

In the `avalon-pwa` folder:

```bash
cd avalon-pwa
firebase use --add
```

Pick (or create) a project and choose an alias (e.g. `default`). That creates/updates `.firebaserc`.

## 3. Create project and Realtime Database (if needed)

- **Via Firebase Console:**  
  [Firebase Console](https://console.firebase.google.com/) → Add project → Realtime Database → Create Database (test mode for dev).

- **Via Firebase MCP (once it’s running):**  
  Ask the assistant again: “Set up Firebase for this project using the Firebase MCP.”  
  The assistant can then use the MCP tools (e.g. create project, enable Realtime Database, get config) if the server is healthy.

## 4. Fill `.env`

After the project and Realtime Database exist:

1. Copy `.env.example` to `.env`.
2. In Firebase Console: Project settings → Your apps → Web app → copy `firebaseConfig`.
3. In Realtime Database tab, copy the **Database URL**.
4. Put the config values and Database URL into `.env` as in `FIREBASE_SETUP.md`.

## 5. Deploy rules (optional)

From `avalon-pwa`:

```bash
firebase deploy --only database
```

This deploys the test-mode rules in `database.rules.json` so the app can read/write `rooms`.

---

**Summary:** Fix the Firebase MCP (install CLI, log in, fix config, restart). Then you can ask the assistant to “set up Firebase using the Firebase MCP” and it can use the MCP tools for you. Until the MCP server is running, use the manual steps in `FIREBASE_SETUP.md`.

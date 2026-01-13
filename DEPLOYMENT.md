# Deployment

## What can be deployed on Vercel

- **Frontend** (`frontend/`): ✅ works well on Vercel (static SPA)
- **Backend** (`backend/`): ⚠️ not a good fit for Vercel because this project uses a **WebSocket server** (`ws`) on a long-lived Node HTTP server.
  - Vercel functions are serverless and don’t keep a persistent process alive, so WebSockets won’t be reliable.

Recommended: **Frontend on Vercel + Backend on Render/Railway/Fly**.

---

## Deploy Frontend to Vercel (recommended)

### 1) Push to GitHub
1. Create a GitHub repo
2. Push this folder to GitHub

### 2) Create a Vercel project
1. Vercel → **New Project** → import your repo
2. **Root Directory**: `frontend`
3. Build settings (usually auto-detected):
   - Build Command: `npm run build`
   - Output Directory: `build`

### 3) Set frontend environment variables (Vercel → Project → Settings → Environment Variables)
- `REACT_APP_API_URL` = `https://<your-backend-domain>/api`
  - Example: `https://quiz-backend.onrender.com/api`

Then redeploy.

---

## Deploy Backend (choose one)

### Option A: Render (simplest)
1. Create a new **Web Service** from your GitHub repo
2. Root Directory: `backend`
3. Build Command: `npm install; npm run build`
4. Start Command: `npm start`
5. Set environment variables:
   - `PORT` = `8080` (Render can override; ok either way)
   - `MONGODB_URI` = your Mongo connection string
   - `SESSION_SECRET` = a long random string
   - `FRONTEND_URL` = `https://<your-vercel-domain>`
   - `NODE_ENV` = `production`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (if using Google login)

#### Google OAuth callback URL
In Google Cloud Console set an authorized redirect URI:
- `https://<your-backend-domain>/api/auth/google/callback`

---

## Notes
- `frontend/vercel.json` is included to ensure React Router routes work on refresh.
- If you must host everything on Vercel, you’d need to remove/replace WebSockets (e.g., Ably/Pusher) and convert the backend to Vercel serverless functions.

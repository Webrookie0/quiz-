# Deployment

## What can be deployed on Vercel

- **Frontend** (`frontend/`): ✅ works well on Vercel (static SPA)
- **Backend** (`backend/`): ⚠️ not a good fit for Vercel because this project uses a **WebSocket server** (`ws`) on a long-lived Node HTTP server.
  - Vercel functions are serverless and don’t keep a persistent process alive, so WebSockets won’t be reliable.

Recommended: **Frontend on Vercel + Backend on Render/Railway/Fly**.

---

## Deploy Backend to Render (Recommended Blueprint)

This project includes a `render.yaml` file to make deployment extremely easy.

1.  Push your code to GitHub.
2.  Go to [Render Dashboard](https://dashboard.render.com/).
3.  Click **New +** -> **Blueprint**.
4.  Connect your GitHub repository.
5.  Render will automatically detect the `render.yaml` file.
6.  Click **Apply**.
7.  **IMPORTANT**: You will be asked to provide values for the environment variables defined in `render.yaml`:
    -   `MONGODB_URI`: Your MongoDB connection string.
    -   `GEMINI_API_KEY`: Your Google Gemini API key.
    -   `GOOGLE_CLIENT_ID`: Google OAuth Client ID.
    -   `GOOGLE_CLIENT_SECRET`: Google OAuth Client Secret.
    -   `FRONTEND_URL`: The URL of your deployed frontend (you can update this later after you deploy the frontend).

---

## Deploy Frontend to Vercel

1.  Push your code to GitHub.
2.  Go to [Vercel Dashboard](https://vercel.com/dashboard).
3.  Click **Add New...** -> **Project**.
4.  Import your GitHub repository.
5.  **Root Directory**: Click "Edit" and select the `frontend` folder.
6.  **Build Settings**: Leave as default (`npm run build`).
7.  **Environment Variables**:
    -   `REACT_APP_API_URL`: The URL of your deployed Render backend (e.g., `https://quiz-backend.onrender.com/api`).
        -   *Note: Make sure to include `/api` at the end.*
8.  Click **Deploy**.

---

## Final Step: Link them together

1.  After Frontend is deployed, copy its URL (e.g., `https://my-quiz-app.vercel.app`).
2.  Go back to your Render Dashboard -> Your Service -> **Environment**.
3.  Update `FRONTEND_URL` to match your Vercel URL.
4.  Render might redeploy automatically, or you can manually trigger a deploy.

## Notes
-   `frontend/vercel.json` is included to ensure React Router routes work on refresh.


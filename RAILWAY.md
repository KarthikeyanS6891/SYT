# Deploying SYT to Railway

This guide walks you through deploying the SYT marketplace to **Railway**
(https://railway.app) so your tester gets a permanent public URL — no
laptop tunnel needed.

End state: three Railway services in one project — **mongo**, **backend**,
and **frontend** — wired together with internal env-var references.

---

## 0. Prerequisites

- A GitHub account that already has access to your `SYT` repo.
- A Railway account: sign up at https://railway.app (free, GitHub OAuth).
- Have your **Google OAuth Client ID** handy if you want Google Sign-In to
  work in the deployed environment.

---

## 1. Create a Railway project from this repo

1. Open https://railway.app/dashboard and click **New Project**.
2. Choose **Deploy from GitHub repo** → pick `KarthikeyanS6891/SYT`.
3. Railway will auto-create a service and **immediately** start the
   first build. **Expect this build to fail in ~1 second** — there is
   no Dockerfile at the repo root, only inside `backend/` and
   `frontend/`. That's normal; we'll fix it in the next step.

> **If you see "Failed to build an image" / "Build failed in 1 second":**
> click into the auto-created service, open
> **Settings → Source → Root Directory**, enter `backend` (or `frontend`,
> for the second service), then go back to **Deployments** and hit
> **Redeploy** on the failed entry. The Root Directory tells Railway
> which subfolder to chdir into before reading the Dockerfile.

---

## 2. Add the **MongoDB** service

1. In the project canvas click **+ Add Service** → **Database** →
   **Add MongoDB**.
2. Wait ~30 s for the green dot. Railway exposes it as variables on the
   `Mongo` service:
   - `MONGO_URL` (the full connection URI Railway gave you)
   - `MONGOHOST`, `MONGOPORT`, `MONGOUSER`, `MONGOPASSWORD`, `MONGO_DATABASE`
3. (No env vars to set on this service — defaults are fine.)

---

## 3. Configure the **backend** service

1. Click the service Railway auto-created from the repo (Railway gives
   it a random name like `gracious-love`). Rename it via
   **Settings → General → Service Name → "backend"**.
2. **Settings → Source → Root Directory**: `backend`  ← **this is the
   fix for the 1-second build failure**
3. **Deployments** tab → three-dot menu on the failed deploy →
   **Redeploy**. This time Railway picks up `backend/railway.json`
   and `backend/Dockerfile` correctly.
4. **Networking → Generate Domain** → save the URL (looks like
   `https://syt-backend-production.up.railway.app`).
5. **Variables → Raw Editor** — paste this and replace the placeholders.
   ⚠️ **Do NOT add `PORT=...`** — Railway injects its own `$PORT` and
   the edge proxy routes only to that port. Our backend already reads
   `process.env.PORT`, so leave it alone.
   ```
   NODE_ENV=production
   API_PREFIX=/api/v1

   MONGODB_URI=${{Mongo.MONGO_URL}}

   JWT_ACCESS_SECRET=replace_me_with_64_random_hex_chars
   JWT_REFRESH_SECRET=replace_me_with_a_different_64_random_hex_chars
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=30d

   STORAGE_DRIVER=local
   UPLOAD_DIR=uploads

   PUBLIC_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
   CORS_ORIGINS=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}

   GOOGLE_CLIENT_ID=

   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX=300
   ```
   - Generate two long random strings for the JWT secrets, e.g.
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - Leave `GOOGLE_CLIENT_ID` blank if you're not using Google Sign-In.
   - The `${{Mongo.MONGO_URL}}` and `${{frontend.RAILWAY_PUBLIC_DOMAIN}}`
     references are Railway's variable interpolation — they resolve to
     whatever URL the other service has at deploy time.
6. **Settings → Volumes → Add Volume** → mount path `/app/uploads`
   (so uploaded images survive redeploys).
7. **Deploy** the service. Watch the build log; the healthcheck
   `/api/v1/health` should turn green within ~60 s.
8. Hit `https://<your-backend>.up.railway.app/api/v1/health` —
   you should see `{"status":"ok",...}`.

---

## 4. Add the **frontend** service

1. **+ Add Service → GitHub Repo → SYT** (same repo, second time).
2. Rename to **frontend**.
3. **Settings → Source → Root Directory**: `frontend`
4. **Networking → Generate Domain** → save the URL.
5. **Variables → Raw Editor**:
   ```
   PORT=80
   VITE_API_BASE=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}/api/v1
   VITE_SOCKET_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}
   VITE_GOOGLE_CLIENT_ID=
   ```
   Variables prefixed with `VITE_` are passed in as Docker `--build-arg`
   automatically (the Dockerfile declares them as `ARG`), so they get
   baked into the JS bundle at build time.
6. **Deploy**. The build runs `npm run build` then ships the static
   bundle through nginx.
7. Open the frontend URL in your browser. You should see the home page
   with the seeded listings.

---

## 5. Seed the database (once)

Railway's "Run command" feature lets you exec into the backend without
SSH. From the **backend** service:

1. Click the running deployment → **Exec** (or use the Railway CLI:
   `railway run --service backend npm run seed`).
2. Run: `npm run seed`
3. You'll see the familiar `[seed] inserted 81 categories...` output.
4. Demo creds are unchanged:
   - admin: `admin@syt.local / admin1234`
   - user:  `aisha@example.com / password123`

---

## 6. Google Sign-In (optional)

If you set `GOOGLE_CLIENT_ID` on both services, also do this:

1. Open https://console.cloud.google.com/apis/credentials → your
   OAuth 2.0 Client ID.
2. **Authorized JavaScript origins** → add the frontend URL, e.g.
   `https://syt-frontend-production.up.railway.app` (no trailing slash).
3. Save and wait ~5 minutes for Google to propagate.
4. Redeploy the frontend service so the client ID is rebaked into the
   bundle (only needed if you set it after the first deploy).

---

## 7. Send to your tester

That's it. Share the **frontend URL** from step 4 with your tester. They
can:
- Browse the seeded listings
- Click `Login` → use the demo accounts above, or sign up fresh
- Post a new ad with image upload (images persist in the volume)
- Chat with another seeded user via the floating Login modal
- Toggle light/dark theme
- File issues against the GitHub repo as they find them

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Frontend loads but API calls 404 | Check that the frontend's `VITE_API_BASE` resolved to the **backend's** URL (look at `view-source:` and search for "api/v1"). Redeploy frontend if needed. |
| `CORS blocked: https://...` in the browser console | Backend `CORS_ORIGINS` must contain the frontend's exact URL (https + no trailing slash). Update the var and redeploy backend. |
| `MongoServerError: bad auth` | The `${{Mongo.MONGO_URL}}` reference didn't resolve. Confirm Mongo service is named exactly `Mongo` (or change the reference). |
| Uploads work but images 404 in the browser | `PUBLIC_URL` on backend must equal the backend's actual public URL. Double-check the value in Variables. |
| Build fails on `tsc -b && vite build` | Locally run `npm run build` in `frontend/` to repro; usually a missing env type. |
| Mongo data wiped on redeploy | The MongoDB Railway plugin uses a managed volume — should persist by default. If you used a non-plugin Mongo, ensure `/data/db` is on a Railway volume. |

---

## Cost notes

- Railway gives every account **$5 of free trial credit** (~500 hrs of
  small services, plenty for staging).
- After that, hobby plan is **$5/mo per workspace** plus usage-based
  compute (this stack typically runs ~$3–7/mo).
- No payment method required during the trial. You'll get an email
  before any charges.

---

## Updating the deployment

Every push to `main` on GitHub triggers Railway to rebuild and redeploy
both services automatically. To deploy a feature branch instead, change
**Settings → Source → Branch** on each service.

Rollback: **Deployments tab → click an older successful deploy → Redeploy**.

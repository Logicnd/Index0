# Index0 — full deploy guide

This app has **two parts**:

| Part | Host | What it does |
|------|------|----------------|
| **Frontend** | Vercel | HTML, CSS, JavaScript in the browser |
| **Backend** | Render | Login, messages, Socket.IO chat |

The browser on Vercel talks **directly** to the Render URL for API and chat.  
Vercel does **not** run your Node server.

---

## Part A — one-time: GitHub

### Step 1

Open [https://github.com/Logicnd/Index0](https://github.com/Logicnd/Index0).

### Step 2

Confirm the latest code is on the `main` branch (includes `vercel.json`, `scripts/vercel-build.js`, `DEPLOY.md`).

### Step 3

Do not commit `.env`. It must stay local only.

---

## Part B — Render (backend)

### Step 4

Open [https://dashboard.render.com](https://dashboard.render.com) and sign in.

### Step 5

Click **New +** → **Web Service**.

### Step 6

Connect the **Logicnd/Index0** GitHub repository.

### Step 7

Set these fields exactly:

| Field | Value |
|-------|--------|
| **Name** | `index0-backend` (or keep your existing service name) |
| **Region** | closest to you |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance type** | Free |

### Step 8

Open **Environment** for that service and add these variables (use the **same** values as your local `.env` file):

| Key | Value |
|-----|--------|
| `JWT_SECRET` | copy from your local `.env` |
| `ADMIN_JWT_SECRET` | copy from your local `.env` |

Do not add `PORT` on Render; Render sets it automatically.

### Step 9

Click **Save Changes**.

### Step 10

Click **Manual Deploy** → **Deploy latest commit** and wait until status is **Live**.

### Step 11

Copy the service URL from the Render dashboard.  
It looks like: `https://index0-backend.onrender.com`  
This is your **BACKEND_URL** for the rest of this guide.

### Step 12

Test the backend in a browser:

`https://YOUR-BACKEND-URL.onrender.com/api/health`

You must see JSON like: `{"ok":true,"service":"index0-backend",...}`

If you see an error or the page spins for 60+ seconds, fix Render before continuing. Free tier sleeps; wake it by opening the URL once.

---

## Part C — Vercel (frontend)

### Step 13

Open [https://vercel.com/dashboard](https://vercel.com/dashboard) and sign in.

### Step 14

Click **Add New…** → **Project**.

### Step 15

Import **Logicnd/Index0** from GitHub.

### Step 16

Set these project settings:

| Field | Value |
|-------|--------|
| **Framework Preset** | Other |
| **Root Directory** | `./` (repo root) |
| **Build Command** | `npm run build` |
| **Output Directory** | `public` |
| **Install Command** | leave default |

### Step 17

Open **Environment Variables** and add these for **Production**, **Preview**, and **Development**:

| Key | Value |
|-----|--------|
| `BACKEND_URL` | your Render URL from Step 11, with no trailing slash, e.g. `https://index0-backend.onrender.com` |
| `JWT_SECRET` | same value as Render Step 8 |
| `ADMIN_JWT_SECRET` | same value as Render Step 8 |

Do **not** add `API_BASE_URL` on Vercel. The build uses `BACKEND_URL` automatically.

### Step 18

Click **Deploy** and wait until the deployment status is **Ready**.

### Step 19

Open your Vercel URL (e.g. `https://index0-teal.vercel.app`).

### Step 20

Press **Ctrl+Shift+R** (hard refresh) so the browser loads the new JavaScript.

### Step 21

Open DevTools → **Console**. You must **not** see `INDEX0_API_BASE` or config errors.

### Step 22

Sign up with a **new** test account or log in.

### Step 23

Confirm in the UI:

- Left sidebar shows **#general** and **#Join-Leave**
- Top status shows **Online** (not Offline)
- **USERS** count is at least 1
- Sending a message in **#general** keeps the message visible

### Step 24

Open admin: `https://YOUR-VERCEL-URL.vercel.app/admin`

---

## Part D — local development (every day)

### Step 25

Open a terminal in the project folder.

### Step 26

Ensure `.env` exists at the repo root (copy from `.env.example` and fill in secrets).

### Step 27

Run:

```bash
cd server
npm install
npm start
```

### Step 28

Open [http://localhost:3000](http://localhost:3000) in the browser.

Local uses `API_BASE_URL=http://localhost:3000` from `.env`; no Vercel or Render needed for daily coding.

---

## Part E — when you change code

### Step 29

Save files locally and test with Steps 25–28.

### Step 30

Commit and push to GitHub `main`:

```bash
git add .
git status
git commit -m "describe your change"
git push origin main
```

### Step 31

Vercel redeploys the frontend automatically from `main`.

### Step 32

Render redeploys the backend automatically from `main` if auto-deploy is on; otherwise use **Manual Deploy** on Render.

### Step 33

After changing `JWT_SECRET` or `ADMIN_JWT_SECRET`, update **both** Render and Vercel env vars, redeploy **both**, then clear site data in the browser and log in again.

---

## Part F — troubleshooting

| Symptom | Fix |
|---------|-----|
| **Offline**, USERS 0 | Render asleep or wrong `BACKEND_URL` on Vercel. Open `/api/health` on Render. Fix Step 17, redeploy Vercel Step 18. |
| Empty channel list | Hard refresh Step 20. Check Console for JS errors. |
| Login works locally, not on Vercel | `JWT_SECRET` / `ADMIN_JWT_SECRET` must match on Render and in Vercel Step 17. |
| `/admin` 404 | Redeploy Vercel; `vercel.json` must include `/admin` → `admin.html`. |
| Messages vanish | Redeploy Render (latest `server.js`). Clear `localStorage` and log in again. |
| Build fails “no public” | `npm run build` must run on Vercel; `outputDirectory` is `public`. |

---

## Secret checklist (all must match)

| Location | `JWT_SECRET` | `ADMIN_JWT_SECRET` | `BACKEND_URL` |
|----------|--------------|--------------------|---------------|
| Local `.env` | yes | yes | Render URL |
| Render env | yes | yes | not needed |
| Vercel env | yes | yes | yes |

Never commit `.env` to GitHub.

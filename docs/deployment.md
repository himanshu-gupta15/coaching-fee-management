# Deployment Guide

## Live deployment

| Part | Host | URL |
|---|---|---|
| Web app | Vercel | https://coaching-fee-management.vercel.app |
| API | Vercel (serverless function) | https://coaching-fee-api.vercel.app/api/health |
| Database | MongoDB Atlas free tier, connected through the Vercel integration | Not public |

Demo logins are in section 6. The API can be hosted on Vercel (section 3, Option C, used for the live deployment) or on Render (Options A and B).

## 1. Local setup

```bash
npm run install:all
cp server/.env.example server/.env    # fill in the values (see the table below)
cp client/.env.example client/.env    # leave VITE_API_URL empty locally

# Option A – no MongoDB needed (in-memory replica set, auto-seeded):
npm run dev:memory

# Option B – your own MongoDB or Atlas:
npm run seed        # WIPES the database in MONGODB_URI and loads demo data
npm run dev
```

The web app runs at http://localhost:5173 and the API at http://localhost:5001/api, with a health check at `/api/health`.

Run the tests:

```bash
npm test             # API tests
npm run test:e2e     # Playwright (installs nothing; run `npx playwright install chromium` once)
```

## 2. MongoDB Atlas

1. Create a project and a cluster. The free M0 tier is enough. Atlas clusters are replica sets, so **multi-document transactions are supported**, and the payment service uses them automatically.
2. Under **Database Access**, create a database user with *Read and write to any database*. Use a generated password.
3. Under **Network Access**, allow the Render service. The free Render tier has no fixed egress IP, so use `0.0.0.0/0` and rely on strong credentials. On paid Render plans, allow-list Render's static outbound IPs instead.
4. Under **Connect → Drivers**, copy the connection string and add a database name, for example:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/coaching_fee?retryWrites=true&w=majority`
5. Indexes are created automatically by Mongoose on first start, and by `syncIndexes()` during seeding.

## 3. Backend on Render

**Option A: Blueprint.** In Render, go to **New → Blueprint**, select the repository, and Render reads `render.yaml`. It defines one web service with `rootDir: server`.

**Option B: manual setup.** Create a **Web Service** with these settings:

| Setting | Value |
|---|---|
| Root directory | `server` |
| Runtime | Node 20+ |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |

Environment variables (names only; set the values in the Render dashboard):

```
NODE_ENV
MONGODB_URI
JWT_SECRET
JWT_EXPIRES_IN
CLIENT_URL
INSTITUTE_NAME
INSTITUTE_TZ_OFFSET_MINUTES
REMINDER_DAYS_BEFORE_DUE
```

- `NODE_ENV` must be `production`.
- `JWT_SECRET` must be a random string of at least 32 characters. The blueprint generates one.
- `CLIENT_URL` must be the exact Vercel origin, for example `https://your-app.vercel.app`, with no trailing slash. To allow several origins, separate them with commas.
- `PORT` is provided by Render. Do not set it.

**Seed the demo data once** (this wipes the target database). Use the Render **Shell**:

```bash
SEED_CONFIRM=yes npm run seed:prod
```

Or run it from your machine against Atlas:

```bash
cd server && MONGODB_URI="<atlas uri>" NODE_ENV=production SEED_CONFIRM=yes npm run seed
```

The seed refuses to run in production unless `SEED_CONFIRM=yes` is set.

> **Free-tier note:** Render free services sleep when idle, so the first request can take around 30–50 seconds. The in-process reminder job only runs while the service is awake. Use **Dashboard → Send fee reminders**, or schedule an external cron job.

**Option C: Vercel (used for the live deployment).** Create a Vercel project with `server` as its root directory. `server/vercel.json` and `server/api/index.ts` route every request to the Express app.

```bash
cd server
npx vercel@latest link --project coaching-fee-api
npx vercel@latest integration add mongodbatlas --meta clusterTier=FREE -e production   # sets MONGODB_URI
npx vercel@latest env add JWT_SECRET production     # repeat for the variables listed above
npx vercel@latest deploy --prod
```

Do not set `PORT`. Add the Atlas integration before the first real deploy, or redeploy afterwards so the API picks up `MONGODB_URI`. The in-process reminder job does not run on serverless, so send reminders from **Dashboard → Send fee reminders**. Rate limits are counted per running instance.

## 4. Frontend on Vercel

1. **Add New → Project**, then import the repository.
2. Set **Root Directory** to `client`. The framework preset is **Vite**: build command `npm run build`, output directory `dist`.
3. Add one environment variable, `VITE_API_URL`, set to the Render URL, for example `https://coaching-fee-api.onrender.com`, with no trailing slash.
4. Deploy. `client/vercel.json` rewrites all paths to `index.html`, so deep links such as `/parent/payments` work.
5. Copy the final Vercel URL into Render's `CLIENT_URL` and redeploy the API, so that CORS and password-reset links use the correct origin.

## 5. Post-deploy checklist

- [ ] `GET https://<api>/api/health` returns `{"success":true,...}`.
- [ ] Logging in as the admin shows a populated dashboard.
- [ ] Logging in as a parent shows only that parent's children.
- [ ] Recording a payment produces a downloadable PDF receipt.
- [ ] Reports → CSV export downloads a file.
- [ ] The browser console shows no CORS errors. If it does, check that `CLIENT_URL` exactly matches the Vercel origin.

## 6. Demo login credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@brightpath.edu` | `Admin@123` |
| Parent | `rajesh.sharma@example.com` | `Parent@123` |
| Parent | `sunita.verma@example.com` | `Parent@123` |
| Parent | `imran.khan@example.com` | `Parent@123` |
| Student | `aarav.sharma@student.example.com` | `Student@123` |
| Student | `ananya.sharma@student.example.com` | `Student@123` |
| Student | `rohan.verma@student.example.com` | `Student@123` |
| Student | `zara.khan@student.example.com` | `Student@123` |
| Student | `kabir.khan@student.example.com` | `Student@123` |

These are fictional demo accounts. Change or remove them before using the system with real data.

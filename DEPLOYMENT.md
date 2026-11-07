# Deploying SportSync: GitHub + Render (backend) + Vercel (frontend)

How it fits together
- Vercel serves the React site.
- Render runs the Express API.
- MongoDB Atlas stores the data.
- `vercel.json` forwards every `/api/...` request from the Vercel site to Render.
  The browser therefore only ever talks to the Vercel address, so the login
  cookie is first-party and there are no cross-site cookie or CORS problems.

## 1. Test locally first
1. Copy the updated project files over your folder (keep your own `.env`).
2. Stop and restart both: `npm run server` and `npm run dev` (Vite config changed).
3. Log in at http://localhost:5173 and click through a few pages.

## 2. MongoDB Atlas
1. Atlas > Network Access > Add IP Address > **Allow access from anywhere** (0.0.0.0/0).
   Render's free plan has no fixed IP, so this is required. Use a strong database password.
2. Atlas > Database > Connect > Drivers: copy your connection string. This is `MONGODB_URI`.
   Keep using the same database to keep your existing data and Admin account.

## 3. GitHub
1. Install Git, then once: `git config --global user.name "Your Name"` and
   `git config --global user.email "you@example.com"`.
2. github.com > New repository. Name it (e.g. `sportsync-academy`), choose Private
   (recommended) or Public, and do NOT add a README/.gitignore. Create it.
3. In PowerShell:
   ```
   cd "S:\New folder\sports-academy-ui"
   git init
   git add .
   git status
   ```
   Check the list: `.env` and `node_modules` must NOT appear. (`git check-ignore -v .env` should print a rule.)
4. ```
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```
   A browser window asks you to sign in to GitHub the first time.

## 4. Backend on Render
1. render.com > sign up with GitHub > New > Web Service > pick your repo.
2. Settings: Language Node, Build Command `npm install`, Start Command `npm start`,
   Instance Type Free, Region closest to your Atlas region and users.
3. Environment variables:
   - `MONGODB_URI` = your Atlas string
   - `JWT_SECRET` = generate with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `ADMIN_SETUP_KEY` = another long random string
   - `NODE_ENV` = `production`
4. Create Web Service. Wait for "Live". Open the `https://….onrender.com` address:
   you should see `{"message":"Sports Academy API is running!"}`.
   In the Logs you should see MongoDB connected and the API mounted lines.

## 5. Point Vercel at Render
1. Open `vercel.json`, replace `REPLACE-WITH-YOUR-RENDER-URL.onrender.com` with your real Render host.
2. ```
   git add vercel.json
   git commit -m "Set backend URL"
   git push
   ```

## 6. Frontend on Vercel
1. vercel.com > sign up with GitHub > Add New > Project > import the repo.
2. Framework Preset should auto-select Vite (build `npm run build`, output `dist`). No environment variables needed.
3. Deploy. You get `https://YOUR-PROJECT.vercel.app`.

## 7. Finish and test
1. Render > Environment: add `CLIENT_ORIGIN` = your Vercel address (no trailing slash). Save (it redeploys).
2. Open the Vercel address and log in. The first request after the backend has been idle can take 30-60 seconds (free plan wake-up).
3. Only if you use a NEW empty database, create the first Admin (PowerShell):
   ```
   Invoke-RestMethod -Method Post -Uri https://YOUR-PROJECT.vercel.app/api/auth/setup-admin -ContentType "application/json" -Body '{"username":"admin","password":"YOUR-STRONG-PASSWORD","setupKey":"YOUR-ADMIN_SETUP_KEY"}'
   ```
4. Test: log in for each role, upload a player photo, change a password, deactivate and re-login.

## 8. Updating later
Edit, then `git add .`, `git commit -m "message"`, `git push`. Vercel and Render redeploy automatically.

## Known limits
- Render free backend sleeps after 15 minutes idle (slow first load). A paid instance removes this.
- Free hosting has no uptime guarantee; check current limits on each platform's pricing page.
- Large base64 photo uploads go through Vercel's proxy; test an upload after deploying.
- Login has no rate limiting yet; add before real public use.

# SportSync Academy Manager

Web-based management system for a sports academy: players, coaches, scouts,
attendance, matches, trial readiness and role-based accounts (Admin, Coach,
Scout, Player).

- Frontend: React + Vite
- Backend: Node.js + Express 5
- Database: MongoDB Atlas (Mongoose)
- Auth: JWT in an HTTP-only cookie

## Run locally

1. Install Node.js 20 or newer.
2. `npm install`
3. Copy `.env.example` to `.env` and fill in the values.
4. In one terminal: `npm run server`
5. In another terminal: `npm run dev`, then open http://localhost:5173

The frontend calls `/api/...`; in development Vite forwards that to
http://localhost:5000 (see `vite.config.js`).

## Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md): frontend on Vercel, backend on Render,
database on MongoDB Atlas.

## Security

Never commit `.env`. Secrets belong in the hosting platforms' environment
variable settings.

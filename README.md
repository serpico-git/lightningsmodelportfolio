# Lightning Model Portfolio

Tracks a personal model portfolio's performance against the Nifty 50, updated
automatically in the background so page loads stay fast.

## Structure

- `backend/` — Cloudflare Worker (Hono). Serves `/api/portfolio`, and a
  scheduled job that refreshes prices/history from Yahoo Finance into KV.
- `frontend/` — Vite + React site that reads from the backend API.

## Backend setup

    cd backend
    npm install
    npx wrangler kv namespace create PORTFOLIO_CACHE   # first time only
    # paste the returned id into wrangler.toml
    npm run dev

## Frontend setup

    cd frontend
    npm install
    npm run dev

Set `VITE_API_URL` in `frontend/.env` to point at the deployed backend URL
once live (defaults to `http://127.0.0.1:8787` for local dev).

## Deployment

    cd backend
    npm run deploy      # deploys Worker + registers cron triggers

Frontend deploys via Cloudflare Pages, connected to this repo
(root directory: `frontend`).

## Disclaimer

Educational/research tracking only. Not investment advice. Not a
SEBI-registered advisor or research analyst.
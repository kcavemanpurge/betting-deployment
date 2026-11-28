# Sovereign Betting & Financial Settlement Platform

A Vite + React frontend for the Sovereign Bets interface, Aviator flight simulation, vector canvas, virtual football simulator, sports odds portal, and account UI. The repository also contains Netlify Functions and database assets from the original Netlify deployment.

## Frontend entrypoints and display ownership

- The Render site root is built from `index.html` → `src/main.jsx` → `src/App.jsx`.
- `src/App.jsx` chooses the Aviator interface (`src/components/AviatorEngine.jsx`) or vector interface (`src/components/BettingCanvas.jsx`) and the football/odds views.
- `src/index.css` is the canonical global stylesheet and imports Tailwind CSS. Components imported by `src/App.jsx` are the active React UI.
- Files under `public/` are standalone static pages/assets copied into `dist/`; they do not replace the React app at `/`.
- `src/components/src/index.css` was an incorrectly nested, unused file containing JavaScript rather than CSS. It is not part of the build; the canonical stylesheet remains `src/index.css`.

## Render static-site deployment

`render.yaml` configures a Render Static Site:

- Build: `npm ci && npm run build`
- Publish directory: `dist`
- The Vite build emits the React app at `/` and copies standalone `public/*.html` pages to their corresponding paths. There is no catch-all rewrite, so real static pages and assets can be served at their own URLs.

Connect `kcavemanpurge/betting-deployment` to Render and deploy the Blueprint from `render.yaml`. The Render dashboard's build and publish settings should match the values above.

## Important backend boundary

Render Static Sites host only generated frontend files. They do **not** run the repository's Netlify Functions, database migrations, or PostgreSQL services. The React and standalone pages currently call endpoints such as `/.netlify/functions/settle`, `/.netlify/functions/round`, `/.netlify/functions/live-odds`, and `/.netlify/functions/withdraw`. Those API-backed features will not work on Render unless the functions remain deployed on Netlify and the frontend is configured to call that backend, or the backend is migrated to a service that supports server-side functions. Never treat client-side simulation or local storage as a secure, authoritative financial ledger.

## Local development

```bash
npm ci
npm run dev
npm run build
npm run preview
```

## Original Netlify backend assets

- `netlify/functions/`: serverless API functions
- `netlify/database/migrations/`: database migration files
- `db/` and `schema.sql`: database schema sources
- `server/services/`: settlement-service code

These assets are retained for the existing Netlify architecture; they are not executed by the Render static-site build.

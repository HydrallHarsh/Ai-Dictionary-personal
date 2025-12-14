# Ai-Dictionary

a platform where ai meets developers

## Current Progress

- [x] Initial Next.js project setup
- [x] Theme provider and Dark/Light mode toggle
- [x] Basic UI components (Hero Section, Latest Insights)
- [ ] Backend integration (Pending)
- [x] Authentication 

## Frontend — Run locally

These instructions assume you're on Windows using PowerShell (your environment). The frontend lives in the `frontend/` folder and is a Next.js app.

Prerequisites

- Node.js (recommended v18+ or latest LTS)
- pnpm package manager (install with `npm i -g pnpm` if needed)

Run in development mode

```powershell
cd .\frontend
pnpm install --frozen-lockfile
pnpm dev
```

Open your browser at: http://localhost:3000 (or the port reported by the dev server)

Build and run production locally

```powershell
cd .\frontend
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Notes

- Static assets in `frontend/public/` are served from the site root (use `/filename.ext` in `src`).
- Your `.gitignore` already excludes build output (`.next/`) and node modules — good to keep those out of the repo.
- If you need environment variables, create a `.env.local` inside `frontend/` (do not commit it).

Troubleshooting

- If the page appears blank, check the browser console and terminal for compile errors.
- Ensure the SVG/image files exist in `frontend/public/` and paths match exactly.
- If lint or format rules block a commit, run `pnpm lint` or adjust the staged files and commit only the intended changes.

## DB SETUP

### Install Supabase Locally first - ([supabase-cli-setup](https://github.com/supabase/cli?tab=readme-ov-file#install-the-cli))

#### Take the latest PR pull in local

#### Use Command - `supabase start` will pull all the docker images

#### After the docker container starts running use command `supabase migration up` to apply migrations to local schema

#### Optional Setup: `supabase link` to link the prod db - *For Members only to push new changes to db Schema*

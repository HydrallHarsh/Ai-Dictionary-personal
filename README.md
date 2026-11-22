# AI Dictionary

There is more AI news than anyone can keep up with. AI Dictionary makes it easier to catch up: it gathers articles from across the field, turns them into readable summaries, and keeps them together in one archive.

It is built for curious developers, researchers, and anyone trying to make sense of what is changing. If an entry catches your eye, follow its source link for the full story.

## Vision

AI moves quickly, and keeping up can mean jumping between dozens of feeds, blogs, and research sites. We want to make that a little easier: bring useful work into one place, make it easier to understand, and keep a clear path back to the people who published it.

## What We’re Building

AI Dictionary is a searchable archive of AI and developer news. The collection pipeline gathers articles from multiple sources, filters duplicates, and prepares summaries and explanations. The website makes those entries easier to browse by date and source, while keeping the original article close at hand.

It is a work in progress. Sources change, the pipeline needs care, and there is always room to make the reading experience better.

The repository contains three applications:

- `frontend/` — Next.js site for browsing the archive and reading articles.
- `backend/` — FastAPI services, source adapters, and database access.
- `langgraph_bot/` — workflows for filtering, deduplicating, and preparing articles for publication.

You do not need to run all three to work on the site. Start with the frontend, then add the backend or processing workflow when you need them.

## Features

### Multi-source ingestion

The backend has a separate adapter for each source, so feeds and APIs can be normalized into the same record format before they enter the pipeline. Active trigger sources are arXiv, GitHub Trending, AI-filtered Hacker News, and official lab blogs. As described in [Plan.md](Plan.md#why-the-source-list-changed), NewsAPI, MarkTechPost, and Product Hunt are retired from ingestion: they provide too much unrelated news, already-processed reporting, or too little product detail.

### Queued article processing

Incoming items are stored in Supabase before processing. The workflow claims pending records, checks relevance, and uses 768-dimensional Gemini embeddings with PostgreSQL `pgvector` cosine similarity to catch near-duplicates before generating an article. LangGraph then prepares titles, summaries, descriptions, and other content. Each item moves through a recorded processing status, so failures and skipped items can be inspected without losing the queue.

### Searchable article archive

The Next.js site presents published posts in an archive with search, month navigation, and source filters. Article pages render sanitized Markdown, build a table of contents from headings, and keep source information alongside the generated summary. Public pages use a read-only Supabase client and revalidate hourly so shared article data can be cached.

### Pipeline visibility

Public pages include counts from the processing pipeline, giving readers a view of what has been collected and published.

Generated summaries are a starting point, not a replacement for the original reporting or research. Each article keeps its source so readers can follow the story back to where it came from.

## How the pieces fit together

```text
Sources
  → backend adapters
  → Supabase processing queue
  → triage, deduplication, and LangGraph workflows
  → published posts in Supabase
  → Next.js archive and article pages
```

The adapter layer handles source-specific fetching and normalization. The processing workflow works from the shared queue, and the frontend reads published posts for the archive and article pages.

## Tech stack

| Area | Technologies |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI, SQLAlchemy |
| Processing | Python, LangGraph, LangChain, Gemini embeddings |
| Data | Supabase, PostgreSQL, pgvector |
| Tooling | pnpm, uv, Biome, Ruff |

## Repository layout

```text
.
├── frontend/       # Next.js application
├── backend/        # FastAPI, ingestion adapters, and database repositories
├── langgraph_bot/  # LangGraph processing workflows
└── supabase/       # Local Supabase configuration and SQL migrations
```

## Development setup

For local development, you will need:

- Node.js 20.9 or later and pnpm
- Python 3.12.5 and [uv](https://docs.astral.sh/uv/)
- [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker, for local database development

### Frontend

The site reads its article data from Supabase. Create `frontend/.env.local` with your project URL and publishable key:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Install dependencies and start the development server:

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Backend

Create `backend/.env` with the Supabase connection values required by the backend. Add provider credentials for the integrations you want to try; you can leave out keys for sources you are not using.

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-server-side-key
ALLOWED_ORIGINS=http://localhost:3000
ENVIRONMENT=development
AUTH_SECRET=replace-with-a-random-secret-of-at-least-32-bytes
DATABASE_URL=postgresql+asyncpg://postgres:your-password@localhost:5432/postgres
```

Install dependencies and run the API from the repository root:

```bash
uv sync --project backend
uv run --project backend uvicorn backend.main:app --reload
```

The API is available at [http://localhost:8000](http://localhost:8000). Use `localhost` for both the frontend and API during development so the session cookie stays on the same site. Development uses an HTTP-compatible `SameSite=Lax` cookie; production uses `Secure` and `SameSite=None` and requires HTTPS.

Accounts and bookmarks use a separate PostgreSQL database, configured by `DATABASE_URL`. Provision that database before starting the API. The existing startup hook creates missing account tables; changing their schema requires a separate versioned migration process. `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME`, and `DB_PASSWORD` are also supported when a URL is unavailable. Passwords with special characters work through those individual variables. The account database defaults to port 5432; local Supabase uses 54322. A PostgreSQL URL with `sslmode` is translated for the asyncpg driver.

Generate `AUTH_SECRET` with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Production refuses missing or short signing secrets. Keep the Supabase server key exclusively in backend/worker configuration. Public frontend variables accept only publishable or legacy anon keys, and the build rejects server keys before bundling them.

GitHub ingestion can use `GITHUB_TOKEN`; generation uses the model-provider credentials below. The retired scrapers' credentials are not needed for active ingestion. Keep credentials in environment files and do not commit them.

### Ingestion and processing workflows

From the repository root, the ingestion runner fetches items from its configured adapters and queues new records in Supabase:

```bash
uv run --project backend python -m backend.services.ingestion.runner
```

The LangGraph workflow processes queued records and writes completed articles:

```bash
uv run --project langgraph_bot python -m langgraph_bot.main
```

Both applications need their required Supabase and provider credentials in the environment. The worker requires `GROQ_API_KEY`, `GOOGLE_API_KEY` (Gemini embeddings), and `TAVILY_API_KEY` as well as the Supabase server configuration. It validates missing configuration before claiming work.

The daily Actions workflow uses the same four trigger adapters. The embedding credential belongs to the pending stacked-PR rollout; generation needs `GOOGLE_API_KEY` in the workflow environment's GitHub secrets when enabled. Workflow runs are serialized, and the worker claims one item at a time. Triage and dedup nodes already have a three-attempt LangGraph retry policy, and model clients also retry requests. After those attempts fail, the worker exits unsuccessfully and releases unsettled claims for a later run. Previously published raw items are reconciled before generation. Automatic recovery of abandoned claims and scheduling bounded retries for failed queue records remain database-dependent follow-up work after the schema PRs are reviewed.

Manual integration checks live in `manual_mtp_scraper.py`, `manual_ph_wrapper.py`, and `manual_agent.py`. They use live services only when explicitly run and are excluded from unit-test collection.

If you are only changing the site, you can skip these workflow commands.

### Local Supabase

From the repository root, start the local Supabase services and apply the migrations:

```bash
supabase start
supabase db reset
```

`supabase db reset` recreates the local database and applies the migrations in `supabase/migrations/`. Use project-specific credentials and follow the Supabase CLI instructions before connecting to a hosted project.

The redesigned production schema is intentionally pending the stacked PR reviews and PR #120. Do not apply or modify production migrations as part of this fix set. The new frontend and worker require the reviewed schema before production rollout.

### Production build

```bash
cd frontend
pnpm build
pnpm start
```

### Checks

Frontend linting uses Biome only. Backend Python projects use `uv`; Ruff is configured in `backend/`.

```bash
cd frontend
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

See [CHANGELOG.md](CHANGELOG.md) for project history.

For a build check without a real Supabase database, use `pnpm build:offline`. It replaces the Supabase endpoint and key only in the child build process with a local HTTP fixture, and writes test artifacts to `.next-offline`. These artifacts are for validation only. Normal production builds still use your configured project. Run Python unit tests from the root with `uv run --project backend python -m pytest`; the test fixtures use fake credentials and block external network connections. Pull requests run these checks automatically.

## Contributing

Found a bug, have an idea for a source to add, or want to improve the site? Contributions are welcome. Open an issue to talk through a larger change, or send a pull request for a fix or improvement. If you are unsure where to start, an issue is a good place to ask.

---

**Built with ❤️ by developers, for developers.**

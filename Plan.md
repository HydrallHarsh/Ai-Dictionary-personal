# AI Dictionary — Improvement Plan

A step-by-step guide to turning the current codebase into something architecturally
solid and worth showing off. Each phase is self-contained and committable on its own.

> **Revision note (2026-07-22):** This plan was reconciled against the code actually
> in the repo. In particular, an untracked migration
> `supabase/migrations/20260618121728_redesign_schema.sql` already implements most of
> Phase 1 — but it differs from the original plan in several ways (no pgvector column,
> a different `status` enum, an extra slug CHECK constraint). Those differences are
> called out inline as **⚠ Reconcile** notes. Read them before running anything.

---

## Phase 0 — Reconcile with what already exists

Before touching anything, understand the current state so the phases below don't
fight the code that's already here.

**Already done (untracked, not yet committed/applied):**
- `supabase/migrations/20260618121728_redesign_schema.sql` — adds `status`,
  `retry_count`, `last_error`, `source_type` to `raw_api_data`; creates flat
  `posts_v2`, backfills it from the JSONB `post_content`, repoints the junction-table
  FKs, renames `posts→posts_old` / `post_content→post_content_old` / `posts_v2→posts`,
  indexes `posts(slug)` and partial-indexes `raw_api_data(status)`, and drops the
  `create_post_with_content` RPC.
- `backend/services/ingestion/base.py` — an adapter-pattern skeleton (`RawData` +
  abstract `SourceAdapter`). Currently unused by any code.

**Not yet done (still on the old design):**
- No pgvector / `embedding` column anywhere, no `match_posts` RPC.
- LangGraph bot still writes the **old** two-table JSONB schema
  (`langgraph_bot/insert_bot_data.py`) and reads pending work by **date range**
  (`fetch_last_days_posts`), not by `status`. No triage or dedup node exists.
- Frontend (`frontend/lib/blog-data.ts`) still queries `post_content` and unwraps
  the JSONB blob; slug lookup is a client-side `.find()` over all posts.
- Scheduling is a single daily GitHub Actions cron
  (`.github/workflows/run_workflow.yml`, `35 4 * * *`) running scrapers then the bot.
  No Redis / ARQ.
- The three current scrapers (NewsAPI, MarkTechPost via Firecrawl, Product Hunt) do
  **not** use `base.py`.

**Decisions to make before Phase 1 (resolve these first — later phases depend on them):**

1. **Status vocabulary — DECIDED.** The existing migration uses
   `('pending', 'inprocess', 'skipped', 'failed')` and has **no terminal success
   state**. The workflow needs one. Standardize on:
   `('pending', 'processing', 'succeeded', 'skipped', 'failed')`
   and use these exact strings everywhere (migration CHECK, `update_status`, worker
   queries). Every later snippet in this plan uses these.
   - `pending` — freshly ingested, not yet picked up.
   - `processing` — a bot run has claimed it (guards against double-processing).
   - `succeeded` — a post was generated and inserted.
   - `skipped` — filtered out by triage or dedup (not an error; `last_error` records why).
   - `failed` — an exception during processing (`last_error` + `retry_count` set).

2. **Embedding provider + dimension — DECIDED: Gemini / `vector(768)`.**
   pgvector's column dimension is fixed at creation and must match the model.
   Using **Gemini `gemini-embedding-001` at `output_dimensionality=768` → `vector(768)`**:
   fully free, reuses the
   `GEMINI_API_KEY` you already have, and needs no new dependency
   (`langchain-google-genai` is already installed). `768` is used consistently below
   in the column, both RPC signatures, and the dedup node.

   > What the embedding is *for*: this vector is **not** a user-facing search box (the
   > plan has none). It powers two internal features — **semantic dedup** (don't
   > generate a second post about the same release) and **related posts** ("you might
   > also like", semantic instead of tag-matching). The same column makes a real search
   > bar trivial to add later: embed the user's query and run the same `<=>` similarity.

---

## Phase 1 — Database Schema Redesign
**Goal:** Replace the fragile split-table + JSONB blob design with a clean, queryable
schema, and add pgvector for semantic features.
**Demonstrates:** Proper relational design, pgvector, migration discipline.

> **⚠ Reconcile:** Most of Steps 1.2 are already in
> `20260618121728_redesign_schema.sql`. Do **not** write a second migration that
> re-creates `posts_v2`. Instead, **amend that migration** (it isn't committed yet)
> to add the four things it's missing: pgvector, the `embedding vector(768)` column,
> RLS on the renamed table, and the corrected status enum. Steps below are framed as
> amendments.

### Step 1.1 — Enable pgvector
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
Run this once (Supabase SQL editor, or as the first statement of the migration)
**before** any statement that references `vector(...)`.

### Step 1.2 — Amend the existing migration

**(a) Fix the status enum + add the ingestion-support columns** — the existing CHECK is
missing a success state, and two columns back the adapter layer (`metadata`, `content`):
```sql
-- was: CHECK (status in ('pending','inprocess','skipped','failed'))
ALTER TABLE raw_api_data
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'skipped', 'failed')),
  ADD COLUMN IF NOT EXISTS retry_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS source_type text
    CHECK (source_type IN ('rss', 'api', 'scraper', 'other')),
  -- generic per-source signal bag: HN points/comments, GitHub stars, etc.
  -- jsonb (not fixed columns) so a new source's signals need no schema change.
  -- Backs RawData.engagement_meta.
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  -- full article body when a feed ships it (RSS content:encoded), else NULL.
  -- Backs RawData.content. Persisted (not in-process) because ingestion and
  -- generation are decoupled through the DB — see the note in Step 2.4.
  ADD COLUMN IF NOT EXISTS content text;
```

**(b) Add the embedding column** to the new posts table (Gemini `gemini-embedding-001`
→ truncated to 768 dimensions):
```sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS embedding vector(768);
```
(If amending in-place, add `embedding vector(768)` directly to the `posts_v2`
`CREATE TABLE` instead.)

**(c) The backfill is mostly fine — with one fix.** Verified: `generated_image` in the
old JSONB is a **public storage URL** (`insert_bot_data.py` uploads to the `post-images`
bucket and stores `get_public_url(...)`), so mapping `content->>'generated_image'` →
`image_url` is correct — no bytes/base64 leak.

> **⚠ Fixed:** The original SELECT mapped `p.source` into **both** `source_url` **and**
> `source_name`. But `posts.source` is a source *name* (e.g. `"Hacker News"`,
> `"MarkTechPost"`), **not a URL** — the bot never persisted the article URL onto the
> posts side, and `website` lives only on `raw_api_data` with no stable key to join
> back (`title` is LLM-rewritten, so a join would mis-attribute URLs). Filling
> `source_url` with a name is worse than leaving it empty. **The backfill now writes
> `NULL::text` for `source_url` on old posts.** The URL is genuinely unrecoverable for
> historical rows; new posts get it directly from the pipeline (see Phase 3, Step 3.5).

**(d) Note the existing extra constraint.** The migration already adds
`slug_required_for_new_posts` (slug may be NULL only for rows dated before
2026-06-18). Keep it — but be aware new inserts from the bot **must** supply a slug or
they'll fail the CHECK.

### Step 1.3 — Re-establish RLS on the renamed table (**MISSING — critical**)

`20251214030543_add_row_level_security.sql` only `ENABLE`s RLS on the *old* `posts` /
`post_content` (it defines no policies in the file). After the rename in Step 5, those
grants travel with `posts_old`; the new `posts` (formerly `posts_v2`) has **RLS in
whatever state `posts_v2` was created with and no read policy**. With the anon key the
frontend will read **zero rows**.

Add explicitly, after the renames:
```sql
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Public read of published posts (adjust to your actual auth model)
CREATE POLICY "posts are publicly readable"
  ON posts FOR SELECT
  USING (true);
```
Verify against how `user_liked_posts` / `user_saved_posts` policies expect to join —
if those policies referenced the old `posts`, confirm they still resolve after rename.

> **⚠ The policy alone is not enough — table GRANTs travel with the rename too.**
> Confirmed against the live DB: after the rename, `posts` had only the default
> `REFERENCES, TRIGGER, TRUNCATE` for `anon` / `authenticated` / `service_role`. Every
> `SELECT`/`INSERT` grant from the initial schema had gone with `posts_old`.
>
> A policy can only *narrow* what a grant already allows, so with no grant the request
> fails before RLS is consulted: `42501 permission denied for table posts`. The frontend
> read nothing and the bot could neither insert nor call `match_posts` (it's plain
> `LANGUAGE sql STABLE`, so it executes as the caller, not as the owner).
>
> Fixed by the GRANTs at the end of `20260618121728_redesign_schema.sql` — they belong in
> the same migration as the rename that dropped them, so a fresh `db reset` can never
> reproduce the broken state:
>
> ```sql
> Grant Select on table posts to anon;
> Grant Select on table posts to authenticated;
> Grant Select, Insert, Update, Delete on table posts to service_role;
> ```
>
> Check it with:
> ```sql
> select grantee, privilege_type from information_schema.role_table_grants
> where table_schema = 'public' and table_name = 'posts';
> ```

### Step 1.4 — Index the embedding column **after** backfill, not before

> **⚠ Reconcile:** Do **not** create an `ivfflat` index on an empty/near-empty table.
> ivfflat clusters existing rows into `lists`; built on no data it degrades to a
> sequential scan and never recovers until rebuilt. Two safe options:

- **Small dataset (this project):** use HNSW, which doesn't need training data:
  ```sql
  CREATE INDEX ON posts USING hnsw (embedding vector_cosine_ops);
  ```
- **Or** defer the ivfflat index to a separate statement you run **after** posts have
  embeddings, and size `lists ≈ sqrt(row_count)`.

The `posts(slug)` and partial `raw_api_data(status)` indexes from the existing
migration are already correct — keep them.

### Step 1.5 — Drop the create_post_with_content RPC
Already handled by the existing migration (`DROP FUNCTION IF EXISTS
public.create_post_with_content;`). No action needed — just confirm nothing still calls
it (`backend/db/repository/posts_repo.py` currently does; that path must stop being
used once the bot writes the flat table — see Phase 3).

### Step 1.6 — Add the match_posts RPC for semantic dedup (used in Phase 3)
```sql
CREATE OR REPLACE FUNCTION match_posts(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (id uuid, title text, slug text, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT id, title, slug,
    1 - (embedding <=> query_embedding) AS similarity
  FROM posts
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```
For the "related posts" feature (Phase 4) add a second, id-based variant so the
frontend never has to ship an embedding to the browser:
```sql
CREATE OR REPLACE FUNCTION related_posts(
  post_id uuid,
  match_count int
)
RETURNS TABLE (id uuid, title text, slug text, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT p.id, p.title, p.slug,
    1 - (p.embedding <=> src.embedding) AS similarity
  FROM posts p, (SELECT embedding FROM posts WHERE id = post_id) src
  WHERE p.id <> post_id AND p.embedding IS NOT NULL
  ORDER BY p.embedding <=> src.embedding
  LIMIT match_count;
$$;
```

**How to verify Phase 1 is done correctly:**
- `SELECT slug, title, tags, difficulty FROM posts LIMIT 5;` — all columns queryable, no JSON unwrapping.
- `SELECT status, COUNT(*) FROM raw_api_data GROUP BY status;` — status column visible.
- **With the anon key** (not the service role), `SELECT count(*) FROM posts;` returns a non-zero count — proves RLS Step 1.3 worked.
- Old `posts_old` and `post_content_old` tables still exist as fallback until you're confident.

---

## Phase 2 — Scraper / Ingestion Adapter Pattern
**Goal:** Replace three ad-hoc scraper scripts with a unified adapter interface, and
replace the old source list (NewsAPI, MarkTechPost, Product Hunt) with a two-tier
source model that avoids re-summarizing already-published human content.
**Demonstrates:** Clean abstraction, extensibility, error handling, observability,
deliberate source curation.

> **⚠ Reconcile — resolved.** `backend/services/ingestion/base.py` exists and the
> dataclass is named **`RawData`** (not the plan's original `RawItem`). The real
> adapter files below (`arxiv`, `lab_blog`, `hackernews`, `github_trending`) already
> import `RawData` and supersede the illustrative snippets in this section — treat the
> snippets as reference, not as files to create. The base-class contract was also
> reconciled: `SourceAdapter` now declares exactly what every adapter actually sets —
> `source_name`, `source_type`, `tier` (the stale `source_url` / `source_tier`
> annotations were removed; `source_url` is a per-*item* value on `RawData`, not a
> per-adapter constant). `RawData` additionally carries `engagement_meta` and `content`
> (see Step 2.1).

### Why the source list changed

The original sources had a fundamental problem: MarkTechPost is already a
human-written, processed AI news site — generating an AI summary of it adds no
value over reading the original. NewsAPI is a generic news aggregator, not
AI-specific, so it's mostly noise at this scale.

The replacement is a **two-tier model**:

- **Tier 1 — Trigger sources.** Primary, unprocessed information with no existing
  beginner-friendly write-up: ArXiv, official lab blogs, GitHub trending, HN
  filtered for AI. These are the only sources allowed to create a new
  `raw_api_data` row and trigger post generation.
- **Tier 2 — Context sources.** Independent analyst newsletters (Latent Space,
  Import AI, Ahead of AI, The Gradient). These never trigger a post on their own —
  they're queried live by the agent's research tools (Tavily/search) *while*
  generating a post, to add expert framing with attribution. They live in the
  agent harness (research tools), not in the ingestion layer.

This section (Phase 2) only covers Tier 1 — the things that actually populate
`raw_api_data`. Tier 2 sources are wired in later as agent tools, not adapters.

### Step 2.1 — Define the base adapter
`backend/services/ingestion/base.py` (this reflects the **actual** file):

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

@dataclass
class RawData:
    title: str
    description: str
    source_url: str          # per-ITEM URL (each feed entry / hit), not a per-adapter constant
    source_name: str
    source_type: str         # 'rss' | 'api' | 'scraper' | 'other'
    fetched_at: datetime = None
    engagement_meta: Optional[dict] = None  # points, comments, stars… — a triage SIGNAL, not content
    content: Optional[str] = None            # full article body when the feed ships it (content:encoded); else None

    def __post_init__(self):
        if self.fetched_at is None:
            # datetime.utcnow() is deprecated on 3.12; use tz-aware now()
            self.fetched_at = datetime.now(timezone.utc)

class SourceAdapter(ABC):
    source_name: str  # human label for the source, e.g. "Hacker News"
    source_type: str  # 'rss' | 'api' | 'scraper' | 'other' (matches raw_api_data CHECK)
    tier: int = 1     # Tier 1 = trigger source. Tier 2 sources don't use this adapter pattern at all.

    @abstractmethod
    def fetch(self) -> list[RawData]:
        """Fetch items from this source. Never raises — returns [] on failure."""
        ...
```

Add `feedparser` and `httpx` as **direct** dependencies of `backend/pyproject.toml`
(feedparser is currently only a transitive lock entry; httpx is not declared).

> **On the two extra fields — keep them separate from `description`, deliberately.**
> - **`engagement_meta`** is a per-source *signal* (HN points/comments, GitHub stars),
>   **not** article text. It must not be concatenated into `description`: `description`
>   feeds triage **and the embedding**, and a consistent, compact blurb makes better
>   vectors than one polluted with "points: 342". It persists to the generic
>   `raw_api_data.metadata` jsonb column (Step 1.2a) so a new source's signals never
>   require a schema change.
> - **`content`** is the full article **body** (RSS `content:encoded`), distinct from
>   the short `description`/summary the feed also ships. They're independently present
>   (a feed can give one without the other), serve different stages (description →
>   triage/embed; content → generation), and differ wildly in length — collapsing them
>   loses information and hurts the embedding. Note this is the *raw source body before
>   processing*, **not** the finished LLM post that lived in the old `post_content`
>   table. See the two-stage note below and Step 1.2a for the backing column.

> **On `content` — the two-stage fetch model.** `RawData` carries `content` but it is
> **often `None`, and that's fine.** Ingestion (this phase) is cheap and runs
> often; for most sources it captures only what's needed to *triage, embed, and locate*
> an item — title, description, and `source_url`. The **full article is fetched later,
> at generation time (Phase 3)**, by the agent's `scraper_tool` / `arxiv_tool` against
> `source_url`, and only for the items that survive triage + dedup. We don't scrape full
> HTML for every feed item every 30 min when most get filtered out.
>
> The one exception is a **free win**: when a feed *already ships* the full body in
> `content:encoded` (feedparser → `entry.content[0].value`), keep it — it costs nothing
> and gives generation a richer starting point. `LabBlogAdapter` does this below. Because
> ingestion and generation are decoupled through the DB, that body is **persisted** to
> `raw_api_data.content` (Step 1.2a) so it survives to generation; it does **not** replace
> the deferred scrape — it just means some items arrive already-rich.

### Step 2.2 — Write the Tier 1 adapters

Replace the old `NewsAPIAdapter` / `MarktechPostAdapter` / `ProductHuntAdapter`
with these. Same interface, different sources.

`backend/services/ingestion/adapters/arxiv_adapter.py`:

```python
from ..base import SourceAdapter, RawItem
import feedparser
import logging

logger = logging.getLogger(__name__)

ARXIV_CATEGORIES = ["cs.AI", "cs.CL", "cs.LG"]

class ArxivAdapter(SourceAdapter):
    source_name = "ArXiv"
    source_type = "rss"
    tier = 1

    def fetch(self) -> list[RawItem]:
        items = []
        for category in ARXIV_CATEGORIES:
            url = f"http://export.arxiv.org/rss/{category}"
            feed = feedparser.parse(url)
            # feedparser NEVER raises on a bad URL — it sets `bozo` and returns
            # empty entries. try/except alone would silently pass. Check explicitly.
            if feed.bozo or not feed.entries:
                logger.error(f"ArxivAdapter: no entries for {category} "
                             f"(bozo={feed.bozo}, {getattr(feed, 'bozo_exception', '')})")
                continue
            for entry in feed.entries:
                items.append(RawItem(
                    title=entry.title,
                    description=entry.get("summary", ""),
                    source_url=entry.link,
                    source_name=f"ArXiv ({category})",
                    source_type=self.source_type,
                ))
        return items
```

`backend/services/ingestion/adapters/lab_blog_adapter.py`:

```python
from ..base import SourceAdapter, RawItem
import feedparser
import logging

logger = logging.getLogger(__name__)

# Official primary-source blogs — no journalist in between.
# Verify each URL returns a valid feed before relying on it — labs change
# their blog platforms often, and a 404 comes back as bozo, not an exception.
LAB_FEEDS = {
    "OpenAI":        "https://openai.com/news/rss.xml",
    "Anthropic":     "https://www.anthropic.com/news/rss.xml",
    "Hugging Face":  "https://huggingface.co/blog/feed.xml",
    "Mistral AI":    "https://mistral.ai/news/rss.xml",
}

def _extract_content(entry) -> str | None:
    """Full article body IF the feed shipped it (content:encoded), else None.
    feedparser exposes content:encoded as a list of {'value': ...} dicts."""
    content = entry.get("content")
    if content and content[0].get("value"):
        return content[0]["value"]
    return None

class LabBlogAdapter(SourceAdapter):
    source_name = "Lab Blogs"
    source_type = "rss"
    tier = 1

    def fetch(self) -> list[RawItem]:
        items = []
        for lab_name, feed_url in LAB_FEEDS.items():
            feed = feedparser.parse(feed_url)
            if feed.bozo or not feed.entries:
                logger.error(f"LabBlogAdapter: no entries for {lab_name} "
                             f"(bozo={feed.bozo})")
                continue
            for entry in feed.entries:
                items.append(RawItem(
                    title=entry.title,
                    description=entry.get("summary", ""),
                    source_url=entry.link,
                    source_name=lab_name,
                    source_type=self.source_type,
                    content=_extract_content(entry),  # free win when the feed ships it
                ))
        return items
```

`backend/services/ingestion/adapters/hackernews_adapter.py` (this reflects the
**actual** file — it supersedes the earlier keyword-filter sketch):

```python
from ..base import SourceAdapter, RawData
import httpx
import logging
import time

logger = logging.getLogger(__name__)

class HackerNewsAdapter(SourceAdapter):
    source_name = "Hacker News"
    source_type = "api"
    tier = 1

    def fetch(self) -> list[RawData]:
        items = []
        cutoff = int(time.time()) - 3600
        try:
            response = httpx.get(
                "https://hn.algolia.com/api/v1/search",
                params={
                    "tags": "story",
                    # engagement + recency, not keyword matching — HN's own signal.
                    # NOTE: Algolia wants comma-joined with NO space, or a JSON array.
                    # Verify the recency filter actually fires (a silently-ignored
                    # created_at just returns older high-point stories).
                    "numericFilters": f"points>50,created_at_i>{cutoff}",
                    "hitsPerPage": 50,
                },
                timeout=15,
            )
            response.raise_for_status()
            hits = response.json().get("hits", [])

            for hit in hits:
                if not hit.get("title") or not hit.get("url"):
                    continue
                # Most HN posts are link-only with no body → description often empty.
                # That's honest; triage falls back to the title.
                description = hit.get("story_text") or ""
                items.append(RawData(
                    title=hit["title"],
                    description=description,
                    source_url=hit["url"],
                    source_name=self.source_name,
                    source_type=self.source_type,
                    engagement_meta={
                        "points": hit.get("points", 0),
                        "num_comments": hit.get("num_comments", 0),
                    },
                ))
        except Exception as e:
            logger.error(f"HackerNewsAdapter failed: {e}")
        return items
```

> **Why engagement/recency beat a keyword list here.** A keyword allow-list
> (`"llm", "gpt", …`) both misses items phrased differently and lets through off-topic
> high-noise posts. Filtering on HN's own `points`/recency trusts the community signal;
> genuine *topic* filtering happens in the LangGraph triage node (Phase 3), not in the
> adapter. The points/comments ride along in `engagement_meta` → `raw_api_data.metadata`.

`backend/services/ingestion/adapters/github_trending_adapter.py`:

```python
from ..base import SourceAdapter, RawItem
from datetime import datetime, timezone, timedelta
import httpx
import os
import logging

logger = logging.getLogger(__name__)

AI_TOPICS = ["llm", "agents", "machine-learning", "generative-ai"]

class GithubTrendingAdapter(SourceAdapter):
    source_name = "GitHub Trending"
    source_type = "api"
    tier = 1

    def fetch(self) -> list[RawItem]:
        items = []
        # `pushed:>1week` is NOT valid GitHub search syntax — it needs a real date.
        since = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
        # Unauthenticated search is 10 req/min; use a token to avoid throttling.
        headers = {"Accept": "application/vnd.github+json"}
        token = os.getenv("GITHUB_TOKEN")
        if token:
            headers["Authorization"] = f"Bearer {token}"

        for topic in AI_TOPICS:
            try:
                response = httpx.get(
                    "https://api.github.com/search/repositories",
                    params={
                        "q": f"topic:{topic} pushed:>{since}",
                        "sort": "stars",
                        "order": "desc",
                        "per_page": 10,
                    },
                    headers=headers,
                    timeout=15,
                )
                response.raise_for_status()
                repos = response.json().get("items", [])

                for repo in repos:
                    items.append(RawItem(
                        title=f"{repo['full_name']}: {repo.get('description', '')}",
                        description=repo.get("description", ""),
                        source_url=repo["html_url"],
                        source_name="GitHub Trending",
                        source_type=self.source_type,
                    ))
            except Exception as e:
                logger.error(f"GithubTrendingAdapter failed for topic {topic}: {e}")
                continue
        return items
```

### Step 2.3 — Write the ingestion runner ✅ *implemented*
`backend/services/ingestion/runner.py` (this is the actual file):

```python
import logging

from backend.db.repository.raw_repo import upsert_raw_items
from backend.services.ingestion.base import RawData

from .adapters.arxiv_adapter import ArxivAdapter
from .adapters.github_trending_adapter import GithubTrendingAdapter
from .adapters.hackernews_adapter import HackerNewsAdapter
from .adapters.lab_blog_adapter import LabBlogAdapter

logger = logging.getLogger(__name__)

# Only Tier 1 sources. Tier 2 (Latent Space, Import AI, etc.) are wired into
# the agent's research tools later, not the ingestion runner.
ADAPTERS = [
    ArxivAdapter(),
    LabBlogAdapter(),
    HackerNewsAdapter(),
    GithubTrendingAdapter(),
]

def run_ingestion() -> int:
    """Run all Tier 1 adapters and upsert results. Returns count of NEW items inserted."""
    all_items: list[RawData] = []
    for adapter in ADAPTERS:
        logger.info("Fetching from %s...", adapter.source_name)
        try:
            items = adapter.fetch()          # fetch() should never raise; this is belt-and-suspenders
        except Exception as e:
            logger.error("%s.fetch() raised unexpectedly: %s", adapter.source_name, e)
            items = []
        logger.info("  -> %s items from %s", len(items), adapter.source_name)
        all_items.extend(items)

    inserted = upsert_raw_items(all_items)
    logger.info("Ingestion complete. %s fetched, %s new items queued.", len(all_items), inserted)
    return inserted
```
> **Import convention:** repository/service modules use absolute `from backend.…`
> imports (matching the rest of the repo); adapters use package-relative `from .adapters…`
> / `from ..base`. Run as part of the `backend` package with the project root on the path.

### Step 2.4 — Rewrite the upsert with status ✅ *implemented*
`backend/db/repository/raw_repo.py`:

> **⚠ Schema note — `content` and `metadata` columns (both now in the migration).**
> `raw_api_data` originally (`20260113133120_create_raw_api_data_table.sql`) had only
> `id / created_at / source_name / description / website / title`. The redesign
> migration (Step 1.2a) now adds `status / retry_count / last_error / source_type`
> **plus** `metadata jsonb` (backs `RawData.engagement_meta`) and `content text` (backs
> `RawData.content`, the `content:encoded` body when a feed ships one, else NULL). So
> both the `"content"` and `"metadata"` lines in the upsert below have real columns.
> Phase 3's generation reads `content` as a starting point and still scrapes
> `source_url` for the rest.

> **⚠ DECIDED — dropped the UNIQUE(title) constraint (option a).** `raw_api_data`
> originally had UNIQUE on **both** `title` and `website`, so a batch upsert with
> `on_conflict="website"` would fail the whole statement whenever a new URL collided
> with an existing *title*. Since `website` is the real identity key and titles are
> LLM-rewritten (unreliable — same reason source_url can't be recovered by title-join,
> Step 1.2c), the redesign migration now `DROP CONSTRAINT IF EXISTS
> raw_api_data_title_key`. Website uniqueness is kept. This lets the batch upsert below
> use `ignore_duplicates=True` (INSERT … ON CONFLICT (website) DO NOTHING), which also
> **preserves an existing row's status** instead of resetting it on re-ingest.

```python
def upsert_raw_items(items: list[RawData]) -> int:
    # `website` is NOT NULL + UNIQUE — drop items with no URL so empty-string
    # websites can't collide with each other on ''.
    rows = [_to_row(item) for item in items if item.source_url]
    if not rows:
        return 0
    result = (
        supabase.table("raw_api_data")
        .upsert(rows, on_conflict="website", ignore_duplicates=True)
        .execute()
    )
    # With DO NOTHING, only actually-inserted rows come back in .data.
    return len(result.data or [])
```
`_to_row(item)` maps `source_url→website`, `engagement_meta→metadata`,
`content→content`, and sets `status="pending"`. See the file for the full mapping.

### Step 2.5 — Retire the old scrapers and orchestrator
- `backend/services/main.py` (`fetch_all_data` / `run_fetch_and_store`) is replaced by
  `run_ingestion`. Delete or archive `newsapi_scrapper/`, `marktechpost_scraper/`,
  `product_hunt_wrapper/` once the new runner is verified.
- Note: `main.py` currently has a latent bug — Product Hunt results are fetched but
  never `.extend()`-ed into `all_data`. Retiring it makes that moot.
- Update `.github/workflows/run_workflow.yml`'s `run-backend-main` job to call the new
  runner (see Phase 5 for the fuller scheduling change).

**How to verify Phase 2 is done correctly:**
- `python -c "from backend.services.ingestion.runner import run_ingestion; run_ingestion()"` runs without errors.
- `SELECT source_type, status, COUNT(*) FROM raw_api_data GROUP BY source_type, status;` shows items correctly labelled.
- Point `LabBlogAdapter` at a deliberately bad URL — the runner still completes and the
  **bozo check logs an error** (a plain try/except would have stayed silent). Other adapters run fine.
- Spot-check rows: ArXiv items look like papers, lab-blog items like announcements, HN items are actually AI-relevant (expect to tune the keyword filter).

---

## Phase 3 — LangGraph Workflow Redesign
**Goal:** Add a triage gate, semantic dedup, clean graph shape, proper status updates,
and generation of the `difficulty` / `read_time` / `tags` fields the new schema exposes.
**Demonstrates:** LangGraph patterns, cost-aware design, structured outputs, observability.

> **⚠ Reconcile:** The current bot (`langgraph_bot/`) has **no triage or dedup node**,
> reads pending work by **date range** (`fetch_last_days_posts`) rather than `status`,
> writes the **old** JSONB schema (`insert_bot_data.py`), and hard-stops after 2 items
> (`if c == 2: break`, `time.sleep(12)`). All of that changes here. The state is a
> `TypedDict` with custom reducers (`agentschema/stateschema.py`) — **keep that**,
> don't switch to `StateGraph(dict)` (see Step 3.3).
>
> **⚠ Naming — the state class is `State`, not `AgentState`.** Snippets in this phase
> were originally written against a hypothetical `AgentState` imported from
> `agentschema.stateschema`. The real class is
> `from langgraph_bot.agentschema.stateschema import State`. Don't copy the imports
> verbatim anywhere in Phase 3.
>
> **⚠ Treat every Phase 3 snippet as design intent, not copy-paste code.** The graph
> topology in particular differs substantially from what Step 3.3 originally assumed —
> see the topology reconcile there before writing anything.

### Step 3.1 — Add a triage node (runs before everything else)
`langgraph_bot/nodes/triage_node.py`:

> **⚠ Status: this file now EXISTS and is implemented** (`TriageResult`, the Groq client,
> the prompt, and `triage_node()`). What's left of this step is reconciling the names
> below and wiring the node into the graph (Step 3.3).

> **⚠ Reconcile — field name and model differ from the snippet below.** The actual file
> uses **`is_it_relevant`** (not `is_ai_relevant`) as the `TriageResult` field, and
> `openai/gpt-oss-120b` (not `llama-3.1-8b-instant`, which Groq decommissioned). Since
> `with_structured_output` binds to the **Pydantic field name**, `is_it_relevant` is the
> real key. **Pick one name and use it in all three places** — the Pydantic model, the
> `triage` dict in `State`, and Step 3.4's skip-reason lookup
> (`result["triage"]["is_ai_relevant"]` below must become `["is_it_relevant"]`). A
> mismatch here raises `KeyError` at the exact moment an item gets skipped, which is
> also the path you'll exercise least in testing.
>
> Note the tension on the model: triage is meant to be the *cheap* gate, and a 120B
> model is not the cheapest option on Groq. Deliberate is fine — just be ready to
> explain it, or drop to a smaller instruct model once the prompt is calibrated.
>
> Also: the live prompt is **stricter** than the snippet below (an allowlist of
> model/tool/agent/research/release, plus "when in doubt, prefer False"). Combined with
> `importance >= 2`, expect a high skip rate. **Count the skip rate on the 10-item
> verification run** — that number, not the prompt text, tells you whether it's calibrated.

> **⚠ Use `with_structured_output(TriageResult, method="json_schema")` — the default
> silently disables the whole gate.** With the default (tool calling), `gpt-oss-120b`
> answers this prompt by emitting a tool call literally named `JSON`, and Groq rejects
> the request: `400 … attempted to call tool 'JSON' which was not in request.tools`.
> Because `triage_node` **fails open** on provider errors (correctly — a 429 is our
> problem, not the article's), every item then passed through with a synthetic
> `reason: "triage unavailable (BadRequestError), passed through"`. Nothing was ever
> filtered and the logs looked like a rate-limit issue. `method="json_schema"` constrains
> decoding instead of relying on the model to pick a tool.
>
> Verify the gate is *actually* gating by running a known-bad item through it — a funding
> or opinion story should come back `should_process=False`, not a fail-open pass.

> **⚠ Groq decommissions models without warning — check before debugging anything else.**
> Both IDs previously hard-coded in `models/generativemodel.py` were already gone:
> `meta-llama/llama-4-scout-17b-16e-instruct` (the workhorse for title_block / slug /
> summary / description) and `qwen/qwen3-32b` (`codemodel`). Every generation call was
> returning `404 model_not_found`, so posts came out with fallback titles and no body —
> the single largest cause of "the bot feels lacking". Current replacements:
> `llama-3.3-70b-versatile` and `qwen/qwen3.6-27b`. List what your key can actually reach
> with `Groq().models.list()`.


```python
from langchain_groq import ChatGroq
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

class TriageResult(BaseModel):
    is_ai_relevant: bool
    importance: int        # 1-5
    reason: str

groq = ChatGroq(model="llama-3.1-8b-instant")  # cheapest/fastest model for triage
structured = groq.with_structured_output(TriageResult)

TRIAGE_PROMPT = """
You are filtering articles for an AI news platform aimed at beginner developers.

Article title: {title}
Article description: {description}

Decide:
1. is_ai_relevant: Is this genuinely about AI/ML developments, tools, or research?
   Mark False for: generic tech news, business/funding-only stories, opinion pieces with no technical content.
2. importance: 1 (minor) to 5 (major model release / breakthrough)
3. reason: one sentence explaining your decision

Respond with JSON only.
"""

def triage_node(state: dict) -> dict:
    result: TriageResult = structured.invoke([
        HumanMessage(content=TRIAGE_PROMPT.format(
            title=state["topic"],
            description=state["data"],
        ))
    ])
    return {
        "triage": result.model_dump(),
        "should_process": result.is_ai_relevant and result.importance >= 2,
    }
```
Add `triage`, `should_process`, `embedding`, `is_duplicate`, `difficulty`,
`read_time`, `tags` to `agentschema/stateschema.py` (with `replace_reducer` or
appropriate reducers) so parallel branches can write them without collisions.
**See the full key list in Step 3.5** — this one is incomplete (`duplicate_of`,
`source_url`, `raw_id`, `content`, and the already-passed-but-undeclared `name` are also
needed).

### Step 3.2 — Add a semantic dedup node ✅ *implemented*
`langgraph_bot/nodes/dedup_node.py` (Gemini `gemini-embedding-001`, truncated to 768-dim):

> **⚠ `text-embedding-004` is retired** — `embedContent` on it now returns
> `404 NOT_FOUND`. Its successor `gemini-embedding-001` defaults to **3072** dims, so
> `output_dimensionality=768` is load-bearing: without it every insert fails against the
> `vector(768)` column. Truncated outputs aren't unit-normalized, which is fine here —
> `match_posts` uses cosine (`<=>` / `vector_cosine_ops`) and cosine is scale-invariant.
> List what's actually available with
> `genai.Client().models.list()` filtered on `'embedContent' in m.supported_actions`.

```python
# Gemini embeddings — reuses GEMINI_API_KEY, no new dependency.
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from backend.db.client import supabase
from langgraph_bot.utils.ratelimit import gemini_embed_limiter

# task_type="RETRIEVAL_DOCUMENT" is the right mode for indexing/dedup content.
# Built lazily (see below), not at import.
embedder = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001",
    task_type="RETRIEVAL_DOCUMENT",
    output_dimensionality=768,
)

def get_embedding(text: str) -> list[float]:
    gemini_embed_limiter.acquire()       # free tier is 5 req/min — the tightest gate
    return embedder.embed_query(text)   # returns a 768-float vector

def dedup_node(state: dict) -> dict:
    if not state.get("should_process"):
        return {}  # already filtered by triage; add nothing

    embedding = get_embedding(f"{state['topic']}. {state['data']}")

    result = supabase.rpc("match_posts", {
        "query_embedding": embedding,
        "match_threshold": 0.92,
        "match_count": 1,
    }).execute()

    is_duplicate = len(result.data) > 0
    return {
        "embedding": embedding,
        "is_duplicate": is_duplicate,
        "duplicate_of": result.data[0] if is_duplicate else None,
        "should_process": not is_duplicate,
    }
```
> Note: no new dependency or key — `langchain-google-genai` and `GEMINI_API_KEY` are
> already in use for generation. Keep the `0.92` threshold consistent with the model;
> if dedup feels too loose/strict once running, tune the threshold, not the dimension.

### Step 3.3 — Redesign the graph with early exits ✅ *implemented*

> **⚠ Reconcile — the original snippet assumed a flat graph that does not exist.** It
> listed `description`, `summary`, `title`, `slug`, `enrich` as sibling top-level nodes.
> The real code is **two compiled subgraphs running in parallel**:
>
> - `workflow.py` → `graph` (the "summary" subgraph):
>   `START → generate_title_block → slug_node → summary_agent → image_generation_node → END`
> - `description_workflow.py` → `g` (the "description" subgraph):
>   `START → parser_tool → tavily_tool → summary_agent → description_agent → END`
> - `complete_workflow.py` → `mjorgraph`: adds both as nodes
>   (`description_node = g`, `summary_node = graph`) with `START → both` and `both → END`.
>
> Consequences for this step:
> 1. **The parallel fan-out already exists.** Your job is to *gate* it behind
>    triage + dedup — not to build new flat nodes.
> 2. **`title` and `slug` are not top-level nodes.** They live inside the summary
>    subgraph, so `enrich` cannot be wired "after slug". `enrich` becomes a new
>    **top-level** node that runs after *both* subgraphs have joined.
> 3. **Only two conditional-edge destinations are needed** — the passthrough `fan_out`
>    node is one valid way to gate two parallel branches, but not the only one:
>    a router may **return a list** of destinations, so
>    `return ["description_node", "summary_node"]` fans out directly with no extra node.
>    ⚠ The list must come from the **router function**, not from the path map: a list as
>    a path-map *value* fails at compile time with `TypeError: unhashable type: 'list'`
>    (langgraph 1.0.5 hashes those values). Pass the reachable set as the third argument
>    instead: `add_conditional_edges("dedup", should_continue, ["description_node",
>    "summary_node", END])`.

#### Full node inventory — everything that exists today

The top-level diagram above is only 5 boxes; the real work happens inside the two
subgraphs. Complete list, so nothing gets "lost" when restructuring:

| Node (graph name) | Implementation | Graph | LLM/API calls |
| --- | --- | --- | --- |
| `triage` | `nodes/triage_node.py` | top-level (**new**) | 1 Groq (`triagemodel`, structured) |
| `dedup` | `nodes/dedup_node.py` | top-level (**new**) | 1 Gemini embedding + 1 `match_posts` RPC |
| `generate_title_block` | `nodes/tnode/title_node.py` → `generate_title_block` | summary subgraph | 1 Groq (`groqmodel`, structured `TitleBlockMetadata`) |
| `slug_node` | `nodes/tnode/slug_node.py` → `generate_slug`, calls `tools/tools.py::slug_tool` | summary subgraph | 1 Groq |
| `summary_agent` | `nodes/anode/agentnode.py` → `summary_agent_node` | summary subgraph | 1 Groq |
| `image_generation_node` | `nodes/tnode/generate_image_node.py` → `generate_image` | summary subgraph | 1 Pollinations (`gen.pollinations.ai`) |
| `parser_tool` | `nodes/tnode/pdf_parsing_node.py` → `pdf_parsing_node` | description subgraph | 0 (PyPDF, arXiv PDFs only) |
| `tavily_tool` | `nodes/tnode/tavily_node.py` → `tavily_search_node` | description subgraph | 1 Tavily search |
| `description_agent` | `nodes/anode/agentnode.py` → `description_agent_node` | description subgraph | 1 Groq |
| `enrich` | `nodes/enrich_node.py` | top-level (**new**) | **0** — reads `title_block` (see Step 3.6) |

So the real per-item cost is **~5 Groq + 1 Gemini + 1 Tavily + 1 Pollinations ≈ 8
rate-limited calls**, split across two concurrent branches. That number is why Step 3.4's
rate limiting has to live at the call site.

**Defined but NOT wired into any graph** (leave them alone — none of these run today):

- `nodes/tnode/arxiv_node.py` — deliberately commented out of the description subgraph;
  the arXiv API returned "Rate Exceeded". Superseded by Phase 2's arXiv adapter.
- `nodes/tnode/update_title_node.py` — legacy, wrote the old two-table schema.
- `nodes/load_data_node.py` — legacy loader from before the raw_api_data queue.
- `agent/coding_agent.py` + `codemodel` + `tools/python_executor.py` — an unused code
  agent. Kept because `state["code"]` is still declared; not on any edge.
- `tools/tools.py::title_tool` — defined but never called; `title_node` invokes
  `groqmodel` directly. `scraper_tool` (Firecrawl) is likewise unused.

> **⚠ BUG — `summary_agent_node` runs twice per item, and the two runs race.**
> `summary_agent_node` is registered in **both** subgraphs
> (`workflow.py` `add_node("summary_agent", ...)` and `description_workflow.py`
> `add_node("summary_agent", ...)`), and those subgraphs execute **concurrently**. So:
> - You pay for **two** summary generations per item.
> - Both write the `summary` channel at the same time, and `replace_reducer` is
>   last-write-wins → **the summary persisted to the DB is nondeterministic**, and
>   `description_agent` may have consumed a *different* summary than the one you store.
>
> This is a correctness bug, not just a cost inefficiency, and it gets worse in Step 3.6
> (`enrich` consumes `summary`, so enrichment describes a summary that may not be the
> stored one).
>
> **Fixed by deletion, not by hoisting.** `description_agent_node` reads only
> `state["data"]` / `state["content"]` / `state["tavily_search_result"]` — it never reads
> `summary`. So the copy inside the description subgraph was pure waste: removing that
> `add_node` kills the double call *and* the race at zero cost, and no hoist is needed.
> The description subgraph is now `START → parser_tool → tavily_tool → description_agent → END`.


Target top-level shape (subgraphs kept intact, gating added around them):

```python
from langgraph.graph import START, END, StateGraph
from langgraph.types import RetryPolicy                    # NOTE: `types`, not `pregel`
from langgraph_bot.agentschema.stateschema import State   # NOTE: `State`, not `AgentState`
from langgraph_bot.workflow.workflow import graph as summary_subgraph
from langgraph_bot.workflow.description_workflow import g as description_subgraph
from langgraph_bot.nodes.triage_node import triage_node
from langgraph_bot.nodes.dedup_node import dedup_node
from langgraph_bot.nodes.enrich_node import enrich_node      # NEW — Step 3.6


def should_continue(state: State) -> list[str] | str:
    """Router: exit early if triage or dedup filtered this item."""
    if state.get("should_process"):
        return ["description_node", "summary_node"]   # list = fan out to both
    return END


def build_graph():
    b = StateGraph(state_schema=State)

    # Cheap gates first — before any expensive generation.
    # retry_policy: transient provider errors retry the node instead of losing the item.
    b.add_node("triage", triage_node, retry_policy=RetryPolicy(max_attempts=3))
    b.add_node("dedup", dedup_node, retry_policy=RetryPolicy(max_attempts=3))

    # Expensive generation: the two EXISTING compiled subgraphs, unchanged.
    b.add_node("description_node", description_subgraph)
    b.add_node("summary_node", summary_subgraph)

    # Post-generation, top-level (title/slug are INSIDE summary_subgraph).
    b.add_node("enrich", enrich_node)

    b.add_edge(START, "triage")
    b.add_edge("triage", "dedup")

    # ONE conditional edge. The router returns a list to fan out; the third argument is
    # just the reachable set (validation + diagram). A dict path map with a list VALUE
    # does not compile — see the note above.
    b.add_conditional_edges(
        "dedup", should_continue, ["description_node", "summary_node", END]
    )

    # Both branches join at enrich; reducers handle the concurrent writes.
    b.add_edge("description_node", "enrich")
    b.add_edge("summary_node", "enrich")
    b.add_edge("enrich", END)

    return b.compile()


mjorgraph = build_graph()
```
Keep `write_complete_graph_png()` as-is — it will now render the gates too, which makes
the diagram genuinely worth showing.


### Step 3.4 — Update status on raw_api_data throughout the flow ✅ *implemented*
Rewrite `langgraph_bot/main.py`'s loop to be **status-driven** (not date-range) and to
replace the 2-item hard stop (`if c == 2: break`) with a real budget:

```python
MAX_ITEMS_PER_RUN = 20   # budget, not a debug stop — see the note below
PAUSE_BETWEEN_ITEMS = 2  # politeness gap ONLY — rate limiting lives at the call site

def run_entire_flow():
    # NEW: WHERE status = 'pending' ORDER BY created_at, LIMIT MAX_ITEMS_PER_RUN
    pending = fetch_pending_items(limit=MAX_ITEMS_PER_RUN)

    for post in pending:
        raw_id = post["id"]
        try:
            # Mark as processing so a parallel run doesn't pick it up
            update_status(raw_id, "processing")

            result = mjorgraph.invoke(build_initial_state(post))

            if not result.get("should_process"):
                update_status(raw_id, "skipped", error=_skip_reason(result))
                continue

            insert_cleaned_data(result)          # NEW: writes flat posts table (Step 3.5)
            update_status(raw_id, "succeeded")
            time.sleep(PAUSE_BETWEEN_ITEMS)

        except Exception as e:
            update_status(raw_id, "failed", error=str(e))
            logger.error(f"Failed processing {post['title']}: {e}")
```
- Add `fetch_pending_items(limit=...)` to `backend/db/repository/fetch_raw_data.py`
  filtering `.eq("status", "pending")` — replacing the date-range
  `fetch_last_days_posts()`.
- Add `update_status(raw_id, status, error=None)` (also bumps `retry_count` on failure).

> **⚠ Three things to get right here.**
>
> 1. **Keep a per-run item cap.** "Drop the 2-item hard stop" does not mean "process
>    everything". Phase 2's adapters land roughly **100–150 rows/day**; generation is
>    several LLM calls plus an image per item, so an uncapped loop is a multi-hour run
>    against provider rate limits. Cap it (~20/run) and let the leftover `pending` rows
>    carry to the next run — that's exactly what the status column is for. Because the
>    queue is `ORDER BY created_at`, nothing is lost, only deferred. If the backlog grows
>    faster than 20/run drains it, raise the cap or tighten triage — don't remove it.
> 2. **Rate-limit at the call site, not in this loop.** (This corrects an earlier version
>    of this step that said "sleep only after real generation, no sleep on a skip".)
>    Every provider key is capped, so *both* paths cost quota: a skip still spends **1
>    Groq triage call + 1 Gemini embedding**, and Gemini's free tier is only **5 req/min**
>    — i.e. the tightest limit in the pipeline is on the path that generates nothing.
>    A loop-level `sleep` also can't help even on the success path, because one item makes
>    ~8 calls across **two concurrent subgraph branches**; the loop only sees the gap
>    *between* items, never the burst inside one. So the spacing has to be per-provider,
>    around each call:
>
>    ```python
>    # langgraph_bot/utils/ratelimit.py — no custom limiter class. LangChain's
>    # InMemoryRateLimiter is a BaseRateLimiter, so the SAME object is both accepted by
>    # ChatGroq(rate_limiter=...) and callable manually as .acquire() for the Gemini and
>    # Pollinations clients, which take no limiter argument. max_bucket_size=1 => no burst.
>    GROQ_RPM, GEMINI_EMBED_RPM, POLLINATIONS_RPM = 25, 5, 10   # whole config surface
>
>    def _limiter(rpm):
>        return InMemoryRateLimiter(requests_per_second=rpm / 60.0,
>                                   check_every_n_seconds=0.5, max_bucket_size=1)
>
>    gemini_embed_limiter = _limiter(GEMINI_EMBED_RPM)
>    pollinations_limiter = _limiter(POLLINATIONS_RPM)
>
>    _groq_limiters: dict[str, InMemoryRateLimiter] = {}
>    def groq_limiter(api_key: str):                     # one bucket per KEY, memoised
>        return _groq_limiters.setdefault(api_key, _limiter(GROQ_RPM))
>    ```
>
>    The module's job is **sharing**, not mechanism: limiting only works if every caller
>    on a key goes through the same object, so they're all constructed here. (The bucket
>    starts empty, so the first call on each limiter waits one interval — ~20s once at
>    process start. Don't "fix" that by raising `max_bucket_size`; that would allow a
>    burst on *every* idle gap, not just the first.)
>
>    - **Groq, with N keys.** Free Groq accounts are rate limited *per key*, so
>      `generativemodel.py` reads `GROQ_API_KEY`, `GROQ_API_KEY_2..4` (unset ones are
>      skipped) and hands each model role a key by index, mod the number of keys:
>
>      | role | calls/item | key index |
>      | --- | --- | --- |
>      | `triagemodel` | 1 | 0 |
>      | `groqmodel` (title_block, title/slug tools) | ~3 | 1 |
>      | `summarymodel` (summary agent) | 1–2 | 2 |
>      | `descriptionmodel` (description agent) | 1–2 | 3 |
>
>      Because `groq_limiter()` is memoised **by key**, this needs no configuration
>      branch and no rotation state: with one key every role resolves to key 0 and shares
>      a single bucket (identical to the old behaviour); with four, the four roles get
>      four independent budgets, and — the part that actually matters — the two
>      **concurrently running** subgraphs (`summarymodel`, `descriptionmodel`) stop
>      throttling each other. Two or three keys degrade in between.
>    - **Gemini embeddings / Pollinations:** `limiter.acquire()` immediately before the
>      request; it blocks until a token is free.
>    - Keep a small `PAUSE_BETWEEN_ITEMS` if you like readable logs, but label it for what
>      it is. It is not the rate-limit mechanism.
>    - `load_dotenv()` must be pointed at `langgraph_bot/.env` explicitly. python-dotenv
>      searches upward from the **cwd**, so a bare `load_dotenv()` finds nothing when the
>      bot is run from the repo root and every key silently reads back `None`.
> 3. **The `processing` claim is not atomic.** `fetch_pending_items()` then
>    `update_status(raw_id, "processing")` is read-then-write — two concurrent runs can
>    both read the same `pending` row and both process it. That's acceptable for a single
>    daily cron (there is no second run). If you ever run overlapping workers, swap in an
>    atomic claim: `UPDATE raw_api_data SET status='processing' WHERE status='pending'
>    ... RETURNING *` (as a Postgres function called via RPC, since supabase-py can't
>    express `UPDATE ... RETURNING` directly).
>
> Also note `result["triage"]["is_it_relevant"]` — the live `TriageResult` field is
> `is_it_relevant`, not `is_ai_relevant`. See the Step 3.1 note; if you rename the field,
> rename it here too. `_skip_reason()` reads it, and also distinguishes
> *duplicate* / *not relevant* / *importance below threshold* so `last_error` says which
> gate closed rather than a bare `"triage"`.


### Step 3.5 — Rewrite insert to the flat posts table (**was writing old schema**) ✅ *implemented*

> **⚠ Reconcile:** `insert_bot_data.py` currently inserts into `posts` (old columns)
> **and** `post_content` (JSONB). After Phase 1 those tables are `posts_old` /
> `post_content_old`, and the new `posts` is flat. This function must be rewritten to
> a single insert into the flat table, and it must supply a `slug` (the
> `slug_required_for_new_posts` CHECK rejects NULL slugs for new rows).

> **⚠ This is a rewrite, not a tweak — and it changes the caller's contract.** The live
> signature is `insert_cleaned_data(posts: list)`: it takes a **batch**, loops it, writes
> both tables, rolls back uploaded images on failure, and **returns
> `{"status", "total", "inserted", "failed"}`**. The snippet below is
> `insert_cleaned_data(state: dict) -> None` — **per-item, no return value**. Both ends
> have to move together:
> - `main.py` today collects `all_posts` across the loop and calls
>   `insert_cleaned_data(final_ans)` **once at the end**, then reads
>   `output.get("failed", 0)` and `output['total']` for its summary log. Step 3.4's loop
>   inserts **per item** instead, so that trailing batch call and both dict reads must go.
> - Track the counts in the loop itself (`succeeded`/`skipped`/`failed` counters) if you
>   still want the summary line — don't try to keep the old return dict alive.
> - Per-item insert is the right shape here anyway: it pairs 1:1 with
>   `update_status(raw_id, "succeeded")`, so a crash mid-run leaves the DB consistent
>   instead of losing a whole batch's worth of finished generations.

```python
def insert_cleaned_data(state: dict) -> None:
    row = {
        "slug": state["slug"],                     # REQUIRED by CHECK constraint
        "title": state.get("title_block") or state.get("title"),
        "summary": state.get("summary"),
        "description": state.get("description"),
        "source_url": state.get("source_url"),
        "source_name": state.get("name"),
        "image_url": upload_image(state.get("generated_image")),  # returns public URL or None
        "tags": state.get("tags") or [],
        "difficulty": state.get("difficulty"),
        "read_time": state.get("read_time"),
        "embedding": state.get("embedding"),       # Step 3.7 can also do this separately
        "raw_item_id": state.get("raw_id"),
        "likes_count": 0,
    }
    supabase.table("posts").insert(row).execute()
```
Keep the image-upload-then-rollback logic from the current file, but the rollback now
only has to delete the one posts row.

> **⚠ Forward wiring for `source_url` (the piece that's missing today).** Old posts have
> no source URL (Phase 1 Step 1.2c). New ones *can* — but only if the URL is carried
> end-to-end, and **it currently isn't.** `raw_api_data.website` holds the real URL, but
> `main.py`'s `build_initial_state` never copies it into the graph state (it only maps
> `description`/`title`/`source_name`), so `state.get("source_url")` and
> `state.get("raw_id")` above are `None` unless you add the plumbing. When you rewrite
> the loop (Step 3.4), make `build_initial_state(post)` set:
> - `"source_url": post["website"]`
> - `"raw_id": post["id"]`   (so `raw_item_id` FK links post → raw row)
>
> and add both keys to `State` (`langgraph_bot/agentschema/stateschema.py`). Without this,
> every new post also gets a NULL `source_url` — the schema column exists but stays empty,
> exactly like the old rows.

> **⚠ Declare every new key in `State` — including one that's already broken.** LangGraph
> state is a `TypedDict`; a key that isn't declared has no reducer, and writing it from a
> node that runs in the parallel region is how you get `InvalidUpdateError` (or a silently
> dropped value). Phases 3.1–3.7 introduce these keys, none of which exist in
> `stateschema.py` today:
>
> `triage`, `should_process`, `embedding`, `is_duplicate`, `duplicate_of`, `difficulty`,
> `read_time`, `tags`, `source_url`, `raw_id`, `content`
>
> Use `replace_reducer` for scalars/strings, `replace_dict_reducer` for `triage`, and
> `replace_bytes_or_none_reducer`-style handling for anything binary.
>
> **Existing trap:** `main.py`'s `build_initial_state` already passes
> `"name": post['source_name']`, but **`name` is not declared in `State`** — and Step 3.5
> above reads it back as `state.get("name")` for the `source_name` column. Declare `name`
> too (or rename it to `source_name` in both places) while you're adding the rest.

> **⚠ The stored embedding describes the *source blurb*, not the finished post.** Step 3.2
> computes `embedding` from the raw title + description in order to dedup **before** paying
> for generation — that ordering is correct and deliberate. But Step 3.5/3.7 then persists
> that same vector to `posts.embedding`, which Phase 4 uses for "related posts". So related
> posts are matched on **RSS blurb similarity**, not on the similarity of the articles we
> actually wrote. That's a defensible trade (one embedding call instead of two, and blurbs
> are usually on-topic), but decide it consciously:
> - **Keep one embedding** → cheaper; accept that recommendations reflect the source text.
> - **Embed twice** → dedup on the blurb vector (pre-generation, discarded), then re-embed
>   `summary + description` after generation and store *that* in `posts.embedding`. One
>   extra cheap call per surviving item, and "related" then means what a reader expects.

> **⚠ Guaranteed content fetch (close the two-stage loop).** Phase 2 deliberately stores
> only title/description/URL (+ `content` when a feed shipped it). The **full article is
> meant to be fetched here, at generation time** — but the current `description_agent_node`
> (`nodes/anode/agentnode.py`) only *hopes* the agent chooses to call `scraper_tool`. It
> combines `state["data"]` with `state["tavily_search_result"]`, neither of which is
> guaranteed to be the source article. Make the fetch explicit so it can't be skipped:
> - Plumb both `"source_url": post["website"]` and `"content": post.get("content")` into
>   the initial state (alongside the Step 3.4 wiring above).
> - In the description node, if `state["content"]` is present, use it directly; otherwise
>   call `scraper_tool(state["source_url"])` (or `arxiv_tool` for ArXiv URLs) **before**
>   generation, and feed the result in as the primary source — Tavily stays as *added
>   context*, not the main body.
>
> This is the step that answers "title + URL isn't enough to write a post": correct — so
> generation re-fetches the body from the URL. Wire it explicitly rather than relying on
> tool-choice, or some posts will be written from the thin RSS blurb alone.

### Step 3.6 — Generate difficulty / read_time / tags (**MISSING — schema has these columns but nothing fills them**) ✅ *implemented — with zero extra LLM calls*

The new schema exposes `difficulty`, `read_time`, and `tags`, and Phase 4.3 puts them
in the UI — but nothing generates them, so they'd be NULL forever. Add an `enrich_node`
that produces them with a single cheap structured call (reuse the Groq client):

```python
class Enrichment(BaseModel):
    difficulty: str   # 'beginner' | 'intermediate' | 'advanced'
    read_time: str    # e.g. "5 min read"
    tags: list[str]   # 3-6 topic tags
```
Feed it the generated summary/description; write the three fields into state so
Step 3.5 persists them. (Alternatively compute `read_time` deterministically from word
count and only LLM-generate difficulty + tags — cheaper and more consistent.)

### Step 3.7 — Ensure embedding is written to posts ✅ *implemented*
Step 3.5 already includes `embedding` in the insert. If you'd rather keep the insert
minimal, write it back separately after insert:
```python
supabase.table("posts").update({
    "embedding": state.get("embedding"),
}).eq("slug", state["slug"]).execute()
```

### Phase 3 — verification (run against a live queue, not unit tests)

Confirmed working on 2026-07-29 against local Supabase with two real `pending` arXiv
items (`{'total': 2, 'succeeded': 2, 'skipped': 0, 'failed': 0}`):

- [x] `mjorgraph` compiles; `draw_mermaid` shows `triage → dedup → {END | both subgraphs} → enrich → END`
- [x] triage filters correctly — funding + opinion stories return `should_process=False`;
      a model release scores 5, a framework release 3
- [x] embedding is 768-dim and lands non-NULL in `posts.embedding`
- [x] `match_posts` returns the just-inserted post at similarity `1.000` on a re-run, and
      `_skip_reason()` reports `duplicate of <slug>`
- [x] `posts` rows carry `slug`, `title`, `summary`, `description`, `source_url`,
      `source_name`, `tags`, `difficulty`, `read_time`, `raw_item_id`
- [x] `raw_api_data.status` ends `succeeded` with `last_error IS NULL`
- [ ] **`image_url` is NULL** — Pollinations returns `402` (the key is out of
      credits/quota), and the node correctly degrades rather than failing the post. Also
      bumped the read timeout 60s → 180s, since `gptimage` at 1600×900 `quality=high`
      routinely exceeds a minute and was timing out even before the 402. Not a code fix:
      top up or swap the image provider.
- [ ] Skip-rate calibration on a 10+ item run (only 2 items exercised so far; both passed
      triage, so the strictness of the allowlist is still unmeasured).

### Step 3.8 — LangGraph/LangChain concepts to adopt (what we're not using yet)

The current bot already gets the fundamentals right: a reducer-typed `TypedDict` state
(`agentschema/stateschema.py`), a parallel fan-out (description ∥ summary), structured
output in triage, and `draw_mermaid_png` diagrams. The following are concepts we're
**not** using yet, ordered by value-for-effort. None are required for the pipeline to
work — they're what turns "a graph that runs" into "a resumable, observable,
fault-tolerant pipeline," which is the vocabulary that reads as production-grade.

**Tier A — high value, low effort (do these):**

1. **Structured output on every generative node, not just triage.** Any node that
   produces fields (title_block, summary, and the Step 3.6 enrich node) should use
   `llm.with_structured_output(PydanticModel)` instead of returning free text we parse.
   Kills brittle string-parsing and validates for free. The triage node already proves
   the pattern — propagate it.
2. **`RunnableConfig` on every `.invoke()`.** Pass
   `config={"run_name": "triage", "tags": [source_name], "metadata": {"raw_id": id}}`.
   One line; makes every trace (Tier B #4) actually filterable by source/item.
3. **`RetryPolicy` on nodes.** `graph.add_node("summary", summary_node,
   retry=RetryPolicy(max_attempts=3))` — the LLM-call equivalent of the adapter
   belt-and-suspenders. A transient Groq 429 retries automatically instead of failing
   the whole item. Cleaner than a try/except inside the node.

**Tier B — high value, medium effort (strongest portfolio signal):**

4. **LangSmith tracing.** Set `LANGCHAIN_TRACING_V2=true`, `LANGCHAIN_API_KEY`,
   `LANGCHAIN_PROJECT` — every node, LLM call, token count, and latency is traced with
   **zero code changes**. A trace of one post going triage → dedup → generation is a
   better artifact than the mermaid diagram. Free tier is generous.
5. **A checkpointer (`PostgresSaver`).** The graph currently compiles with no
   checkpointer, so a crash mid-item loses all work done on it. Compile with
   `checkpointer=PostgresSaver(...)` and a `thread_id` per raw item → **resumability**:
   re-running a failed item skips the expensive steps it already completed. Reuses the
   Supabase Postgres we already have, and pairs naturally with the `status` column story.
   **Two gotchas that will bite immediately:**
   - It's a **separate dependency** — `uv add langgraph-checkpoint-postgres` (it does not
     ship with `langgraph`), and you must call `checkpointer.setup()` once to create its
     tables.
   - Use the Supabase **session / direct** connection string, **not** the transaction
     pooler on port **6543**. `PostgresSaver` uses prepared statements, which the
     transaction pooler doesn't support — you'll get
     `prepared statement "..." does not exist` errors that look random. Either use the
     direct connection, or pass a psycopg connection configured with
     `prepare_threshold=None`.
6. **`Send` API for dynamic fan-out (map-reduce).** `main.py` currently loops pending
   items in Python *outside* the graph. Moving that loop *inside* via
   `Send("process_item", per_item_state)` is the idiomatic LangGraph map-reduce
   primitive — also the right tool if enrichment ever fans out N tags/N sections, each
   its own LLM call.

**Tier C — situational:**

7. **A real tool-calling agent (`create_react_agent`).** `nodes/anode/agentnode.py` +
   `tools/tools.py` already hint at a scraper/tavily/arxiv tool setup, but Step 3.5's
   note flags that generation only *hopes* the agent calls the tool. A prebuilt
   `create_react_agent(llm, tools=[scraper_tool, arxiv_tool, tavily_tool])` as the
   generation sub-graph gives a real reason-and-tool loop — and is the canonical
   LangGraph "agent" everyone recognizes. This is also where the plan's **Tier 2 context
   sources** (Latent Space, Import AI) get wired in as research tools.
8. **`interrupt()` for human-in-the-loop.** With the checkpointer (#5), calling
   `interrupt()` before publishing pauses the graph for a human approve/reject, then
   resumes. "AI drafts, human approves" is a realistic, defensible design for a content
   platform.
9. **Streaming (`.stream()` / `astream_events`).** Only worth it behind a live
   "generate now" UI. For a daily batch job, skip.

**Deliberately skipped (architecture-for-its-own-sake at this scale):** nested LCEL
chain-of-chains (the graph *is* the orchestration), multi-agent supervisor/swarm (the
pipeline is linear), and custom `Command` routing (conditional edges already do this).

> **Highest impact-per-hour:** #3 (RetryPolicy), #4 (LangSmith), #5 (PostgresSaver
> checkpointer). Those three alone take the bot from "runs" to "resumable, observable,
> fault-tolerant."

**How to verify Phase 3 is done correctly:**
- Graph **compiles**, and `write_complete_graph_png()` shows triage → dedup → gate before
  either subgraph.
- Run the bot on 10 items. `raw_api_data` — every item ends in a non-`pending` status.
- **Count the skip rate on that run.** The live triage prompt is strict and the gate is
  `importance >= 2`, so a high skip rate is expected — but if 10/10 skip, the prompt is
  too tight (or `state["topic"]`/`state["data"]` aren't being populated) and no posts will
  ever be generated. Read the `reason` field on a few skips to confirm the calls are sane.
- Obvious non-AI articles (funding, generic tech) have `status = 'skipped'`.
- Insert the same article twice — second run gets `skipped` with reason `duplicate`.
- **`summary` is generated exactly once per item** (check the log/trace for a single
  `summary_agent` call, not two — see the race note in Step 3.3).
- `SELECT COUNT(*) FROM posts WHERE embedding IS NULL;` is 0 for newly generated posts.
- `SELECT COUNT(*) FROM posts WHERE difficulty IS NULL OR read_time IS NULL;` is 0 for newly generated posts (proves Step 3.6 works).
- `SELECT COUNT(*) FROM posts WHERE source_url IS NULL AND created_at > now() - interval '1 day';` is 0 (proves the Step 3.5 forward wiring works).

---

## Phase 4 — Frontend Cleanup
**Goal:** Remove the JSONB-unwrapping code, use slug as the natural key, add semantic
"related posts," and surface the new metadata.
**Demonstrates:** Clean API design, proper data fetching patterns.

> **⚠ Reconcile:** `frontend/lib/blog-data.ts` currently queries `post_content` with a
> join to `posts`, unwraps `content.title/summary/description/slug/generated_image`,
> and `getBlogPostBySlug()` fetches **all** posts then does a client-side `.find()`.
> All of that is replaced below.

### Step 4.1 — Simplify the queries (and don't over-select)
```typescript
// listing — NEVER select("*"): the embedding column is a 768-float array per row.
const { data: posts } = await supabase
  .from("posts")
  .select("id, slug, title, summary, image_url, tags, difficulty, read_time, published_at")
  .order("published_at", { ascending: false });

// detail — DB-level slug lookup, not a client-side find over all rows
const { data: post } = await supabase
  .from("posts")
  .select("id, slug, title, summary, description, image_url, tags, difficulty, read_time, source_url, source_name, published_at")
  .eq("slug", params.slug)
  .single();
```
Delete `mapRowToBlogPost` / `makeBlocks` JSONB-unwrapping helpers — the columns are now
first-class.

### Step 4.2 — Add a "Related Posts" section using embeddings
Do it **by post id via an RPC** so the browser never receives or re-sends an embedding:
```typescript
// after fetching the post
const { data: related } = await supabase
  .rpc("related_posts", { post_id: post.id, match_count: 3 });
```
(`related_posts` RPC defined in Step 1.6.) This is a genuinely impressive demo feature —
semantic relatedness, not tag matching.

### Step 4.3 — Surface difficulty + read time in the UI
Now backed by real generated columns (Phase 3 Step 3.6). Add a "Beginner · 5 min read"
badge to the card component. Small change, high visual impact — **but it only works
because Step 3.6 fills those columns.** If you skip 3.6, skip this or the badges render blank.

---

## Phase 4.5 — Tests (new — pytest is already a dependency, unused)

The plan leans on manual verification checklists (good), but the "migration discipline"
story is stronger with a couple of automated tests:
- **One adapter test** per adapter using a recorded/fixture feed (assert it returns
  `RawItem`s and that a bad feed yields `[]` + a logged error, not an exception).
- **One triage test** asserting an obvious funding-news headline returns
  `is_ai_relevant=False` (can be mocked to avoid live LLM calls in CI).
- **One migration smoke test** (optional): apply migration to a throwaway DB, assert
  `posts` has the expected columns and RLS allows an anon `SELECT`.

Keep it small — the point is to show the seams are testable, not to hit coverage targets.

---

## What This Looks Like as a Portfolio Project

After these phases, what you can point to:

**Architecture:** Multi-stage pipeline with clear separation — ingestion → triage →
dedup → generation → enrichment → storage. Each stage is independently testable and observable.

**Design decisions you can explain:** Why the adapter pattern (extensibility without
changing downstream code). Why triage runs before the expensive LLM calls (cost-aware
design). Why embeddings over exact-match dedup (semantic vs. text similarity). Why
status columns over date-range queries (observability + retry logic). Why an id-based
RPC for related posts (never ship embeddings to the client). Why HNSW over ivfflat at
this data size (no training set needed).

**Things that show up in the code:** pgvector similarity search, LangGraph conditional
edges and early exits, a passthrough fan-out to gate parallel branches, structured
outputs with Pydantic, reducer-typed graph state, DB migration discipline with rollback
safety (keeping `posts_old`) and RLS re-grant, adapter pattern with a common interface.

**Things that show up in the product:** Related posts via semantic search, difficulty
badges, no duplicate stories about the same model release, clean slug URLs.

---

## Suggested Commit Order

```
feat: reconcile redesign migration — add pgvector, embedding column, fix status enum
feat: re-establish RLS + public-read policy on renamed posts table
feat: add match_posts + related_posts RPCs for semantic search
refactor: adapter pattern for ingestion layer (arxiv, lab blogs, HN, github)
feat: status-aware upsert into raw_api_data
feat: triage node - filter non-AI and low-importance articles
feat: dedup node - semantic similarity check against existing posts
fix: langgraph graph - single fan-out gate, reducer-typed state (compiles)
feat: enrich node - generate difficulty / read_time / tags
refactor: bot writes flat posts table; status-driven pending loop
refactor: frontend queries flat posts table, remove JSONB unwrapping
feat: related posts section via id-based pgvector RPC
test: adapter + triage + migration smoke tests
chore: (optional) redis/arq scheduler — see Phase 5
```

Each commit is a working state — nothing is broken between steps.

---

## Phase 5 — Scheduling (OPTIONAL — pick one)
**Goal:** Poll each source on its own interval, decouple fetching from processing, and
handle failures with retries.
**Demonstrates:** Per-source scheduling, failure isolation, operational observability.

> **Decision point.** For a portfolio project, weigh two options honestly:
>
> **Option A — Multiple GitHub Actions workflows (recommended default).** One workflow
> file per source (or per cadence group), each with its own `cron`. You get per-source
> intervals and independent failure isolation with **zero new infrastructure, zero
> hosting cost, and a free audit trail**. This covers ~90% of the benefit of a queue.
>
> **Option B — Redis + ARQ worker (below).** A genuinely nice thing to demonstrate if
> you specifically want to talk about job-queue architecture — but it introduces an
> always-on worker process (real hosting cost + a second deploy surface) to replace a
> free cron. Only do this if the queue itself is the thing you want to show off.
>
> Either way, the LangGraph worker is unchanged — it just reads `WHERE status='pending'`.

### Option A — Split the cron (do this unless you have a reason not to)
Create separate workflows, e.g. `.github/workflows/ingest_arxiv.yml`,
`ingest_lab_blogs.yml`, etc., each running one adapter on its own schedule:
```yaml
# ingest_arxiv.yml
on:
  schedule:
    - cron: "*/30 * * * *"   # every 30 min — high paper volume
  workflow_dispatch:
# ... step: uv run python -c "from backend.services.ingestion.runner import run_one; run_one('arxiv')"
```
Keep generation (the LangGraph bot) on its own once-daily workflow (see Step 5.5).

### Option B — Redis-backed polling scheduler

#### Step 5.1 — Add Redis and ARQ
```toml
# backend/pyproject.toml
dependencies = [
  # ...
  "arq>=0.26",
  "redis>=5.0",
]
```
Local dev: `docker run -d -p 6379:6379 redis:7-alpine`. Production: Redis Cloud free
tier (30MB is plenty) or a Railway/Render Redis plugin.

#### Step 5.2 — Define your jobs
`backend/services/ingestion/jobs.py` — one job per adapter:
```python
from .adapters.arxiv_adapter import ArxivAdapter
from .adapters.lab_blog_adapter import LabBlogAdapter
from .adapters.hackernews_adapter import HackerNewsAdapter
from .adapters.github_trending_adapter import GithubTrendingAdapter
from db.repository.raw_repo import upsert_raw_items
import logging

logger = logging.getLogger(__name__)

async def fetch_arxiv(ctx: dict) -> int:
    try:
        items = ArxivAdapter().fetch()
        inserted = upsert_raw_items(items)
        logger.info(f"fetch_arxiv: {len(items)} fetched, {inserted} new")
        return inserted
    except Exception as e:
        logger.error(f"fetch_arxiv failed: {e}")
        raise  # re-raise so ARQ marks the job failed and retries

async def fetch_lab_blogs(ctx: dict) -> int:
    try:
        items = LabBlogAdapter().fetch()
        inserted = upsert_raw_items(items)
        logger.info(f"fetch_lab_blogs: {len(items)} fetched, {inserted} new")
        return inserted
    except Exception as e:
        logger.error(f"fetch_lab_blogs failed: {e}")
        raise

async def fetch_hackernews(ctx: dict) -> int:
    try:
        items = HackerNewsAdapter().fetch()
        inserted = upsert_raw_items(items)
        logger.info(f"fetch_hackernews: {len(items)} fetched, {inserted} new")
        return inserted
    except Exception as e:
        logger.error(f"fetch_hackernews failed: {e}")
        raise

async def fetch_github_trending(ctx: dict) -> int:
    try:
        items = GithubTrendingAdapter().fetch()
        inserted = upsert_raw_items(items)
        logger.info(f"fetch_github_trending: {len(items)} fetched, {inserted} new")
        return inserted
    except Exception as e:
        logger.error(f"fetch_github_trending failed: {e}")
        raise
```
> Note: adapter `fetch()` and `upsert_raw_items` are **sync/blocking** (httpx.get,
> feedparser, supabase-py). Calling them inside an `async def` job blocks the event
> loop. Either make the adapters async (httpx.AsyncClient) or run the blocking call in
> a thread (`await asyncio.to_thread(...)`). Don't leave sync I/O in an async job.

#### Step 5.3 — Worker + cron schedules
`backend/worker.py`:
```python
from arq import cron
from arq.connections import RedisSettings
from services.ingestion.jobs import (
    fetch_arxiv, fetch_lab_blogs, fetch_hackernews, fetch_github_trending
)
import os

class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(
        os.getenv("REDIS_URL", "redis://localhost:6379")
    )
    functions = [fetch_arxiv, fetch_lab_blogs, fetch_hackernews, fetch_github_trending]
    cron_jobs = [
        cron(fetch_arxiv,           hour=None, minute={0, 30}),      # every 30 min
        cron(fetch_lab_blogs,       hour=None, minute={0}),          # hourly
        cron(fetch_hackernews,      hour=None, minute={0, 20, 40}),  # every 20 min
        cron(fetch_github_trending, hour={0, 6, 12, 18}),            # 4x/day
    ]
    max_jobs = 10
    job_timeout = 300
    retry_jobs = True
    max_tries = 3
```
Intervals reflect publishing cadence: ArXiv is high-volume (30 min), lab announcements
are infrequent but time-sensitive (hourly), HN moves fast (20 min), GitHub trending
shifts slowly (4x/day). Tune once running.

#### Step 5.4 — Run the worker
```bash
arq backend.worker.WorkerSettings           # dev
# Procfile / Railway / Render:  worker: arq backend.worker.WorkerSettings
```

#### Step 5.5 — Keep GitHub Actions for the LangGraph bot only
Whichever scheduling option you pick, generation stays a once-daily batch:
```yaml
name: Run LangGraph Workflow
on:
  workflow_dispatch:
  schedule:
    - cron: "0 6 * * *"
jobs:
  run-langgraph-bot:
    runs-on: ubuntu-latest
    environment: Workflow
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: uv run -m langgraph_bot.main
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
          GROQ_API_KEY:  ${{ secrets.GROQ_API_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}   # also powers embeddings (gemini-embedding-001)
```
Remove the old `run-backend-main` scraper job (Option A workflows or the Redis worker
now own ingestion).

#### Step 5.6 — /health/jobs endpoint (make it actually show job history)
> The original snippet only called `redis.info()` — that shows Redis memory, **not job
> history**, which undercuts the whole "observability" pitch. ARQ stores structured
> results under `arq:result:*` keys and recent job metadata; surface those:
```python
# backend/routers/health.py
from fastapi import APIRouter
from arq.connections import create_pool, RedisSettings
import os

router = APIRouter(prefix="/health", tags=["health"])

@router.get("/jobs")
async def job_health():
    redis = await create_pool(
        RedisSettings.from_dsn(os.getenv("REDIS_URL", "redis://localhost:6379"))
    )
    results = await redis.all_job_results()   # actual per-job success/failure/timing
    return {
        "redis_connected": True,
        "recent_jobs": [
            {
                "function": r.function,
                "success": r.success,
                "finished_at": r.finish_time.isoformat() if r.finish_time else None,
                "result": r.result if r.success else str(r.result),
            }
            for r in sorted(results, key=lambda x: x.enqueue_time, reverse=True)[:20]
        ],
    }
```

### What you can explain about this design
- **Why (or why not) Redis over a DB-backed queue** — Redis + ARQ is simple and
  recognizable; a Postgres `SKIP LOCKED` queue is equally valid at this scale and adds
  no infra. Being able to say *why you chose the simpler cron* is itself a good answer.
- **Why ARQ over Celery** — async-native, near-zero config, fits FastAPI. Celery's
  extra power isn't needed here.
- **Why separate jobs per source** — one job = one failure mode; separate jobs fail,
  retry, and succeed independently, and the failing source is obvious in job history.
- **Why keep generation on GitHub Actions** — expensive, no value more than daily, free
  compute + audit trail + secret management.

### Verification checklist (Option B)
- `arq backend.worker.WorkerSettings` logs startup with scheduled cron times.
- Enqueue a job manually:
  ```python
  import asyncio
  from arq.connections import create_pool, RedisSettings
  async def main():
      redis = await create_pool(RedisSettings())
      await redis.enqueue_job("fetch_arxiv")   # use a REAL job name, not fetch_newsapi
  asyncio.run(main())
  ```
- New `raw_api_data` rows appear with `status='pending'` within seconds.
- Break one adapter (bad URL / bad token) — worker logs the failure, retries per
  `max_tries`, marks that job failed, and keeps running the others.
- `/health/jobs` shows recent per-job success/failure — not just Redis memory.
- The LangGraph bot run still works unchanged — it just finds more `pending` items.

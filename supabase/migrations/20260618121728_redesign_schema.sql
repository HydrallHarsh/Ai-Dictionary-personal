Create Extension If Not Exists vector;


ALTER Table raw_api_data
    Add Column status text default 'pending'
        Check (status in ('pending', 'processing', 'succeeded', 'skipped', 'failed')),
    Add Column retry_count int Default 0,
    Add Column last_error text,
    Add Column source_type text
        Check (source_type in ('rss', 'api', 'scraper', 'other')),
    -- generic per-source signal bag (HN points/comments, GitHub stars, etc.).
    -- jsonb (not fixed columns) so a new source's signals need no schema change.
    -- Backs RawData.engagement_meta.
    Add Column IF NOT EXISTS metadata jsonb Default '{}'::jsonb,
    -- full article body when a feed ships it (RSS content:encoded), else NULL.
    -- Backs RawData.content. Persisted (not in-process) because ingestion and
    -- generation are decoupled through the DB — see the note in Step 2.4.
    Add Column IF NOT EXISTS content text;

-- Drop the UNIQUE(title) constraint. `website` is the real identity key for a raw
-- item; titles are LLM-rewritten downstream and are NOT a reliable unique key
-- (two sources can carry the same headline). Keeping it would make the ingestion
-- upsert-on-website fail whenever a new URL happened to collide with an existing
-- title. Website uniqueness is kept.
Alter Table raw_api_data Drop Constraint If Exists raw_api_data_title_key;


Create table posts_v2(
    id  uuid Primary Key Default gen_random_uuid(),
    slug    text unique,
    title text not null,
    summary text,
    description text,
    source_url text,
    source_name text,
    image_url text,
    tags text[],
    difficulty text Check( difficulty in ('beginner', 'intermediate','advanced')),
    -- Could be a number for read time in minutes(maybe)
    read_time text,
    embedding vector(768),        -- Gemini gemini-embedding-001 truncated to 768 dims; powers dedup + related posts
    raw_item_id uuid references raw_api_data(id),
    likes_count int Default 0,
    created_at timestamptz Default now(),
    published_at timestamptz Default now()
);

-- This step is where we extract the JSONB content to table content

Insert into posts_v2(
    id, slug, title, summary, description, source_url, source_name, image_url, tags, likes_count, created_at, published_at
)

Select
    p.postid,
    pc.content ->> 'slug',
    p.title,
    pc.content ->> 'summary',
    pc.content ->> 'description',
    NULL::text,       -- source_url: unrecoverable for old posts. posts.source holds a
                      -- source *name* (e.g. "Hacker News"), not a URL. No stable key
                      -- exists to join back to raw_api_data.website. New posts will
                      -- have source_url written directly by the agent pipeline (Phase 3).
    p.source,         -- source_name
    pc.content ->> 'generated_image',
    Array[] :: text[],
    p.likescount,
    p.upload_date,
    Coalesce(p.approveddate, p.upload_date)
from posts p
JOIN post_content pc on pc.postid = p.postid;

-- Need to do this to enforce not Null slug for newer posts
ALTER TABLE posts_v2 ADD CONSTRAINT slug_required_for_new_posts
CHECK (
    created_at < '2026-06-18'::timestamptz
    OR slug IS NOT NULL
);

Alter table user_liked_posts DROP constraint if exists user_liked_posts_likedpostid_fkey;
ALTER TABLE user_liked_posts
  ADD CONSTRAINT user_liked_posts_likedpostid_fkey
  FOREIGN KEY (likedpostid) REFERENCES posts_v2(id);

  ALTER TABLE user_saved_posts DROP CONSTRAINT IF EXISTS user_saved_posts_savedpostid_fkey;
  ALTER TABLE user_saved_posts
    ADD CONSTRAINT user_saved_posts_savedpostid_fkey
    FOREIGN KEY (savedpostid) REFERENCES posts_v2(id);


-- Renaming old tables
Alter Table posts rename to posts_old;
Alter Table post_content rename to post_content_old;
Alter table posts_v2 rename to posts;


-- Re-establish RLS on the NEW posts table.
-- The original RLS migration only ENABLEd RLS on the old `posts`; after the rename
-- above those grants now belong to `posts_old`. Without this, the anon key reads
-- zero rows from the new table.
Alter Table posts Enable Row Level Security;

Create Policy "posts are publicly readable"
    On posts For Select
    Using (true);


--Creating Indexes
Create index on posts(slug);

-- HNSW (not ivfflat): ivfflat needs existing rows to cluster and degrades when built
-- on an empty/near-empty table. HNSW needs no training data, so it's safe at this size.
Create index on posts Using hnsw (embedding vector_cosine_ops);

Create index on raw_api_data(status) where status = 'pending';


-- Removing the RPC fundtion
Drop function if exists public.create_post_with_content;


Grant Select on table posts to anon;
Grant Select on table posts to authenticated;
Grant Select, Insert, Update, Delete on table posts to service_role;
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

-- Settle the pre-queue backlog before anything can claim it.
--
-- The status column above defaults to 'pending', so without this every row already in
-- the table becomes claimable and claim_pending_raw_items hands the whole archive back
-- to the generator, oldest first. Those articles were already consumed by the old
-- date-range fetch (fetch_last_days_posts), which recorded nothing about what it had
-- processed - there is no column, timestamp, or join key that marks consumption, so
-- "everything present when this migration runs" is the only boundary available.
--
-- Dedup would not save us: the posts backfilled into posts_v2 below have no embedding,
-- and match_posts only compares against rows where embedding is not null. Every re-run
-- item would come back "not a duplicate" and publish a second copy.
--
-- 'skipped' rather than 'succeeded' because we are not asserting a post exists, only
-- that this run loop must not pick it up. To re-open a window, reset it explicitly:
--     Update raw_api_data Set status = 'pending', last_error = Null
--     Where status = 'skipped' And last_error = 'pre-queue backlog'
--       And created_at >= '<cutoff>'::timestamptz;
Update raw_api_data Set status = 'skipped', last_error = 'pre-queue backlog';


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
    -- Carried forward from the old post_content.isoldpost column so the listing
    -- query can continue excluding rows that were hidden before the redesign.
    -- New posts never set this; the default keeps them visible.
    is_old_post boolean Not Null Default false,
    created_at timestamptz Default now(),
    published_at timestamptz Default now()
);

-- This step is where we extract the JSONB content to table content

Insert into posts_v2(
    id, slug, title, summary, description, source_url, source_name, image_url, tags, likes_count, is_old_post, created_at, published_at
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
    Coalesce(pc.isoldpost, false),   -- carry the hidden-post flag into the new schema
    -- `upload_date` and `approveddate` are `timestamp without time zone`, so the
    -- implicit cast into these `timestamptz` columns would interpret them using
    -- whatever TimeZone the session applying this migration happens to have. The
    -- pipeline wrote them with `now()` on a naive column under Supabase's default
    -- UTC, and the frontend has always formatted them with `timeZone: 'UTC'`, so
    -- UTC is the correct reading -- stated here rather than inherited from the
    -- environment, or the same row lands on a different calendar day depending on
    -- where the migration was applied from.
    p.upload_date At Time Zone 'UTC',
    Coalesce(p.approveddate, p.upload_date) At Time Zone 'UTC'
from posts p
JOIN post_content pc on pc.postid = p.postid;


-- Need to do this to enforce not Null slug for newer posts
ALTER TABLE posts_v2 ADD CONSTRAINT slug_required_for_new_posts
CHECK (
    created_at < '2026-06-18'::timestamptz
    OR slug IS NOT NULL
);

-- Preserve historical rows that may not have a generated description, but reject
-- NULL, empty, and whitespace-only descriptions for every post created by the redesign.
ALTER TABLE posts_v2 ADD CONSTRAINT description_required_for_new_posts
CHECK (
    created_at < '2026-06-18'::timestamptz
    OR NULLIF(BTRIM(description), '') IS NOT NULL
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

-- One post per raw item. claim_pending_raw_items already stops two concurrent runs
-- from processing the same row; this is the backstop for what it does not cover, such
-- as a hand-edited status or a replayed insert. Partial because every historical post
-- backfilled above has raw_item_id NULL and they would otherwise collide.
Create Unique Index posts_raw_item_id_key On posts(raw_item_id) Where raw_item_id Is Not Null;


-- Removing the RPC fundtion
Drop function if exists public.create_post_with_content;


Grant Select on table posts to anon;
Grant Select on table posts to authenticated;
Grant Select, Insert, Update, Delete on table posts to service_role;


-- Atomically claim queue work so overlapping workers cannot process the same item.
Create Or Replace Function public.claim_pending_raw_items(p_limit integer Default 20)
Returns Setof public.raw_api_data
Language plpgsql
Security Definer
Set search_path = public
As $$
Begin
    If Coalesce(p_limit, 0) <= 0 Then
        Return;
    End If;

    Return Query
    With candidates As (
        Select item.id
        From public.raw_api_data As item
        Where item.status = 'pending'
        Order By item.created_at Asc, item.id Asc
        For Update Skip Locked
        Limit Least(p_limit, 100)
    )
    Update public.raw_api_data As item
    Set status = 'processing',
        last_error = Null
    From candidates
    Where item.id = candidates.id
      And item.status = 'pending'
    Returning item.*;
End;
$$;


-- Require every terminal update to observe the state established by the claim.
Create Or Replace Function public.transition_raw_item_status(
    p_raw_id uuid,
    p_expected_status text,
    p_new_status text,
    p_error text Default Null
)
Returns boolean
Language plpgsql
Security Definer
Set search_path = public
As $$
Declare
    updated_rows integer;
Begin
    If p_expected_status Not In ('pending', 'processing', 'succeeded', 'skipped', 'failed') Then
        Raise Exception 'invalid expected raw item status: %', p_expected_status;
    End If;

    If p_new_status Not In ('pending', 'processing', 'succeeded', 'skipped', 'failed') Then
        Raise Exception 'invalid new raw item status: %', p_new_status;
    End If;

    Update public.raw_api_data
    Set status = p_new_status,
        last_error = p_error,
        retry_count = Case
            When p_new_status = 'failed' Then Coalesce(retry_count, 0) + 1
            Else retry_count
        End
    Where id = p_raw_id
      And status = p_expected_status;

    Get Diagnostics updated_rows = Row_Count;
    Return updated_rows = 1;
End;
$$;


Revoke All On Function public.claim_pending_raw_items(integer) From Public, anon, authenticated;
Revoke All On Function public.transition_raw_item_status(uuid, text, text, text) From Public, anon, authenticated;

Grant Execute On Function public.claim_pending_raw_items(integer) To service_role;
Grant Execute On Function public.transition_raw_item_status(uuid, text, text, text) To service_role;


-- Aggregate-only pipeline figures for the public landing page.
--
-- `raw_api_data` has RLS on and no read policy, and should keep it that way: the
-- rows carry scraped article bodies, source URLs and triage failure text, none of
-- which belongs on a public page. But the landing page's entire claim — "we read
-- N, we kept M" — is counted from that table. This function is the seam. Security
-- Definer so it can count rows the caller cannot see; returning a single jsonb of
-- aggregates so nothing row-level can escape through it. It is the only object
-- granted to anon that reads raw_api_data at all.
--
-- search_path is emptied rather than set to `public` as the two service_role
-- functions above do. Those are reachable only by a trusted role; this one is
-- reachable by anyone with the publishable key, so every name it resolves is
-- spelled out and none of them can be shadowed by a schema the caller controls.
Create Or Replace Function public.pipeline_stats()
Returns jsonb
Language sql
Stable
Security Definer
Set search_path = ''
As $$
    With cohort As (
        Select
            item.id,
            item.status,
            item.source_name,
            -- UTC wall clock. Bucket edges must not drift with the server's
            -- TimeZone setting, and the page labels them in UTC.
            item.created_at At Time Zone 'UTC' As read_at
        From public.raw_api_data As item
        -- The redesign stamped every pre-existing row 'skipped'/'pre-queue backlog'
        -- so the new run loop would leave it alone. Those are reads this pipeline
        -- never made, so they are not throughput. `Is Not Distinct From` because a
        -- NULL status would otherwise make the whole predicate NULL and silently
        -- drop a live row.
        Where Not (
            item.status Is Not Distinct From 'skipped'
            And item.last_error Is Not Distinct From 'pre-queue backlog'
        )
    ),
    scored As (
        Select
            cohort.read_at,
            cohort.source_name,
            -- 'pending' and 'processing' are in flight: read, but not yet judged.
            -- They are excluded from the keep rate's denominator rather than
            -- counted as rejections.
            (cohort.status In ('succeeded', 'skipped', 'failed')) As is_resolved,
            Exists (
                Select 1
                From public.posts As post
                Where post.raw_item_id = cohort.id
            ) As is_kept
        From cohort
    ),
    span As (
        Select
            Min(scored.read_at) As first_read,
            Max(scored.read_at) As last_read,
            -- Weekly while the history is short; a three-column monthly axis is
            -- not a trend. Decided here, and reported back as `granularity` so
            -- the chart labels cannot disagree with the buckets they label.
            Case
                When Max(scored.read_at) - Min(scored.read_at) < Interval '70 days'
                    Then 'week'
                Else 'month'
            End As granularity
        From scored
    ),
    edges As (
        Select
            span.granularity,
            Generate_Series(
                Date_Trunc(span.granularity, span.first_read),
                Date_Trunc(span.granularity, span.last_read),
                ('1 ' || span.granularity)::interval
            ) As bucket_start
        From span
        Where span.first_read Is Not Null
    ),
    buckets As (
        -- Left join so an idle week still produces a row. Dropping empty buckets
        -- would compress the axis and make a gap look like continuous operation.
        Select
            edges.bucket_start,
            edges.granularity,
            Count(scored.read_at) As n_read,
            Count(*) Filter (Where scored.is_kept) As n_kept,
            Count(*) Filter (Where scored.is_resolved) As n_resolved
        From edges
        Left Join scored
            On Date_Trunc(edges.granularity, scored.read_at) = edges.bucket_start
        Group By edges.bucket_start, edges.granularity
    )
    Select jsonb_build_object(
        'articles_read', (Select Count(*) From scored),
        'entries_kept', (Select Count(*) Filter (Where scored.is_kept) From scored),
        'resolved', (Select Count(*) Filter (Where scored.is_resolved) From scored),
        'sources', (Select Count(Distinct scored.source_name) From scored),
        -- Formatted here rather than left to jsonb's timestamp rendering, which
        -- follows the session's DateStyle. The client parses these.
        'first_run', (
            Select To_Char(span.first_read, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') From span
        ),
        'last_run', (
            Select To_Char(span.last_read, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') From span
        ),
        'granularity', (Select span.granularity From span),
        'buckets', Coalesce(
            (
                Select jsonb_agg(
                    jsonb_build_object(
                        'start', To_Char(buckets.bucket_start, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                        'read', buckets.n_read,
                        'kept', buckets.n_kept,
                        'resolved', buckets.n_resolved,
                        -- The window is still open, so its volume is not yet
                        -- comparable to a closed one's.
                        'partial', (
                            buckets.bucket_start + ('1 ' || buckets.granularity)::interval
                        ) > (Now() At Time Zone 'UTC')
                    )
                    Order By buckets.bucket_start
                )
                From buckets
            ),
            '[]'::jsonb
        )
    );
$$;

Revoke All On Function public.pipeline_stats() From Public;
Grant Execute On Function public.pipeline_stats() To anon, authenticated, service_role;

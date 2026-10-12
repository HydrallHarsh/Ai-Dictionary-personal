CREATE or Replace FUNCTION match_posts(
    query_embedding vector(768),
    match_threshold float,
    match_Count int
)

RETURNS TABLE (id uuid, title text, slug text, similarity float)
LANGUAGE sql STABLE
Security Definer
Set search_path = public
AS $$
    SELECT id, title, slug,
    1 - (embedding <=> query_embedding) AS similarity
    from posts
    where embedding is NOT NULL
        and 1 - (embedding <=> query_embedding) > match_threshold
    ORDER BY embedding <=> query_embedding LIMIT match_count;
$$;

CREATE or Replace Function related_posts(
    post_id uuid,
    match_count int
)
Returns Table (id uuid, title text, slug text, similarity float)
Language sql Stable
Security Definer
Set search_path = public
AS $$
    Select p.id, p.title, p.slug, 1 - (p.embedding <=> src.embedding) AS similarity
    From posts p, (Select embedding from posts where id = post_id) src
    Where p.id <> post_id and p.embedding is NOT NULL 
    Order By p.embedding <=> src.embedding LIMIT match_count;
$$;

-- Neither function should be callable by the anonymous key: match_posts with a
-- low threshold and high limit returns the entire embedded corpus in one call,
-- and related_posts runs an uncapped vector scan. Authenticated users and the
-- service role are the only callers in the application.
Revoke All On Function public.match_posts(vector(768), float, int) From Public, anon;
Revoke All On Function public.related_posts(uuid, int) From Public, anon;

Grant Execute On Function public.match_posts(vector(768), float, int) To authenticated, service_role;
Grant Execute On Function public.related_posts(uuid, int) To authenticated, service_role;

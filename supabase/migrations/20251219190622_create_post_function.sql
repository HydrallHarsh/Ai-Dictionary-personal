set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_post_with_content(post_json jsonb, post_content_json jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
   new_post_id uuid;
   res jsonb;

BEGIN 

INSERT INTO posts
SELECT *
FROM jsonb_populate_record(NULL::posts, post_json)
RETURNING postid INTO new_post_id;

INSERT INTO post_content (
    postid,
    content,
    isoldpost
  )
  VALUES (
    new_post_id,
    post_content_json->'content',
    COALESCE((post_content_json->>'isoldpost')::boolean, false)
  );

select row_to_json(p) into res from posts p where p.posts = new_post_id;

return res;

END;
$function$
;


  create policy "admin policy"
  on "public"."post_content"
  as permissive
  for select
  to supabase_admin, supabase_storage_admin
using (true);




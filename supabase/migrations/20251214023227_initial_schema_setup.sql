
  create table "public"."post_content" (
    "postid" uuid not null,
    "content" jsonb not null,
    "isoldpost" boolean default false
      );



  create table "public"."posts" (
    "postid" uuid not null default gen_random_uuid(),
    "title" text not null,
    "source" text,
    "upload_date" timestamp without time zone default now(),
    "approveddate" timestamp without time zone default now(),
    "likescount" integer default 0
      );



  create table "public"."user_liked_posts" (
    "userid" uuid not null,
    "likedpostid" uuid not null
      );



  create table "public"."user_saved_posts" (
    "userid" uuid not null,
    "savedpostid" uuid not null
      );



  create table "public"."users" (
    "id" uuid not null default gen_random_uuid(),
    "username" text,
    "name" text,
    "email" text,
    "joining_date" timestamp without time zone default now()
      );


CREATE UNIQUE INDEX post_content_pkey ON public.post_content USING btree (postid);

CREATE UNIQUE INDEX posts_pkey ON public.posts USING btree (postid);

CREATE UNIQUE INDEX user_liked_posts_pkey ON public.user_liked_posts USING btree (userid, likedpostid);

CREATE UNIQUE INDEX user_saved_posts_pkey ON public.user_saved_posts USING btree (userid, savedpostid);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

alter table "public"."post_content" add constraint "post_content_pkey" PRIMARY KEY using index "post_content_pkey";

alter table "public"."posts" add constraint "posts_pkey" PRIMARY KEY using index "posts_pkey";

alter table "public"."user_liked_posts" add constraint "user_liked_posts_pkey" PRIMARY KEY using index "user_liked_posts_pkey";

alter table "public"."user_saved_posts" add constraint "user_saved_posts_pkey" PRIMARY KEY using index "user_saved_posts_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."post_content" add constraint "post_content_postid_fkey" FOREIGN KEY (postid) REFERENCES public.posts(postid) ON DELETE CASCADE not valid;

alter table "public"."post_content" validate constraint "post_content_postid_fkey";

alter table "public"."user_liked_posts" add constraint "user_liked_posts_likedpostid_fkey" FOREIGN KEY (likedpostid) REFERENCES public.posts(postid) not valid;

alter table "public"."user_liked_posts" validate constraint "user_liked_posts_likedpostid_fkey";

alter table "public"."user_liked_posts" add constraint "user_liked_posts_userid_fkey" FOREIGN KEY (userid) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_liked_posts" validate constraint "user_liked_posts_userid_fkey";

alter table "public"."user_saved_posts" add constraint "user_saved_posts_savedpostid_fkey" FOREIGN KEY (savedpostid) REFERENCES public.posts(postid) ON DELETE CASCADE not valid;

alter table "public"."user_saved_posts" validate constraint "user_saved_posts_savedpostid_fkey";

alter table "public"."user_saved_posts" add constraint "user_saved_posts_userid_fkey" FOREIGN KEY (userid) REFERENCES public.users(id) ON DELETE CASCADE not valid;
alter table "public"."user_saved_posts" validate constraint "user_saved_posts_userid_fkey";

grant delete on table "public"."post_content" to "anon";

grant insert on table "public"."post_content" to "anon";

grant references on table "public"."post_content" to "anon";

grant select on table "public"."post_content" to "anon";

grant trigger on table "public"."post_content" to "anon";

grant truncate on table "public"."post_content" to "anon";

grant update on table "public"."post_content" to "anon";

grant delete on table "public"."post_content" to "authenticated";

grant insert on table "public"."post_content" to "authenticated";

grant references on table "public"."post_content" to "authenticated";

grant select on table "public"."post_content" to "authenticated";

grant trigger on table "public"."post_content" to "authenticated";

grant truncate on table "public"."post_content" to "authenticated";

grant update on table "public"."post_content" to "authenticated";

grant delete on table "public"."post_content" to "service_role";

grant insert on table "public"."post_content" to "service_role";

grant references on table "public"."post_content" to "service_role";

grant select on table "public"."post_content" to "service_role";

grant trigger on table "public"."post_content" to "service_role";

grant truncate on table "public"."post_content" to "service_role";

grant update on table "public"."post_content" to "service_role";

grant delete on table "public"."posts" to "anon";

grant insert on table "public"."posts" to "anon";

grant references on table "public"."posts" to "anon";

grant select on table "public"."posts" to "anon";

grant trigger on table "public"."posts" to "anon";

grant truncate on table "public"."posts" to "anon";

grant update on table "public"."posts" to "anon";

grant delete on table "public"."posts" to "authenticated";

grant insert on table "public"."posts" to "authenticated";

grant references on table "public"."posts" to "authenticated";

grant select on table "public"."posts" to "authenticated";

grant trigger on table "public"."posts" to "authenticated";

grant truncate on table "public"."posts" to "authenticated";

grant update on table "public"."posts" to "authenticated";

grant delete on table "public"."posts" to "service_role";

grant insert on table "public"."posts" to "service_role";

grant references on table "public"."posts" to "service_role";

grant select on table "public"."posts" to "service_role";

grant trigger on table "public"."posts" to "service_role";

grant truncate on table "public"."posts" to "service_role";

grant update on table "public"."posts" to "service_role";

grant delete on table "public"."user_liked_posts" to "anon";

grant insert on table "public"."user_liked_posts" to "anon";

grant references on table "public"."user_liked_posts" to "anon";

grant select on table "public"."user_liked_posts" to "anon";

grant trigger on table "public"."user_liked_posts" to "anon";

grant truncate on table "public"."user_liked_posts" to "anon";

grant update on table "public"."user_liked_posts" to "anon";

grant delete on table "public"."user_liked_posts" to "authenticated";

grant insert on table "public"."user_liked_posts" to "authenticated";

grant references on table "public"."user_liked_posts" to "authenticated";

grant select on table "public"."user_liked_posts" to "authenticated";

grant trigger on table "public"."user_liked_posts" to "authenticated";

grant truncate on table "public"."user_liked_posts" to "authenticated";

grant update on table "public"."user_liked_posts" to "authenticated";

grant delete on table "public"."user_liked_posts" to "service_role";

grant insert on table "public"."user_liked_posts" to "service_role";

grant references on table "public"."user_liked_posts" to "service_role";

grant select on table "public"."user_liked_posts" to "service_role";

grant trigger on table "public"."user_liked_posts" to "service_role";

grant truncate on table "public"."user_liked_posts" to "service_role";

grant update on table "public"."user_liked_posts" to "service_role";

grant delete on table "public"."user_saved_posts" to "anon";

grant insert on table "public"."user_saved_posts" to "anon";

grant references on table "public"."user_saved_posts" to "anon";

grant select on table "public"."user_saved_posts" to "anon";

grant trigger on table "public"."user_saved_posts" to "anon";

grant truncate on table "public"."user_saved_posts" to "anon";

grant update on table "public"."user_saved_posts" to "anon";

grant delete on table "public"."user_saved_posts" to "authenticated";

grant insert on table "public"."user_saved_posts" to "authenticated";

grant references on table "public"."user_saved_posts" to "authenticated";

grant select on table "public"."user_saved_posts" to "authenticated";

grant trigger on table "public"."user_saved_posts" to "authenticated";

grant truncate on table "public"."user_saved_posts" to "authenticated";

grant update on table "public"."user_saved_posts" to "authenticated";

grant delete on table "public"."user_saved_posts" to "service_role";

grant insert on table "public"."user_saved_posts" to "service_role";

grant references on table "public"."user_saved_posts" to "service_role";

grant select on table "public"."user_saved_posts" to "service_role";

grant trigger on table "public"."user_saved_posts" to "service_role";

grant truncate on table "public"."user_saved_posts" to "service_role";

grant update on table "public"."user_saved_posts" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";



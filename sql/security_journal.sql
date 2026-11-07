-- =====================================================================
--  exyn / pecel.site — security + journal migration (2026)
--  Project: ziibivkhualutrdiojto
--  Jalankan di Supabase Dashboard > SQL Editor > Run.
--  Aman dijalankan ulang (idempotent).
--
--  Yang diperbaiki:
--   1) Owner login pakai Supabase Auth magic link (bukan hash di client).
--   2) Semua RPC admin memakai public.is_owner(), bukan password hash.
--   3) Foto secret tidak lagi bisa dibaca publik; hanya lewat token
--      sementara setelah password diverifikasi (rate limited).
--   4) Rating tidak menyimpan / membocorkan IP mentah.
--   5) Inbox pesan contact (email + subject + status) untuk owner.
--   6) Tabel posts untuk Journal / Now + admin editor.
--   7) RLS + grant dirapikan; fungsi lama ber-hash dihapus.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- =====================================================================
-- 0) HELPERS
-- =====================================================================
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    coalesce(auth.role(), '') = 'authenticated'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('Exceladila123@gmail.com');
$$;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;

-- IP hanya dipakai di server, lalu di-hash. Tidak pernah dikirim ke client.
create or replace function public.request_ip_hash()
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_headers jsonb;
  v_ip text;
begin
  begin
    v_headers := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  v_ip := coalesce(
    nullif(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1), ''),
    nullif(v_headers ->> 'cf-connecting-ip', ''),
    nullif(v_headers ->> 'x-real-ip', ''),
    'unknown'
  );

  return encode(
    extensions.digest(btrim(v_ip) || '|exyn-rating-v1|' || '8f4a62c1', 'sha256'),
    'hex'
  );
end;
$$;

revoke all on function public.request_ip_hash() from public;
revoke all on function public.request_ip_hash() from anon, authenticated;

-- =====================================================================
-- 1) RATINGS — privasi IP + vote 1x per jaringan
-- =====================================================================
-- Baris probe yang sempat dibuat saat audit.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ratings' and column_name = 'ip'
  ) then
    execute 'delete from public.ratings where ip = ''__probe__''';
  end if;
end $$;

alter table public.ratings add column if not exists voter_hash text;
alter table public.ratings drop column if exists ip;

create unique index if not exists ratings_voter_hash_key
  on public.ratings (voter_hash)
  where voter_hash is not null;

alter table public.ratings enable row level security;

drop policy if exists "public read ratings" on public.ratings;
drop policy if exists "public insert ratings" on public.ratings;
drop policy if exists "owner read ratings" on public.ratings;

revoke all on public.ratings from anon, authenticated;

create or replace function public.vote_rating(p_score smallint)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  if p_score is null or p_score < 1 or p_score > 5 then
    raise exception 'bad score';
  end if;

  v_hash := public.request_ip_hash();

  if exists (select 1 from public.ratings where voter_hash = v_hash) then
    raise exception 'already voted';
  end if;

  insert into public.ratings (score, voter_hash) values (p_score, v_hash);
end;
$$;

create or replace function public.rating_summary()
returns table (avg_score numeric, vote_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(round(avg(score)::numeric, 2), 0) as avg_score,
    count(*)::bigint as vote_count
  from public.ratings;
$$;

create or replace function public.my_rating()
returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select score
  from public.ratings
  where voter_hash = public.request_ip_hash()
  limit 1;
$$;

create or replace function public.admin_list_ratings()
returns table (id bigint, score smallint, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;
  return query
    select r.id, r.score, r.created_at
    from public.ratings r
    order by r.id desc;
end;
$$;

create or replace function public.admin_update_rating(p_id bigint, p_score smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;
  if p_score is null or p_score < 1 or p_score > 5 then
    raise exception 'bad score';
  end if;
  update public.ratings set score = p_score where id = p_id;
end;
$$;

create or replace function public.admin_delete_rating(p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;
  delete from public.ratings where id = p_id;
  return found;
end;
$$;

-- Versi lama yang menerima IP dari client / hash owner.
drop function if exists public.vote_rating(smallint, text);
drop function if exists public.admin_update_rating(bigint, smallint, text);

revoke all on function public.vote_rating(smallint) from public;
revoke all on function public.rating_summary() from public;
revoke all on function public.my_rating() from public;
revoke all on function public.admin_list_ratings() from public;
revoke all on function public.admin_update_rating(bigint, smallint) from public;
revoke all on function public.admin_delete_rating(bigint) from public;

grant execute on function public.vote_rating(smallint) to anon, authenticated;
grant execute on function public.rating_summary() to anon, authenticated;
grant execute on function public.my_rating() to anon, authenticated;
grant execute on function public.admin_list_ratings() to authenticated;
grant execute on function public.admin_update_rating(bigint, smallint) to authenticated;
grant execute on function public.admin_delete_rating(bigint) to authenticated;

-- =====================================================================
-- 2) MESSAGES — inbox owner (bukan cuma insert)
-- =====================================================================
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.messages add column if not exists email text not null default '';
alter table public.messages add column if not exists subject text not null default 'Website message';
alter table public.messages add column if not exists status text not null default 'unread';
alter table public.messages add column if not exists ip_hash text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_status_check' and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_status_check
      check (status in ('unread', 'read', 'replied'));
  end if;
end $$;

alter table public.messages enable row level security;

drop policy if exists "public insert messages" on public.messages;
drop policy if exists "public read messages" on public.messages;
drop policy if exists "owner read messages" on public.messages;

revoke all on public.messages from anon, authenticated;

create or replace function public.send_message(
  p_name text,
  p_email text,
  p_subject text,
  p_message text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_id bigint;
  v_email text;
begin
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'name required';
  end if;
  if p_message is null or length(btrim(p_message)) < 2 then
    raise exception 'message required';
  end if;

  v_email := lower(btrim(coalesce(p_email, '')));
  if length(v_email) > 0 and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'bad email';
  end if;

  v_hash := public.request_ip_hash();

  if (
    select count(*) from public.messages
    where ip_hash = v_hash and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'too many messages';
  end if;

  insert into public.messages (name, email, subject, message, status, ip_hash)
  values (
    left(btrim(p_name), 60),
    left(v_email, 120),
    left(coalesce(nullif(btrim(p_subject), ''), 'Website message'), 100),
    left(btrim(p_message), 3000),
    'unread',
    v_hash
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.admin_list_messages()
returns table (id bigint, name text, email text, subject text, message text, status text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;
  return query
    select m.id, m.name, m.email, m.subject, m.message, m.status, m.created_at
    from public.messages m
    order by m.id desc;
end;
$$;

create or replace function public.admin_update_message(p_id bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;
  if p_status not in ('unread', 'read', 'replied') then
    raise exception 'bad status';
  end if;
  update public.messages set status = p_status where id = p_id;
end;
$$;

create or replace function public.admin_delete_message(p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;
  delete from public.messages where id = p_id;
  return found;
end;
$$;

revoke all on function public.send_message(text, text, text, text) from public;
revoke all on function public.admin_list_messages() from public;
revoke all on function public.admin_update_message(bigint, text) from public;
revoke all on function public.admin_delete_message(bigint) from public;

grant execute on function public.send_message(text, text, text, text) to anon, authenticated;
grant execute on function public.admin_list_messages() to authenticated;
grant execute on function public.admin_update_message(bigint, text) to authenticated;
grant execute on function public.admin_delete_message(bigint) to authenticated;

-- =====================================================================
-- 3) GALLERY — publik cuma baca foto gallery, secret lewat token
-- =====================================================================
alter table public.gallery_photos enable row level security;

drop policy if exists "gallery photos public read" on public.gallery_photos;
drop policy if exists "gallery photos public gallery read" on public.gallery_photos;

create policy "gallery photos public gallery read"
  on public.gallery_photos for select
  to anon, authenticated
  using (scope = 'gallery');

grant select on public.gallery_photos to anon, authenticated;
revoke insert, update, delete on public.gallery_photos from anon, authenticated;

create or replace function public.admin_add_gallery_photo(
  p_scope text,
  p_title text,
  p_caption text,
  p_cat text,
  p_image text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_scope text;
  v_cat text;
  v_next integer;
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;

  v_scope := case when p_scope = 'secret' then 'secret' else 'gallery' end;
  v_cat := lower(coalesce(nullif(btrim(p_cat), ''), 'people'));

  if p_image is null or length(btrim(p_image)) = 0 then
    raise exception 'image required';
  end if;
  if length(p_image) > 2500000 then
    raise exception 'image too large';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_next
  from public.gallery_photos where scope = v_scope;

  insert into public.gallery_photos (scope, title, caption, cat, image_url, sort_order)
  values (
    v_scope,
    left(coalesce(nullif(btrim(p_title), ''), 'Photo'), 70),
    left(coalesce(p_caption, ''), 200),
    v_cat,
    btrim(p_image),
    v_next
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.admin_delete_gallery_photo(p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;
  delete from public.gallery_photos where id = p_id;
  return found;
end;
$$;

drop function if exists public.admin_add_gallery_photo(text, text, text, text, text, text);
drop function if exists public.admin_delete_gallery_photo(text, bigint);

revoke all on function public.admin_add_gallery_photo(text, text, text, text, text) from public;
revoke all on function public.admin_delete_gallery_photo(bigint) from public;
grant execute on function public.admin_add_gallery_photo(text, text, text, text, text) to authenticated;
grant execute on function public.admin_delete_gallery_photo(bigint) to authenticated;

-- =====================================================================
-- 4) SECRET PAGE — password server-side + token sementara
-- =====================================================================
create table if not exists public.site_secrets (
  id integer primary key default 1,
  password_hash text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.site_secrets (id) values (1) on conflict (id) do nothing;
alter table public.site_secrets enable row level security;
revoke all on public.site_secrets from anon, authenticated;

create table if not exists public.secret_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists secret_attempts_ip_time_idx
  on public.secret_attempts (ip_hash, attempted_at desc);

alter table public.secret_attempts enable row level security;
revoke all on public.secret_attempts from anon, authenticated;

create table if not exists public.secret_sessions (
  token uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);

alter table public.secret_sessions enable row level security;
revoke all on public.secret_sessions from anon, authenticated;

create or replace function public.verify_secret_password(p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_ok boolean := false;
  v_ip text;
  v_token uuid;
begin
  if p_password is null or length(p_password) = 0 or length(p_password) > 72 then
    return null;
  end if;

  v_ip := public.request_ip_hash();

  if (
    select count(*) from public.secret_attempts
    where ip_hash = v_ip and attempted_at > now() - interval '15 minutes'
  ) >= 10 then
    raise exception 'too many attempts';
  end if;

  insert into public.secret_attempts (ip_hash) values (v_ip);

  select password_hash into v_hash from public.site_secrets where id = 1;

  if v_hash is not null and length(v_hash) > 0 then
    v_ok := extensions.crypt(p_password, v_hash) = v_hash;
  else
    -- Kompatibilitas: sebelum owner menyetel password baru lewat panel,
    -- pakai RPC verify_pw lama (kalau masih ada di database).
    begin
      execute 'select public.verify_pw($1)' into v_ok using p_password;
    exception when undefined_function or invalid_schema_name then
      v_ok := false;
    end;
  end if;

  if not coalesce(v_ok, false) then
    return null;
  end if;

  delete from public.secret_attempts
  where attempted_at < now() - interval '2 days';

  delete from public.secret_sessions where expires_at < now();

  insert into public.secret_sessions default values
  returning token into v_token;

  return v_token;
end;
$$;

create or replace function public.get_secret_photos(p_token uuid)
returns table (id bigint, title text, caption text, cat text, image_url text, sort_order integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null then
    raise exception 'locked';
  end if;
  if not exists (
    select 1 from public.secret_sessions
    where token = p_token and expires_at > now()
  ) then
    raise exception 'locked';
  end if;

  return query
    select p.id, p.title, p.caption, p.cat, p.image_url, p.sort_order
    from public.gallery_photos p
    where p.scope = 'secret'
    order by p.sort_order, p.id;
end;
$$;

create or replace function public.admin_set_secret_password(p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;
  if p_password is null or length(p_password) < 8 or length(p_password) > 72 then
    raise exception 'password must be 8-72 characters';
  end if;

  insert into public.site_secrets (id, password_hash, updated_at)
  values (1, extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now())
  on conflict (id) do update
    set password_hash = excluded.password_hash,
        updated_at = now();

  -- password baru = semua sesi lama langsung mati
  delete from public.secret_sessions;
  delete from public.secret_attempts;
end;
$$;

-- Kalau RPC lama masih ada, jangan biarkan anon memanggilnya langsung.
do $$
begin
  if to_regprocedure('public.verify_pw(text)') is not null then
    execute 'revoke execute on function public.verify_pw(text) from public, anon, authenticated';
  end if;
end $$;

revoke all on function public.verify_secret_password(text) from public;
revoke all on function public.get_secret_photos(uuid) from public;
revoke all on function public.admin_set_secret_password(text) from public;

grant execute on function public.verify_secret_password(text) to anon, authenticated;
grant execute on function public.get_secret_photos(uuid) to anon, authenticated;
grant execute on function public.admin_set_secret_password(text) to authenticated;

-- =====================================================================
-- 5) POSTS — Journal / Now + editor owner
-- =====================================================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  body text not null default '',
  kind text not null default 'journal',
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'posts_kind_check' and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_kind_check check (kind in ('journal', 'now'));
  end if;
end $$;

create index if not exists posts_published_idx
  on public.posts (published, published_at desc);

alter table public.posts enable row level security;

drop policy if exists "public read posts" on public.posts;
create policy "public read posts"
  on public.posts for select
  to anon, authenticated
  using (published = true);

grant select on public.posts to anon, authenticated;
revoke insert, update, delete on public.posts from anon, authenticated;

create or replace function public.admin_list_posts()
returns setof public.posts
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;
  return query select * from public.posts order by updated_at desc;
end;
$$;

create or replace function public.admin_save_post(
  p_id uuid,
  p_slug text,
  p_title text,
  p_excerpt text,
  p_body text,
  p_kind text,
  p_published boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_slug text;
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;
  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception 'title required';
  end if;

  v_slug := lower(btrim(coalesce(p_slug, '')));
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
  if length(v_slug) = 0 then
    v_slug := 'post-' || to_char(now(), 'YYYYMMDD-HH24MISS');
  end if;
  v_slug := left(v_slug, 80);

  if p_id is null then
    insert into public.posts (slug, title, excerpt, body, kind, published, published_at, updated_at)
    values (
      v_slug,
      left(btrim(p_title), 140),
      left(coalesce(p_excerpt, ''), 300),
      left(coalesce(p_body, ''), 50000),
      case when p_kind = 'now' then 'now' else 'journal' end,
      coalesce(p_published, false),
      case when coalesce(p_published, false) then now() else null end,
      now()
    )
    returning id into v_id;
  else
    update public.posts set
      slug = v_slug,
      title = left(btrim(p_title), 140),
      excerpt = left(coalesce(p_excerpt, ''), 300),
      body = left(coalesce(p_body, ''), 50000),
      kind = case when p_kind = 'now' then 'now' else 'journal' end,
      published = coalesce(p_published, false),
      published_at = case
        when coalesce(p_published, false) and published_at is null then now()
        else published_at
      end,
      updated_at = now()
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'post not found';
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.admin_delete_post(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;
  delete from public.posts where id = p_id;
  return found;
end;
$$;

revoke all on function public.admin_list_posts() from public;
revoke all on function public.admin_save_post(uuid, text, text, text, text, text, boolean) from public;
revoke all on function public.admin_delete_post(uuid) from public;
grant execute on function public.admin_list_posts() to authenticated;
grant execute on function public.admin_save_post(uuid, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.admin_delete_post(uuid) to authenticated;

-- =====================================================================
-- 6) SITE CONTENT — tulis hanya owner yang login
-- =====================================================================
alter table public.site_content enable row level security;

drop policy if exists "public read site content" on public.site_content;
create policy "public read site content"
  on public.site_content for select
  to anon, authenticated
  using (true);

grant select on public.site_content to anon, authenticated;
revoke insert, update, delete on public.site_content from anon, authenticated;

create or replace function public.admin_set_content(p_key text, p_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;
  if p_key is null or length(btrim(p_key)) = 0 or length(p_key) > 64 then
    raise exception 'bad key';
  end if;
  insert into public.site_content (key, value, updated_at)
  values (btrim(p_key), left(coalesce(p_value, ''), 2000), now())
  on conflict (key) do update
    set value = excluded.value, updated_at = now();
end;
$$;

drop function if exists public.admin_set_content(text, text, text);

revoke all on function public.admin_set_content(text, text) from public;
grant execute on function public.admin_set_content(text, text) to authenticated;

-- =====================================================================
-- 7) FEEDBACK — privat untuk owner
-- =====================================================================
alter table public.feedback enable row level security;

drop policy if exists "public read feedback" on public.feedback;
drop policy if exists "public insert feedback" on public.feedback;
create policy "public insert feedback"
  on public.feedback for insert
  to anon, authenticated
  with check (true);

revoke select, update, delete on public.feedback from anon, authenticated;
grant insert on public.feedback to anon, authenticated;

create or replace function public.admin_list_feedback()
returns setof public.feedback
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;
  return query select * from public.feedback order by id desc;
end;
$$;

create or replace function public.admin_update_feedback(p_id bigint, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;
  if p_message is null or length(btrim(p_message)) = 0 then
    raise exception 'empty message';
  end if;
  update public.feedback set message = left(p_message, 1000) where id = p_id;
end;
$$;

create or replace function public.admin_delete_feedback(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;
  delete from public.feedback where id = p_id;
end;
$$;

drop function if exists public.admin_update_feedback(bigint, text, text);
drop function if exists public.admin_delete_feedback(bigint, text);
drop function if exists public.admin_list_feedback(text);

revoke all on function public.admin_list_feedback() from public;
revoke all on function public.admin_update_feedback(bigint, text) from public;
revoke all on function public.admin_delete_feedback(bigint) from public;
grant execute on function public.admin_list_feedback() to authenticated;
grant execute on function public.admin_update_feedback(bigint, text) to authenticated;
grant execute on function public.admin_delete_feedback(bigint) to authenticated;

-- =====================================================================
-- 8) RUBIK LEADERBOARD — submit tanpa hash owner
-- =====================================================================
alter table public.rubik_scores enable row level security;

drop policy if exists "public read rubik scores" on public.rubik_scores;
create policy "public read rubik scores"
  on public.rubik_scores for select
  to anon, authenticated
  using (true);

grant select on public.rubik_scores to anon, authenticated;
revoke insert, update, delete on public.rubik_scores from anon, authenticated;

create or replace function public.submit_rubik_score(
  p_player_id text,
  p_name text,
  p_best_ms integer,
  p_scramble text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_player_id is null or length(btrim(p_player_id)) < 6 then
    raise exception 'bad player id';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'name required';
  end if;
  if p_best_ms is null or p_best_ms < 100 or p_best_ms > 3600000 then
    raise exception 'bad time';
  end if;
  if p_player_id = 'excel' and not public.is_owner() then
    raise exception 'reserved';
  end if;

  insert into public.rubik_scores (player_id, name, best_ms, scramble, updated_at)
  values (
    p_player_id,
    left(btrim(p_name), 20),
    p_best_ms,
    nullif(left(btrim(coalesce(p_scramble, '')), 80), ''),
    now()
  )
  on conflict (player_id) do update
    set best_ms = least(public.rubik_scores.best_ms, excluded.best_ms),
        name = excluded.name,
        scramble = case
          when excluded.best_ms < public.rubik_scores.best_ms
            then coalesce(excluded.scramble, public.rubik_scores.scramble)
          else public.rubik_scores.scramble
        end,
        updated_at = case
          when excluded.best_ms < public.rubik_scores.best_ms then now()
          else public.rubik_scores.updated_at
        end;
end;
$$;

create or replace function public.admin_delete_rubik_score(p_player_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden';
  end if;
  if p_player_id is null or length(btrim(p_player_id)) = 0 then
    raise exception 'bad player id';
  end if;
  delete from public.rubik_scores where player_id = p_player_id;
  return found;
end;
$$;

drop function if exists public.submit_rubik_score(text, text, integer, text, text);
drop function if exists public.admin_delete_rubik_score(text, text);

revoke all on function public.submit_rubik_score(text, text, integer, text) from public;
revoke all on function public.admin_delete_rubik_score(text) from public;
grant execute on function public.submit_rubik_score(text, text, integer, text) to anon, authenticated;
grant execute on function public.admin_delete_rubik_score(text) to authenticated;

-- =====================================================================
-- 9) REALTIME (opsional, aman kalau sudah ada)
-- =====================================================================
do $$
begin
  alter publication supabase_realtime add table public.site_content;
exception when duplicate_object or undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.rubik_scores;
exception when duplicate_object or undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.gallery_photos;
exception when duplicate_object or undefined_object then null;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
-- SELESAI. Cek cepat:
--   select public.is_owner(); -- false kalau belum login (normal)
--   select * from public.rating_summary();
--   select id, name, subject, status from public.messages order by id desc;
--   select slug, title, published from public.posts order by updated_at desc;
-- =====================================================================

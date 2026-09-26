-- BuyLink complete schema
-- Safe to run this entire file top to bottom, any number of times, on
-- any BuyLink Supabase project — new or existing. Every statement is
-- idempotent: tables use `if not exists`, every policy is dropped then
-- recreated instead of erroring if it already exists, and the one
-- naturally non-idempotent statement (adding a table to the Realtime
-- publication) is wrapped in a check. If something in your app errors
-- referencing a missing table/column/function/policy, the fix is
-- almost always just: paste this whole file into the Supabase SQL
-- editor and run it again.

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text default 'buyer',
  avatar_url text,
  location text,
  banned boolean default false,
  created_at timestamptz default now()
);

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  description text,
  category text,
  logo_url text,
  verified boolean default false,
  verification_status text default 'none',
  id_document_url text,
  business_proof_url text,
  verification_note text,
  verification_submitted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade not null,
  title text not null,
  description text,
  price numeric(12, 2) not null,
  category text,
  stock_qty integer default 1,
  photo_urls text[] default '{}',
  created_at timestamptz default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references profiles(id) on delete cascade not null,
  seller_id uuid references profiles(id) on delete cascade not null,
  product_id uuid references products(id) on delete set null,
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (buyer_id, seller_id, product_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  text text not null,
  created_at timestamptz default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  store_id uuid references stores(id) on delete cascade not null,
  media_url text not null,
  media_type text check (media_type in ('photo', 'video')) default 'photo',
  caption text,
  likes_count integer default 0,
  comments_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists likes (
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  text text not null,
  created_at timestamptz default now()
);

create table if not exists follows (
  follower_id uuid references profiles(id) on delete cascade not null,
  followed_store_id uuid references stores(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (follower_id, followed_store_id)
);

-- ============================================================
-- COLUMN / CONSTRAINT SAFETY NET
-- For tables that already existed on your database before a given
-- feature was added, these fill in whatever create table (above)
-- would have included on a fresh install. All harmless no-ops if the
-- column/constraint is already there.
-- ============================================================

alter table profiles add column if not exists banned boolean default false;
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('buyer', 'seller', 'both', 'admin'));

alter table stores add column if not exists verification_status text default 'none';
alter table stores drop constraint if exists stores_verification_status_check;
alter table stores add constraint stores_verification_status_check
  check (verification_status in ('none', 'pending', 'approved', 'rejected'));
alter table stores add column if not exists id_document_url text;
alter table stores add column if not exists business_proof_url text;
alter table stores add column if not exists verification_note text;
alter table stores add column if not exists verification_submitted_at timestamptz;

alter table posts alter column product_id drop not null;

alter table products add column if not exists fts tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored;

create index if not exists products_fts_idx on products using gin (fts);

create or replace view searchable_products as
  select p.*, s.name as store_name
  from products p
  join stores s on s.id = p.store_id;

-- ============================================================
-- ROW LEVEL SECURITY — enable on every table
-- ============================================================

alter table profiles enable row level security;
alter table stores enable row level security;
alter table products enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table posts enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;
alter table follows enable row level security;

-- ============================================================
-- HELPER FUNCTIONS
-- Defined before any policy or trigger that uses them.
-- ============================================================

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer set search_path = public;

create or replace function public.is_banned()
returns boolean as $$
  select coalesce(
    (select banned from profiles where id = auth.uid()),
    false
  );
$$ language sql security definer set search_path = public;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'buyer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.increment_likes_count() returns trigger as $$
begin
  update posts set likes_count = likes_count + 1 where id = new.post_id;
  return new;
end;
$$ language plpgsql;

create or replace function public.decrement_likes_count() returns trigger as $$
begin
  update posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  return old;
end;
$$ language plpgsql;

create or replace function public.increment_comments_count() returns trigger as $$
begin
  update posts set comments_count = comments_count + 1 where id = new.post_id;
  return new;
end;
$$ language plpgsql;

-- Blocks a non-admin from approving their own store verification or
-- setting `verified` directly — see the long comment further down for why.
create or replace function public.enforce_store_verification_columns()
returns trigger as $$
begin
  if not is_admin() then
    if new.verification_status is distinct from old.verification_status
       and new.verification_status <> 'pending' then
      raise exception 'Only admins can set verification status to %', new.verification_status;
    end if;
    if new.verified is distinct from old.verified then
      raise exception 'Only admins can change the verified flag';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- TRIGGERS
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_like_insert on likes;
create trigger on_like_insert after insert on likes
  for each row execute function public.increment_likes_count();

drop trigger if exists on_like_delete on likes;
create trigger on_like_delete after delete on likes
  for each row execute function public.decrement_likes_count();

drop trigger if exists on_comment_insert on comments;
create trigger on_comment_insert after insert on comments
  for each row execute function public.increment_comments_count();

drop trigger if exists on_store_update_check_verification on stores;
create trigger on_store_update_check_verification
  before update on stores
  for each row execute function public.enforce_store_verification_columns();

-- ============================================================
-- POLICIES
-- Every policy is dropped first, so this whole block is safe to rerun.
-- ============================================================

-- profiles
drop policy if exists "Profiles are viewable by everyone" on profiles;
create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

drop policy if exists "Users can insert their own profile" on profiles;
create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on profiles;
create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

drop policy if exists "Admins can update any profile" on profiles;
create policy "Admins can update any profile"
  on profiles for update using (is_admin());

-- stores
drop policy if exists "Stores are viewable by everyone" on stores;
create policy "Stores are viewable by everyone"
  on stores for select using (true);

drop policy if exists "Owners can insert their own store" on stores;
create policy "Owners can insert their own store"
  on stores for insert
  with check (auth.uid() = owner_id and not is_banned());

drop policy if exists "Owners can update their own store" on stores;
create policy "Owners can update their own store"
  on stores for update using (auth.uid() = owner_id);

drop policy if exists "Owners can delete their own store" on stores;
create policy "Owners can delete their own store"
  on stores for delete using (auth.uid() = owner_id);

drop policy if exists "Admins can update any store" on stores;
create policy "Admins can update any store"
  on stores for update using (is_admin());

-- products
drop policy if exists "Products are viewable by everyone" on products;
create policy "Products are viewable by everyone"
  on products for select using (true);

drop policy if exists "Store owners can insert products" on products;
create policy "Store owners can insert products"
  on products for insert
  with check (
    auth.uid() = (select owner_id from stores where id = store_id)
    and not is_banned()
  );

drop policy if exists "Store owners can update their products" on products;
create policy "Store owners can update their products"
  on products for update using (
    auth.uid() = (select owner_id from stores where id = store_id)
  );

drop policy if exists "Store owners can delete their products" on products;
create policy "Store owners can delete their products"
  on products for delete using (
    auth.uid() = (select owner_id from stores where id = store_id)
  );

drop policy if exists "Admins can delete any product" on products;
create policy "Admins can delete any product"
  on products for delete using (is_admin());

-- conversations
drop policy if exists "Participants can view their conversations" on conversations;
create policy "Participants can view their conversations"
  on conversations for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Buyers can start a conversation" on conversations;
create policy "Buyers can start a conversation"
  on conversations for insert
  with check (auth.uid() = buyer_id and not is_banned());

drop policy if exists "Participants can update last_message_at" on conversations;
create policy "Participants can update last_message_at"
  on conversations for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- messages
drop policy if exists "Participants can view messages" on messages;
create policy "Participants can view messages"
  on messages for select
  using (
    auth.uid() in (
      select buyer_id from conversations where id = conversation_id
      union
      select seller_id from conversations where id = conversation_id
    )
  );

drop policy if exists "Participants can send messages" on messages;
create policy "Participants can send messages"
  on messages for insert
  with check (
    auth.uid() = sender_id
    and not is_banned()
    and auth.uid() in (
      select buyer_id from conversations where id = conversation_id
      union
      select seller_id from conversations where id = conversation_id
    )
  );

-- posts
drop policy if exists "Posts are viewable by everyone" on posts;
create policy "Posts are viewable by everyone"
  on posts for select using (true);

drop policy if exists "Store owners can insert posts" on posts;
create policy "Store owners can insert posts"
  on posts for insert
  with check (
    auth.uid() = (select owner_id from stores where id = store_id)
    and not is_banned()
  );

drop policy if exists "Store owners can update their posts" on posts;
create policy "Store owners can update their posts"
  on posts for update using (
    auth.uid() = (select owner_id from stores where id = store_id)
  );

drop policy if exists "Store owners can delete their posts" on posts;
create policy "Store owners can delete their posts"
  on posts for delete using (
    auth.uid() = (select owner_id from stores where id = store_id)
  );

drop policy if exists "Admins can delete any post" on posts;
create policy "Admins can delete any post"
  on posts for delete using (is_admin());

-- likes
drop policy if exists "Likes are viewable by everyone" on likes;
create policy "Likes are viewable by everyone"
  on likes for select using (true);

drop policy if exists "Users can like a post" on likes;
create policy "Users can like a post"
  on likes for insert with check (auth.uid() = user_id and not is_banned());

drop policy if exists "Users can unlike their own like" on likes;
create policy "Users can unlike their own like"
  on likes for delete using (auth.uid() = user_id);

-- comments
drop policy if exists "Comments are viewable by everyone" on comments;
create policy "Comments are viewable by everyone"
  on comments for select using (true);

drop policy if exists "Users can add comments" on comments;
create policy "Users can add comments"
  on comments for insert with check (auth.uid() = user_id and not is_banned());

drop policy if exists "Users can delete their own comments" on comments;
create policy "Users can delete their own comments"
  on comments for delete using (auth.uid() = user_id);

drop policy if exists "Admins can delete any comment" on comments;
create policy "Admins can delete any comment"
  on comments for delete using (is_admin());

-- follows
drop policy if exists "Follows are viewable by everyone" on follows;
create policy "Follows are viewable by everyone"
  on follows for select using (true);

drop policy if exists "Users can follow a store" on follows;
create policy "Users can follow a store"
  on follows for insert with check (auth.uid() = follower_id and not is_banned());

drop policy if exists "Users can unfollow a store" on follows;
create policy "Users can unfollow a store"
  on follows for delete using (auth.uid() = follower_id);

-- ============================================================
-- STORAGE — buckets and their policies
-- ============================================================

insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

drop policy if exists "Post media is publicly readable" on storage.objects;
create policy "Post media is publicly readable"
  on storage.objects for select using (bucket_id = 'post-media');

drop policy if exists "Authenticated users can upload post media" on storage.objects;
create policy "Authenticated users can upload post media"
  on storage.objects for insert
  with check (bucket_id = 'post-media' and auth.role() = 'authenticated');

-- Verification docs live under {user_id}/{store_id}/filename, so the
-- policy checks ownership straight from the path.
drop policy if exists "Owners can upload their own verification docs" on storage.objects;
create policy "Owners can upload their own verification docs"
  on storage.objects for insert
  with check (
    bucket_id = 'verification-docs'
    and auth.uid()::text = (storage.foldername(name))[1]
    and not is_banned()
  );

drop policy if exists "Owners and admins can view verification docs" on storage.objects;
create policy "Owners and admins can view verification docs"
  on storage.objects for select
  using (
    bucket_id = 'verification-docs'
    and (auth.uid()::text = (storage.foldername(name))[1] or is_admin())
  );

-- ============================================================
-- REALTIME — add `messages` to the realtime publication.
-- The only genuinely non-idempotent operation in this file, so it's
-- wrapped in a check: adding a table twice normally errors.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;

-- ============================================================
-- NOTES
-- ============================================================

-- To make your first admin (after signing up normally through the app):
--   update profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
--
-- Sellers can only move a store's verification_status to 'pending'
-- (submitting/resubmitting) — only admins can set it to 'approved' or
-- 'rejected', and only admins can ever change `verified` directly.
-- This is enforced by the enforce_store_verification_columns trigger
-- above, closing a gap where the ordinary "owners can update their own
-- store" policy would otherwise let a seller approve themselves.

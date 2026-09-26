-- BuyLink core schema (Phase 1: auth, stores, products)
-- Run this in the Supabase SQL editor.

-- Profiles (extends Supabase's built-in auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text check (role in ('buyer', 'seller', 'both')) default 'buyer',
  avatar_url text,
  location text,
  created_at timestamptz default now()
);

-- Stores (a seller can own one or more stores)
create table stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  description text,
  category text,
  logo_url text,
  verified boolean default false,
  created_at timestamptz default now()
);

-- Products
create table products (
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

-- Row Level Security
alter table profiles enable row level security;
alter table stores enable row level security;
alter table products enable row level security;

-- Profiles: a user can read any profile, but only edit their own
create policy "Profiles are viewable by everyone"
  on profiles for select using (true);
create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);
create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

-- Stores: anyone can view, only the owner can create/edit
create policy "Stores are viewable by everyone"
  on stores for select using (true);
create policy "Owners can insert their own store"
  on stores for insert with check (auth.uid() = owner_id);
create policy "Owners can update their own store"
  on stores for update using (auth.uid() = owner_id);
create policy "Owners can delete their own store"
  on stores for delete using (auth.uid() = owner_id);

-- Products: anyone can view, only the store owner can create/edit
create policy "Products are viewable by everyone"
  on products for select using (true);
create policy "Store owners can insert products"
  on products for insert with check (
    auth.uid() = (select owner_id from stores where id = store_id)
  );
create policy "Store owners can update their products"
  on products for update using (
    auth.uid() = (select owner_id from stores where id = store_id)
  );
create policy "Store owners can delete their products"
  on products for delete using (
    auth.uid() = (select owner_id from stores where id = store_id)
  );

-- Phase 3: Messaging
create table conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references profiles(id) on delete cascade not null,
  seller_id uuid references profiles(id) on delete cascade not null,
  product_id uuid references products(id) on delete set null,
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (buyer_id, seller_id, product_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  text text not null,
  created_at timestamptz default now()
);

alter table conversations enable row level security;
alter table messages enable row level security;

-- Conversations: only the buyer or seller in it can see or create it
create policy "Participants can view their conversations"
  on conversations for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "Buyers can start a conversation"
  on conversations for insert
  with check (auth.uid() = buyer_id);
create policy "Participants can update last_message_at"
  on conversations for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Messages: only participants in the parent conversation can read/write
create policy "Participants can view messages"
  on messages for select
  using (
    auth.uid() in (
      select buyer_id from conversations where id = conversation_id
      union
      select seller_id from conversations where id = conversation_id
    )
  );
create policy "Participants can send messages"
  on messages for insert
  with check (
    auth.uid() = sender_id
    and auth.uid() in (
      select buyer_id from conversations where id = conversation_id
      union
      select seller_id from conversations where id = conversation_id
    )
  );

-- Enable Realtime on messages so the chat UI can subscribe to new rows
alter publication supabase_realtime add table messages;

-- Phase 4: Social feed
create table posts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  store_id uuid references stores(id) on delete cascade not null,
  media_url text not null,
  media_type text check (media_type in ('photo', 'video')) default 'photo',
  caption text,
  likes_count integer default 0,
  comments_count integer default 0,
  created_at timestamptz default now()
);

create table likes (
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  text text not null,
  created_at timestamptz default now()
);

alter table posts enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;

-- Posts: anyone can view, only the store owner can create/edit/delete
create policy "Posts are viewable by everyone"
  on posts for select using (true);
create policy "Store owners can insert posts"
  on posts for insert with check (
    auth.uid() = (select owner_id from stores where id = store_id)
  );
create policy "Store owners can update their posts"
  on posts for update using (
    auth.uid() = (select owner_id from stores where id = store_id)
  );
create policy "Store owners can delete their posts"
  on posts for delete using (
    auth.uid() = (select owner_id from stores where id = store_id)
  );

-- Likes: anyone can view counts, logged-in users can like/unlike their own
create policy "Likes are viewable by everyone"
  on likes for select using (true);
create policy "Users can like a post"
  on likes for insert with check (auth.uid() = user_id);
create policy "Users can unlike their own like"
  on likes for delete using (auth.uid() = user_id);

-- Comments: anyone can view, logged-in users can comment as themselves
create policy "Comments are viewable by everyone"
  on comments for select using (true);
create policy "Users can add comments"
  on comments for insert with check (auth.uid() = user_id);
create policy "Users can delete their own comments"
  on comments for delete using (auth.uid() = user_id);

-- Keep likes_count / comments_count in sync automatically
create or replace function increment_likes_count() returns trigger as $$
begin
  update posts set likes_count = likes_count + 1 where id = new.post_id;
  return new;
end;
$$ language plpgsql;

create or replace function decrement_likes_count() returns trigger as $$
begin
  update posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  return old;
end;
$$ language plpgsql;

create trigger on_like_insert after insert on likes
  for each row execute function increment_likes_count();
create trigger on_like_delete after delete on likes
  for each row execute function decrement_likes_count();

create or replace function increment_comments_count() returns trigger as $$
begin
  update posts set comments_count = comments_count + 1 where id = new.post_id;
  return new;
end;
$$ language plpgsql;

create trigger on_comment_insert after insert on comments
  for each row execute function increment_comments_count();

-- Storage bucket for post media (create via Supabase dashboard or here)
insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do nothing;

create policy "Post media is publicly readable"
  on storage.objects for select using (bucket_id = 'post-media');
create policy "Authenticated users can upload post media"
  on storage.objects for insert
  with check (bucket_id = 'post-media' and auth.role() = 'authenticated');

-- Fix: auto-create a profile row via trigger instead of a client-side
-- insert. This works regardless of whether email confirmation is on,
-- since it runs with elevated privileges as soon as the auth.users row
-- is created — no session/RLS timing issue.
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin role support
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('buyer', 'seller', 'both', 'admin'));

alter table profiles add column if not exists banned boolean default false;

-- Helper function to check admin status without triggering recursive RLS
-- (security definer bypasses RLS on the lookup itself)
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer set search_path = public;

-- Admins can view/update every profile (ban users, etc.)
create policy "Admins can update any profile"
  on profiles for update using (is_admin());

-- Admins can verify (update) any store
create policy "Admins can update any store"
  on stores for update using (is_admin());

-- Admins can delete any product
create policy "Admins can delete any product"
  on products for delete using (is_admin());

-- Admins can delete any post
create policy "Admins can delete any post"
  on posts for delete using (is_admin());

-- Admins can delete any comment
create policy "Admins can delete any comment"
  on comments for delete using (is_admin());

-- To make your first admin, run (after signing up normally):
-- update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');

-- Server-side full-text search
-- A generated tsvector column, weighted (title matters more than
-- description/category), plus a GIN index for fast search.
alter table products add column if not exists fts tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored;

create index if not exists products_fts_idx on products using gin (fts);

-- Also let search match by store name via a view that joins stores in
create or replace view searchable_products as
  select p.*, s.name as store_name
  from products p
  join stores s on s.id = p.store_id;

-- Follow system
create table follows (
  follower_id uuid references profiles(id) on delete cascade not null,
  followed_store_id uuid references stores(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (follower_id, followed_store_id)
);

alter table follows enable row level security;

create policy "Follows are viewable by everyone"
  on follows for select using (true);
create policy "Users can follow a store"
  on follows for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow a store"
  on follows for delete using (auth.uid() = follower_id);

-- Enforce the banned flag: block a banned user from creating new
-- content anywhere in the app, at the database level (RLS), not just
-- in the UI. Reading/browsing still works — only new writes are blocked.
create or replace function public.is_banned()
returns boolean as $$
  select coalesce(
    (select banned from profiles where id = auth.uid()),
    false
  );
$$ language sql security definer set search_path = public;

-- Stores: banned users can't open a new store
drop policy if exists "Owners can insert their own store" on stores;
create policy "Owners can insert their own store"
  on stores for insert
  with check (auth.uid() = owner_id and not is_banned());

-- Products: banned sellers can't add products
drop policy if exists "Store owners can insert products" on products;
create policy "Store owners can insert products"
  on products for insert
  with check (
    auth.uid() = (select owner_id from stores where id = store_id)
    and not is_banned()
  );

-- Posts: banned sellers can't post to the feed
drop policy if exists "Store owners can insert posts" on posts;
create policy "Store owners can insert posts"
  on posts for insert
  with check (
    auth.uid() = (select owner_id from stores where id = store_id)
    and not is_banned()
  );

-- Comments: banned users can't comment
drop policy if exists "Users can add comments" on comments;
create policy "Users can add comments"
  on comments for insert
  with check (auth.uid() = user_id and not is_banned());

-- Likes: banned users can't like posts
drop policy if exists "Users can like a post" on likes;
create policy "Users can like a post"
  on likes for insert
  with check (auth.uid() = user_id and not is_banned());

-- Conversations: banned users can't start new conversations
drop policy if exists "Buyers can start a conversation" on conversations;
create policy "Buyers can start a conversation"
  on conversations for insert
  with check (auth.uid() = buyer_id and not is_banned());

-- Messages: banned users can't send messages (even in existing threads)
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

-- Follows: banned users can't follow stores
drop policy if exists "Users can follow a store" on follows;
create policy "Users can follow a store"
  on follows for insert
  with check (auth.uid() = follower_id and not is_banned());

-- Seller verification submissions
alter table stores add column if not exists verification_status text
  default 'none' check (verification_status in ('none', 'pending', 'approved', 'rejected'));
alter table stores add column if not exists id_document_url text;
alter table stores add column if not exists business_proof_url text;
alter table stores add column if not exists verification_note text;
alter table stores add column if not exists verification_submitted_at timestamptz;

-- Private bucket for verification documents — NOT public, unlike post-media.
-- Only the store owner and admins can ever read these files.
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

-- Files are stored under a path like {user_id}/{store_id}/id-document.jpg
-- so the policy can check ownership from the path itself, without a
-- separate lookup table.
create policy "Owners can upload their own verification docs"
  on storage.objects for insert
  with check (
    bucket_id = 'verification-docs'
    and auth.uid()::text = (storage.foldername(name))[1]
    and not is_banned()
  );

create policy "Owners and admins can view verification docs"
  on storage.objects for select
  using (
    bucket_id = 'verification-docs'
    and (auth.uid()::text = (storage.foldername(name))[1] or is_admin())
  );

-- Sellers can set their own store to 'pending' on submission, but only
-- admins can move it to 'approved'/'rejected' (enforced in the app —
-- Postgres check constraints can't easily distinguish who's setting
-- which value, so the admin UI is the only place approve/reject happens
-- and RLS already restricts stores.update to the owner or an admin).

-- Close a gap: the existing "owners can update their own store" RLS
-- policy allows updating ANY column on a store they own — including
-- verification_status and verified. Without this trigger, a seller
-- could approve their own verification via a direct API call, bypassing
-- the admin review entirely. This trigger blocks that: non-admins may
-- only move verification_status into 'pending' (submitting/resubmitting),
-- never into 'approved'/'rejected', and can never touch `verified` at all.
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

drop trigger if exists on_store_update_check_verification on stores;
create trigger on_store_update_check_verification
  before update on stores
  for each row execute function public.enforce_store_verification_columns();

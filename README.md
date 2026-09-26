# BuyLink — Phase 1 + 2 + 3 + 4 + Admin

Auth, store creation, product listing, search, category filters,
product/store pages, real-time buyer-seller messaging, a TikTok-style
social feed with likes and comments, and an admin dashboard — built with
Next.js and Supabase.

## Setup

1. **Create a Supabase project** at supabase.com (free tier is fine).
2. In the Supabase SQL editor, run `supabase/schema.sql` in full. It
   creates every table (`profiles`, `stores`, `products`, `conversations`,
   `messages`, `posts`, `likes`, `comments`, `follows`), sets up full-text
   search on products, enables Realtime on `messages`, sets up
   like/comment count triggers, and creates a public `post-media` storage
   bucket for post photos.
   - **If your database already has some of these tables:** don't
     re-run the whole file — `create table` errors on tables that
     already exist. Instead scroll to the bottom of `schema.sql` and
     run only the sections you haven't applied yet (they're marked
     with comments like `-- Phase 4`, `-- Admin role support`,
     `-- Server-side full-text search`, `-- Follow system`). Running a
     section twice is safe for everything except `create table` — those
     lines use `if not exists` where it matters, so when in doubt just
     run the whole bottom half again.
3. **To make yourself an admin:** sign up normally through `/signup`
   first, then in the Supabase SQL editor run:
   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
   Then visit `/admin` — you'll see tabs for Users, Stores, and Posts.
3. Copy `.env.local.example` to `.env.local` and fill in your project's
   URL and anon key (Project Settings → API in Supabase).
4. Install dependencies and run:
   ```
   npm install
   npm run dev
   ```
5. Open http://localhost:3000

## What's built (Phase 1 + 2 + 3 + 4)

- `/signup` — create an account as buyer, seller, or both
- `/login` — log in
- `/dashboard` — sellers create their store here
- `/dashboard/products/new` — add a product to your store
- `/dashboard/posts/new` — turn a product into a feed post (upload a
  photo or video, under 50MB, + caption)
- `/dashboard/verify` — sellers submit a government ID + proof of
  business for review; shows status (none/pending/approved/rejected)
  and the admin's note if rejected
- `/products` — buyers browse all listed products, with **server-side
  full-text search** (Postgres `tsvector`, debounced as you type,
  weighted so title matches rank above description) and a category filter
- `/products/[id]` — individual product page with a working "Message
  seller" button that starts or resumes a conversation
- `/stores/[id]` — public store page listing everything that store sells,
  with a **Follow/Following** button and live follower count
- `/messages` — inbox of all your conversations
- `/settings` — edit your name and location, change your password, log out
- The nav bar now reflects whether you're logged in: shows "Settings"
  when logged in, "Log in" when not (previously always showed "Log in"
  regardless of session)
- `/messages/[id]` — a real-time chat thread (Supabase Realtime) with
  a seller or buyer
- `/feed` — TikTok-style vertical swipe feed of photo and video posts
  (video autoplays muted/looped only while it's the one on screen), with
  **"For you" / "Following" tabs** (Following shows only posts from
  stores you follow), a **+ Follow button right next to each store's
  name** so you can follow without leaving the feed, likes (heart, live
  count), and a comments panel that slides up
- `/admin` — admin-only dashboard (guarded by role check + RLS):
  - Overview — live counts (users, banned users, stores, stores awaiting
    verification, posts), each linking to the relevant tab
  - `/admin/users` — ban/unban any user. Banning actually blocks
    them now (enforced via RLS): a banned user can still log in and
    browse, but can't create a store/product, post, comment, like,
    follow, or message — with a banner explaining why
  - `/admin/stores` — a **pending verification queue** at the top:
    review submitted ID/business proof documents (opened via short-lived
    signed URLs, since the storage bucket is private) and approve or
    reject with a reason. Below that, a manual verify/unverify toggle
    for any store, for cases outside the formal flow
  - `/admin/posts` — delete posts off the feed
- Logging in now routes by role: admins land on `/admin`, sellers land
  on `/dashboard`, buyers land on `/feed`. An "Admin" link also appears
  in the nav bar, but only when you're actually logged in as one.
- Optional Plausible analytics — set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` in
  `.env.local` once you have a domain; leave blank to skip for now

## Not yet built (later work)

- Video compression/thumbnails — uploads go straight to storage as-is,
  with a 50MB cap enforced client-side to keep things reasonable, but
  there's no server-side transcoding (fine for MVP, revisit before scale)
- Read receipts / unread counts / push notifications for messages

## Notes

- Auth and RLS are wired so a seller can only edit their own store/products,
  but anyone can view stores and products (public marketplace).
- Styling uses Tailwind with a small custom palette in `tailwind.config.js` —
  change `clay`/`ink`/`sand`/`moss` there to rebrand.
- The nav bar (`components/NavBar.jsx`) is responsive — full links on
  desktop, a hamburger menu on mobile (below Tailwind's `md` breakpoint)
  so nothing gets cut off on small screens.
- All internal imports use the `@/` alias (e.g. `@/lib/supabaseClient`)
  instead of relative paths like `../../lib/supabaseClient`. This is
  configured in `jsconfig.json` — if you add new files deep in the
  folder structure, import from `@/...` rather than counting `../`.

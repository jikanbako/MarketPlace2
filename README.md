# BuyLink — Phase 1 + 2 + 3 + 4

Auth, store creation, product listing, search, category filters,
product/store pages, real-time buyer-seller messaging, and a TikTok-style
social feed with likes and comments — built with Next.js and Supabase.

## Setup

1. **Create a Supabase project** at supabase.com (free tier is fine).
2. In the Supabase SQL editor, run `supabase/schema.sql` in full. It
   creates every table (`profiles`, `stores`, `products`, `conversations`,
   `messages`, `posts`, `likes`, `comments`), enables Realtime on
   `messages`, sets up like/comment count triggers, and creates a public
   `post-media` storage bucket for post photos.
   - If you already ran an earlier version of this file, just run the
     **new part** at the bottom (everything from `-- Phase 4` down) —
     re-running `create table` on existing tables will error harmlessly,
     but it's simpler to only paste the new section.
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
- `/dashboard/posts/new` — turn a product into a feed post (upload a photo + caption)
- `/products` — buyers browse all listed products, with a search bar and
  a category filter (built client-side from existing product categories)
- `/products/[id]` — individual product page with a working "Message
  seller" button that starts or resumes a conversation
- `/stores/[id]` — public store page listing everything that store sells
- `/messages` — inbox of all your conversations
- `/messages/[id]` — a real-time chat thread (Supabase Realtime) with
  a seller or buyer
- `/feed` — TikTok-style vertical swipe feed of product posts, with
  likes (heart, live count) and a comments panel that slides up
- Optional Plausible analytics — set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` in
  `.env.local` once you have a domain; leave blank to skip for now

## Not yet built (later work)

- Video posts (schema supports `media_type: 'video'`, but the upload UI
  only accepts photos right now — swap `accept="image/*"` for video and
  add a video player to `PostCard` when you're ready)
- Server-side/full-text search once product volume grows past what
  client-side filtering handles well
- Read receipts / unread counts / push notifications for messages
- Follow system (following stores, personalized feed ordering)

## Notes

- Auth and RLS are wired so a seller can only edit their own store/products,
  but anyone can view stores and products (public marketplace).
- Styling uses Tailwind with a small custom palette in `tailwind.config.js` —
  change `clay`/`ink`/`sand`/`moss` there to rebrand.

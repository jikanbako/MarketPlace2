# BuyLink — Phase 1 + 2 + 3 + 4 + Admin

Auth, store creation, product listing, search, category filters,
product/store pages, real-time buyer-seller messaging, a TikTok-style
social feed with likes and comments, and an admin dashboard — built with
Next.js and Supabase.

## Setup

1. **Create a Supabase project** at supabase.com (free tier is fine).
2. In the Supabase SQL editor, paste in the **entire** `supabase/schema.sql`
   and run it. It creates every table, function, trigger, policy, and
   storage bucket the app needs.
   - **This file is safe to run in full, any time, as many times as
     you want** — on a brand new project or one that already has some
     of this schema. Every statement either uses `if not exists` or
     drops-then-recreates itself, so nothing errors on a second run.
   - **If the app ever throws an error mentioning a missing table,
     column, function, or policy** (e.g. "column does not exist",
     "function is_admin() does not exist"), the fix is almost always:
     paste the whole file in and run it again. Your live database
     just hasn't caught up to what the code expects yet.
3. **To make yourself an admin:** sign up normally through `/signup`
   first, then in the Supabase SQL editor run:
   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
   Then visit `/admin` — you'll see tabs for Users, Stores, and Posts.
4. **Push notifications (optional, but the schema/service worker
   support it out of the box):**
   - Copy `.env.local.example` → `.env.local` (next step) and either
     keep the pre-generated `NEXT_PUBLIC_VAPID_PUBLIC_KEY` /
     `VAPID_PRIVATE_KEY` pair, or generate your own with
     `npx web-push generate-vapid-keys`.
   - Get your Supabase **service_role** key from Project Settings → API
     and set `SUPABASE_SERVICE_ROLE_KEY`. Never expose this to the
     browser.
   - Make up a random string for `PUSH_API_SECRET` — this proves a
     request to `/api/send-push` really came from your own database.
   - **After you deploy** (Vercel or elsewhere), tell your database
     where to send notification requests by running in the Supabase
     SQL editor:
     ```sql
     update app_settings set value = 'https://your-deployed-url.com/api/send-push'
     where key = 'push_api_url';
     update app_settings set value = 'the-same-string-you-put-in-PUSH_API_SECRET'
     where key = 'push_api_secret';
     ```
   - Until you do that last step, the app works completely normally —
     `notify_push()` just silently does nothing if `push_api_url` is
     empty, so nothing breaks by leaving this for later.
   - Once wired up, notifications fire automatically for: a new
     message, a new follower, a new comment on your post, and your
     store's verification being approved or rejected. A user opts in
     from `/settings` — nothing is pushed to anyone who hasn't clicked
     "Enable notifications" there.
5. Copy `.env.local.example` to `.env.local` and fill in your project's
   URL and anon key (Project Settings → API in Supabase).
6. Install dependencies and run:
   ```
   npm install
   npm run dev
   ```
7. Open http://localhost:3000

## What's built (Phase 1 + 2 + 3 + 4)

- `/signup` — create an account as buyer, seller, or both
- `/login` — log in
- `/dashboard` — role-aware home screen:
  - **Sellers:** store header with verification badge, live stats
    (followers, products, posts, likes, comments, chats), stock alerts
    for low/out-of-stock products, a product list with working **edit
    and delete**, a posts grid with delete, and a recent-messages
    preview (real name + last message text, not a placeholder)
  - **Everyone:** a "Following" section listing stores they follow
  - **No store yet:** the create-store form appears at the bottom, so
    a buyer can become a seller without losing anything — this was a
    regression in an earlier draft that's now fixed
- `/dashboard/products/new` — add a product to your store, **with up
  to 5 photos** (uploaded to Storage, first photo is the main image)
- `/dashboard/products/[id]/edit` — edit a product's details, its
  photos (remove existing ones, add more, up to 5), or delete it
- `/dashboard/posts/new` — turn a product into a feed post (upload a
  photo or video, under 50MB, + caption), **or post without a product**
  for store updates, new-arrivals teasers, or behind-the-scenes content
  — a post no longer needs a product behind it
- `/dashboard/verify` — sellers submit a government ID + proof of
  business for review; shows status (none/pending/approved/rejected)
  and the admin's note if rejected
- `/products` — buyers browse all listed products, with **server-side
  full-text search** (Postgres `tsvector`, debounced as you type,
  weighted so title matches rank above description) and a category
  filter; each card shows the product's first photo
- `/products/[id]` — individual product page with a **photo gallery**
  (main image + tappable thumbnail strip when there's more than one)
  and a working "Message seller" button that starts or resumes a
  conversation
- `/stores/[id]` — public store page listing everything that store sells,
  with a **Follow/Following** button and live follower count
- `/messages` — inbox of all your conversations
- `/settings` — edit your name and location, change your password,
  **turn push notifications on/off**, log out
- **Push notifications** — opt-in from `/settings`; fires for a new
  message, a new follower, a new comment on your post, and your
  store's verification being approved/rejected. Works even when
  BuyLink isn't open, since it's a real browser push via the service
  worker. Requires the one-time setup in step 4 above (`app_settings`
  + a few env vars) — everything works fine without it, notifications
  just won't send until that's done.
- The nav bar now reflects whether you're logged in: shows "Settings"
  when logged in, "Log in" when not (previously always showed "Log in"
  regardless of session)
- **Sticky bottom tab bar on mobile** — Home (`/dashboard`), Post
  (`/dashboard/posts/new`), Inbox (`/messages`), Profile (`/settings`),
  with the active tab highlighted. Only shows below Tailwind's `md`
  breakpoint; desktop keeps using the top nav bar only.
- `/messages/[id]` — a real-time chat thread (Supabase Realtime) with
  a seller or buyer
- `/feed` — TikTok-style vertical swipe feed of photo and video posts
  (video autoplays muted/looped only while it's the one on screen), with
  **"For you" / "Following" tabs** (Following shows only posts from
  stores you follow), a right-side icon column like TikTok's — **Follow
  (+/✓)**, **Like** (heart, live count), **Comment** (slides up a panel),
  and **Message** (starts/resumes a conversation with the seller,
  without leaving the feed) — plus store name and caption at bottom-left
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
- **Installable as a PWA** — `public/manifest.json` + a service worker
  (`public/sw.js`, network-first with an offline fallback to the cached
  shell) make BuyLink installable to a phone's home screen. An install
  prompt banner appears automatically (Android/Chrome gets a real
  "Install" button; iOS Safari gets "tap Share → Add to Home Screen"
  instructions, since iOS doesn't support the install-prompt API).
  Placeholder icons are in `public/` (`icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png`, `apple-touch-icon.png`) — swap these for a
  real logo before you actually launch; they're currently just a "B"
  monogram in your brand colors.

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

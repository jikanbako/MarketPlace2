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
  - A prompt to add a phone number appears in the header if you
    haven't set one yet (it's what shows up on your feed posts)
- **Store cover photo / poster** — the top of `/dashboard` is a store card
  with a banner the seller can add, change, or remove right there (tap the
  banner to view it full-size, so a poster can be read in full). Photos
  are shrunk in the browser before upload (`lib/imageResize.js`) so they
  upload quickly on mobile data. Buyers see the same card on `/stores/[id]`.
  Needs the `stores.cover_url` column — re-run `supabase/schema.sql`.
- `/dashboard/store/edit` — edit your store's name, category,
  description, and **phone number** (shown on your feed posts as
  call/WhatsApp chips — leave it blank to keep it hidden)
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
- `/cart`, `/checkout`, `/orders` — cart, Paystack checkout, and a
  buyer's order history (see **Payments** below)
- `/dashboard/payouts` and `/dashboard/orders` — seller bank-account
  setup and incoming orders with delivery details
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
  (video autoplays muted/looped only while it's the one on screen —
  browsers require starting muted; tap the 🔊/🔇 icon top-right to turn
  sound on, which then stays on for every video for the rest of the
  session, same as TikTok), with **"For you" / "Following" tabs**
  (Following shows only posts from stores you follow), a right-side
  icon column like TikTok's — **Follow (+/✓)**, **Like** (heart, live
  count), **Comment** (slides up a panel), and **Message**
  (starts/resumes a conversation with the seller, without leaving the
  feed) — plus store name, caption, and a **📞 call / WhatsApp chip**
  at bottom-left whenever the seller has added a phone number
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

## Payments (Paystack)

Buyers pay on Paystack's hosted page; each seller's share goes **straight
to the seller's own bank account**. BuyLink holds no money and takes no
commission (that's a one-line change later — see "Commission" below).

**How it works**
- A seller adds a bank account at `/dashboard/payouts`. The server turns
  that into a Paystack *subaccount* (`percentage_charge: 0`) and only
  keeps the last 4 digits of the account number.
- **Where buyers find the buttons:** on every feed post that has a
  product (a **Buy now · ₦…** button plus a 🛒 icon in the right-hand
  column), on each card in `/products` and on store pages (**Add to
  cart**), and on the product page itself (with a quantity picker). They
  only appear when the seller has set up payouts, the item is in stock,
  and it isn't your own product.
- A buyer can **Buy now** (one product) or **Add to cart** (`/cart`) and
  check out (`/checkout`) with delivery details. A cart with products
  from several sellers is still **one payment**, split between them using
  Paystack's dynamic split.
- Paystack's processing fee comes out of each seller's share, in
  proportion (`bearer_type: all-proportional`), so BuyLink never pays it.
- Every price and amount is recomputed **on the server** from the
  database. The browser only says what it wants to buy.
- A payment is marked paid only after Paystack confirms it — both when
  the buyer returns (`/checkout/verify`) and through a signed webhook,
  so an order is still recorded if the buyer closes their browser.
- Sellers see paid orders with the delivery details at `/dashboard/orders`
  and mark them **shipped**; buyers see `/orders` and confirm **received**.
  Both get a push notification when the other acts.

**Setup**
1. Create a Paystack account. In Dashboard → Settings → API Keys, copy
   your **test secret key** into `PAYSTACK_SECRET_KEY` (locally and in
   Vercel). Redeploy after adding it.
2. In Dashboard → Settings → API Keys & Webhooks, set the **Webhook URL**
   to `https://your-site.com/api/paystack/webhook`.
3. Re-run the whole `supabase/schema.sql` in the Supabase SQL editor.
4. Make sure `SUPABASE_SERVICE_ROLE_KEY` is set (the server needs it).
5. Sign in as a seller → **Payouts** → add a bank account. Until then,
   that seller's products show "hasn't set up payments yet" and can't be
   bought.

**Test it before using real money** (with the test key `sk_test_...`):
- Pay with Paystack's test card shown on their checkout page.
- In test mode, Paystack can't look up arbitrary account names, so a
  failed name lookup is allowed through; in live mode it blocks setup.
- Do one **multi-seller cart** purchase and check, in the Paystack
  dashboard's transaction details, that the split amounts per seller are
  exactly right and that BuyLink's own share is 0. Only then switch to
  the live key.

**Known limits (deliberate, for now)**
- No delivery fee and no refunds/disputes flow — handle those with the
  seller directly, and refunds from the Paystack dashboard.
- Stock is checked when checkout starts and reduced when payment is
  confirmed. Two buyers paying for the last item at once can both succeed
  (stock is clamped at 0); the seller would need to resolve that manually.
- Abandoned checkouts leave a hidden `pending_payment` order behind. It's
  never shown to anyone and is harmless, but can be cleaned up in bulk.
- **Commission:** to take a cut later, add a BuyLink share to the `split`
  in `app/api/checkout/initialize/route.js` (the main account's share is
  whatever is left over after the sellers' flat shares).

## Buy buttons on posts

Every feed post that has a product shows **Buy now** and an **Add to cart**
icon. If one can't be used they stay visible but dimmed, and tapping says
why (it's the viewer's own product, it's sold out, or the seller hasn't set
up payouts yet — with a "Message seller" shortcut). Posts with no product
show **Shop this store** instead. The new-post form defaults to the seller's
newest product so posts are shoppable by default.

## Feed order and counts

- **"For you" is shuffled**, not newest-first: every post gets a random
  number nudged up for being recent, liked/commented, or from a store you
  follow, and the same store never appears twice in a row. The order is
  picked once per visit — following someone doesn't reshuffle it — and
  tapping "For you" again gives a fresh shuffle. "Following" stays
  newest-first. It loads the 80 most recent posts.
- **Like, comment, and follower counts are real.** They're kept by database
  triggers (`likes_count`, `comments_count` on posts, `followers_count` on
  stores). Those triggers used to run with the liker's permissions, so
  Row Level Security silently blocked the count update for everyone except
  the post's owner. They're now `security definer`, comment deletes
  decrement too, nobody can edit the counters by hand, and re-running
  `supabase/schema.sql` recounts everything from the real rows.
- The dashboard's Posts / Likes / Comments / Chats are true totals, not
  counts of the short lists shown below them.

## Design notes

- **Icons** all live in `components/Icons.jsx` (one consistent line-icon
  set). Use those instead of emoji so every screen matches on every phone.
- **The feed is pinned, not sized with `vh`.** `/feed` anchors itself between
  the top of the screen and the bottom tab bar (`top`/`bottom` offsets), so
  it always matches the area you can actually see. The bottom offset
  (`3.5rem` + safe area) must stay equal to the height set in
  `components/BottomNav.jsx` — change one, change the other. (The old
  `100vh` sizing is what hid the Buy button behind the tab bar on phones,
  because `100vh` includes the area under the browser's address bar.)
- On phones the top bar hides on `/feed`; the feed draws its own header with
  the For you / Following tabs, search, and the cart.
- Category chips, product cards, and the dashboard use the same palette
  (`sand` / `ink` / `clay` / `moss`) from `tailwind.config.js`.

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

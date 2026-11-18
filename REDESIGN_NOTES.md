# BuyLink UI refresh

This refresh keeps BuyLink's existing warm orange-and-cream identity and preserves its current application flows.

## Brand direction
- Existing warm page background: `#F6F1E9` (kept)
- Existing primary clay/orange: `#B5502F` (kept)
- Existing ink text: `#171310` (kept)
- Warm white surfaces, subtle borders, soft shadows, and rounded corners create clearer hierarchy.
- Green, blue, and red remain semantic accents for success, information, and errors rather than competing brand colours.

## Included in this refresh
- Shared styling for page headings, cards, product tiles, search fields, category controls, form controls, buttons, and message bubbles.
- Refined top navigation and mobile bottom navigation shared across the app.
- Responsive seller dashboard layout with store identity, statistics, quick actions, alerts, and content panels.
- Marketplace product cards with clearer surfaces, hover feedback, and consistent spacing.
- Improved visual treatment for cart, checkout, account forms, inbox, and conversation surfaces.
- Fixed the dashboard cover-photo preview's close button so it closes when tapped.
- Kept the existing feed's immersive layout and media interactions intact.

## Functionality preserved
This is a UI-focused update. Existing Supabase queries, authentication, cart operations, checkout and Paystack routes, order handling, product/store operations, messaging, uploads, and admin routes have not been intentionally rewritten.

## Verification status
- Source-level checks completed for the updated dashboard close handler and stylesheet.
- A production build could not be run in this environment because dependency installation timed out. Run `npm ci` and `npm run build` locally before deploying.
- No `.env.local` secrets are included. Use your own local environment variables when running the app.

## Detailed marketplace pass (continued)
- Added dedicated page hooks and layouts for the homepage, marketplace browse, product detail, cart, checkout, and public store page.
- Homepage hero now has a warm editorial panel, clearer calls to action, and a more deliberate featured-product section.
- Product browse and store product tiles now share consistent image treatment, surface styling, price emphasis, and hover feedback.
- Product detail uses a wider desktop layout with a focused gallery and purchase information while retaining the existing product, cart, and seller-message handlers.
- Cart and checkout use clearer summary panels and stronger primary actions; checkout's Paystack submission flow is unchanged.
- No database schema, Supabase query, API route, payment logic, or authentication flow was intentionally changed in this pass.

## Seller and community UI pass
- Added dedicated responsive styling hooks to seller orders, payouts, product creation/editing, post creation, store editing, verification, buyer orders, inbox, conversations, and account settings.
- Standardized form fields, focus states, action buttons, order cards, inbox rows, and message composer around the existing orange/clay and sand palette.
- Kept all existing page logic, Supabase queries, storage uploads, RPC calls, and navigation intact; this pass changes presentation classes and shared CSS only.

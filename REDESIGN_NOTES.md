# BuyLink UI redesign — affected files

This package contains only files changed or added by the UI redesign. Extract the archive at the root of the existing BuyLink project and allow it to overwrite matching files.

## Design direction
- Retains BuyLink's warm cream page background and orange/clay brand colors.
- Adds a consistent editorial marketplace style: stronger page hierarchy, larger responsive layouts, warm white panels, softer borders, elevated cards, and consistent form controls.
- Improves desktop and mobile layouts for the homepage, dashboard, marketplace, product details, store pages, checkout, seller tools, community feed, messaging, account pages, and admin navigation.
- Existing React page logic, Supabase calls, routes, and payment flows are retained; the changes are presentation-focused.

## Validation
A dependency installation attempt timed out in this environment, so a Next.js production build could not be completed here. After applying these files, run `npm ci` (or `npm install`), then `npm run build` and `npm run dev` locally.

## Exact file list

### Application pages
- `app/admin/layout.jsx`
- `app/cart/page.jsx`
- `app/checkout/page.jsx`
- `app/dashboard/page.jsx`
- `app/dashboard/orders/page.jsx`
- `app/dashboard/payouts/page.jsx`
- `app/dashboard/posts/new/page.jsx`
- `app/dashboard/products/new/page.jsx`
- `app/dashboard/products/[id]/edit/page.jsx`
- `app/dashboard/store/edit/page.jsx`
- `app/dashboard/verify/page.jsx`
- `app/feed/page.jsx`
- `app/layout.jsx`
- `app/login/page.jsx`
- `app/messages/page.jsx`
- `app/messages/[id]/page.jsx`
- `app/orders/page.jsx`
- `app/page.jsx`
- `app/products/page.jsx`
- `app/products/[id]/page.jsx`
- `app/settings/page.jsx`
- `app/signup/page.jsx`
- `app/stores/[id]/page.jsx`

### Shared components and styles
- `app/globals.css`
- `components/BottomNav.jsx`
- `components/NavBar.jsx`

### New file
- `REDESIGN_NOTES.md`

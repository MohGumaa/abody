# Fix: Admin sidebar logo and readable rail tooltips

**Type:** Fix
**Status:** verified
**Branch:** fix/admin-sidebar-logo-and-readable-rail-tooltips

## The problem

Two polish issues in the admin sidebar shipped by the admin redesign fix:

1. The sidebar brand is a placeholder "A" mark with "Abody / Admin console"
   text instead of the real Abody logo.
2. In the collapsed icon rail, the hover tooltip is dark (`bg-ink`), and it
   overlaps the dark featured Revenue card on the dashboard. Dark on dark is
   unreadable.

## The fix

- **Brand:** when expanded, show the store logo (`/Logo-0.jpg`, as in the
  storefront header) with a small "Admin" pill. In the collapsed rail, show only
  the logo mark (`/android-chrome-192x192.png`, the favicon artwork) at 36px.
  Phone drawers always show the full logo. Each image has the alt text "Abody",
  and only one is rendered visible at a time, so the link always has one name.
- **Tooltip:** a light tooltip (panel background, foreground text, border,
  raised shadow), so it stays readable over both the light canvas and the dark
  Revenue card.

Must not break: the neutral wording in client chunks (`grep -rlF Admin
.next/static` stays empty; the brand lives in the server layout), collapse
persistence, and the drawer.

## Build steps

- [x] **1. Logo and light tooltip.** Update the brand link in
  `app/admin/layout.tsx` and the rail label classes in
  `components/admin/SideNav.tsx`.
  Done when: at 1366px the expanded sidebar shows the logo with the pill and the
  rail shows the mark only; hovering a rail icon over the Revenue card shows a
  readable tooltip; at 390px the drawer shows the full logo; `pnpm lint` and
  `pnpm build` pass and `grep -rlF Admin .next/static` finds nothing.

## Verify

- Sign in as an admin, open `/admin`: logo plus "Admin" pill in the sidebar.
- Collapse the sidebar: the triangle mark only. Hover "Products": a light
  tooltip, readable over the Revenue card.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass (no logic changes).


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2029,"specSha256":"dc92a25e9c4223e7bf2cc7f21d55223dd3a6494cda40df6d2e3039efdc5ca519","branch":"refs/heads/fix/admin-sidebar-logo-and-readable-rail-tooltips","head":"d696f417814c8deee68f01b7ef5665f9505a4563","baseRef":"refs/heads/main","baseCommit":"d696f417814c8deee68f01b7ef5665f9505a4563","sourceTree":"ccb0ced7b4fcef80fd022fab3f8c8d8b59d3503c","absentOptional":[]} -->

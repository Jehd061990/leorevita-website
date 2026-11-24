# Leo Revita Salon Website

A custom Next.js website for Leo Revita Salon, with live branch/service data and public appointment booking powered by DoyBiz.

## Requirements

- Node.js 20.9+
- A DoyBiz organization configured for Leo Revita with active branches, services, staff/service assignments and public booking enabled.

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local`
3. Set:
   - `DOYBIZ_API_URL` — backend API origin including `/api`
   - `DOYBIZ_TENANT_SLUG` — Leo Revita's DoyBiz organization slug
4. Run `npm run dev` and open http://localhost:3000

## Booking integration

The website does not maintain its own booking records. The same-origin server route at `/api/booking/*` proxies to DoyBiz public endpoints for site configuration, branches, services, staff, availability and reservation creation. The proxy forwards the booking-session cookie and preserves the response cookie so repeat visits can use the DoyBiz customer session.

Availability and booking validation remain server-authoritative in DoyBiz. The website only displays returned slots and submits the selected slot.

## Deployment

Configure the two environment variables in the hosting provider. Do not expose the backend URL or tenant credentials in client-side environment variables. Deploy only after confirming the tenant slug and testing a real booking in a safe test tenant.

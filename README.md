This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Project Structure

The codebase uses route-level collocation for UI and route-only logic, with shared logic organized by domain.

### Route Collocation

- `src/app/...` contains route segments, layouts, and page components.
- Each route can include:
	- `_components/` for route-only UI pieces
	- `_hooks/` for route-only hooks
	- `_context/` for route-only context
	- `_lib/` for route-only non-component logic, data loaders, and helpers
	- `_types/` or `types.ts` for route-only types
	- `actions.ts` for route-scoped server actions
- Keep `_lib/` flat while it is small. Split into `_lib/server/`, `_lib/utils/`, etc. once a route accumulates enough helpers for the distinction to clarify ownership.

### API Routes

- `src/app/api/` 
- Organized by resource (`students/`, `coaches/`, `sessions/`, `courses/`, `payment-plans/`, ...) — the caller's role is enforced inside each handler, never encoded in the URL. See `docs/api-contract.md` ("URL & naming convention") and the role matrix in `docs/api-auth.md`.
- Client fetches build URLs from the typed registry `src/lib/api/routes.ts` (never inline `/api/...` string literals).
- `webhooks/` contains handlers for external provider callbacks 

### Shared Code

- `src/components/` holds reusable UI used across multiple routes.
- `src/lib/` holds shared, app-specific domain logic grouped by feature. Keep route-specific logic in that route's `_lib/` until it is reused across route areas or APIs.
	- Example domains: `lessons/`, `messaging/`, `scheduling/`, `profiles/`, `users/`, `payments/`, `rewards/`, `auth/`.
	- A domain folder is organized into subfolders:
		- `actions/` - named server action files (e.g. `signOut.ts`, `sendMessage.ts`)
		- `server/` - server-only helpers that aren't actions (e.g. `getActiveProfile.ts`, `availability.ts`)
		- `types.ts`, `schemas.ts` - top-level files for shared types and validation
- `src/services/` is for third-party SDK clients and adapters (Supabase, Stripe, etc). Keep app logic out of this layer.
	- `services` should be adapter-only:
		- Allowed: SDK setup, HTTP request/response mapping, provider-specific payload formatting.
		- Not allowed: setting profile cookies, database reads/writes, business workflow orchestration.
	- Put business workflows in `src/lib/<domain>/server/` and call `src/services/*` from there.
- `src/utils/` is for cross-domain helpers that are not tied to a single feature
- `src/types/` is only for cross-domain primitives shared widely; keep domain types with their domain

### Validation (Zod)

- Collocate schemas with a route when only used there.
- Move schemas into the domain folder in `src/lib/<domain>/` when reused across routes or APIs.
- Use a top-level `src/validations/` only if a schema is shared across many domains.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

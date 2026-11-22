# The Jacket Club SR1

Ordering app for The Jacket Club SR1, 12–14 Park Lane, Sunderland SR1 3NX.

Click & Collect, order at table, table booking and delivery. Built step by step: plan, review, build, test, deploy.

## Run it locally

1. `cp .env.example .env.local` and fill in the two public Supabase values.
2. `pnpm install`
3. `pnpm dev` and open http://localhost:3000

## Checks

- `pnpm check` runs code checks, type checks and unit tests.
- `pnpm build && pnpm test:e2e` runs the browser test.
- The same checks run automatically on every pull request.

## Database

Supabase project `The-Jacket-Club-SR1-`. Migrations live in `supabase/migrations/`.

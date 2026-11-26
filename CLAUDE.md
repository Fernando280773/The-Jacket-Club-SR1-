# The Jacket Club SR1 — working rules

- Build plan: one step = one branch (`step-NN-name`) = one pull request. Plan, review (Antony approves), build, test, deploy.
- Never push straight to `main`. Merge only when checks pass and Antony approves.
- Money is whole pence (integers) everywhere. Format with `formatPence`.
- Every shop-owned table has `shop_id` (multi-shop ready for Miller AI).
- Database changes go in `supabase/migrations/` as new files; never edit an applied migration.
- Secrets (Supabase secret key, Stripe keys) live in the server env file on the VPS (and GitHub settings for CI) only, never in git or chat. `.env.local` is never committed.
- Checks before a PR: `pnpm check` and `pnpm build`; browser test `pnpm test:e2e`.
- Hosting: Hostinger VPS (UK), nginx in front of `next start` run by systemd. `VERCEL_ENV` is still set by hand in the server env file (`production` on live, `preview` on draft) because the code reads it.

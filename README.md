# GetBoth.tn — Final Platform (business subscriptions + PIN root admin)

A student freelance marketplace for Tunisia. Students accept paid micro-shifts (≤2h), chat privately, and are **paid only when the business marks the work finished**. Students also get a **work log**, a **wallet ledger**, and **1–5 ★ business feedback**.

**New in this edition:** subscriptions are **business-only**. Every business gets a **7-day free trial**; when it expires, business access is **locked** until an admin grants a plan:

| Plan | Duration |
| --- | --- |
| Free trial | 7 days (automatic) |
| **BothDiamond** | 1 month (30 days) |
| **GoldenEdge** | 1 year (365 days) |

Only an admin can grant/renew plans. The admin area can be entered either with the `admin@getboth.tn` session **or** through the hidden folder **`/getroot` with PIN `2007`**.

## 1. Setup & Run

```bash
cd getbothtn
npm install
npm run dev
```

Open **http://localhost:3000**.

- Prisma Client is generated automatically by `npm install`, `npm run dev`, `npm run build`, `npm run start`.
- `npm run dev` / `npm run build` clear the stale `.next` cache first.
- A seeded `prisma/dev.db` is included; rebuild with `npm run db:setup` (force-reset + seed).
- `npm test` runs the 5 Vitest tests; `npm run build` is the production check.
- `npm run chat:cleanup` purges expired chats manually. The app also purges on page loads, every 10 minutes while a tab is open, and via `GET/POST /api/cron/cleanup` (optional `CRON_SECRET`).
- **Concept presentation:** `public/presentation.html` (also served at `/presentation.html`), with fullscreen button at the bottom.

## 2. Demo Accounts

| Role | Email | Password |
| --- | --- | --- |
| ADMIN | `admin@getboth.tn` | `admin123` |
| BUSINESS | `cafe@getboth.tn` | `pass123` |
| BUSINESS | `shop@getboth.tn` | `pass123` |
| STUDENT | `student1@getboth.tn` | `pass123` |
| STUDENT | `student2@getboth.tn` | `pass123` |
| STUDENT | `student3@getboth.tn` | `pass123` |

**Secret admin entry:** `http://localhost:3000/getroot` → PIN **`2007`**.

## 3. Demo Script (4 minutes)

1. **Home page:** live Tunisia board + concept stats.
2. **Business trial:** log in as `cafe@getboth.tn / pass123`. A blue strip shows `Plan: Free trial · active until <date +7d>`. Post/manage offers, finish a shift and rate the student 1–5 ★. All business pages and business server actions check the subscription.
3. **Lock demo:** in `prisma/dev.db`, set `planExpiresAt` of that business to a past date (or wait 7 days). Refresh `/business/dashboard` → **Your access is locked 🔒**. Business actions return an error even if called directly.
4. **PIN root admin:** visit `/getroot`, type **`2007`**, click **Unlock admin access**. You land on `/admin` with a **Subscriptions** section listing every business, its plan, expiry and status. Click **BothDiamond · 30d** or **GoldenEdge · 365d**: the business is unlocked immediately (or **Free trial · 7d** to reset). A logged-in `admin@getboth.tn` session can do the same without the PIN.
5. **Student side:** `student2@getboth.tn / pass123` → dashboard (balance `22.0 TND`, `5.0 ★`), **Work log** and **Wallet** (`+22.0 TND` credit, 5★ note). Accept an offer → status ACCEPTED + 24h chat countdown. Business marks finished → wallet/hours/rating update.

## 4. Tech Stack

- **Next.js 14.2.35 App Router + TypeScript (strict)** — server components + server actions.
- **Tailwind CSS** — plain `card` / `btn` / `badge` / `input` utility components.
- **SQLite via Prisma** — `DATABASE_URL="file:./dev.db"`.
- **NextAuth v4 credentials + bcryptjs** — JWT sessions; protected pages recheck the DB.
- **Zod** — validated offer, profile, message and 1–5 star feedback input; mandatory moderation reasons.
- **Subscription core (`PLAN_DAYS`, `grantPlanCore`)** — `FREE_TRIAL=7`, `BOTH_DIAMOND=30`, `GOLDEN_EDGE=365` days; expiry stored on `BusinessProfile`. `getSubscribedBusinessUser()` enforces it in every business server action; the business layout renders the lock screen.
- **PIN root (`/getroot`)** — HMAC-signed, httpOnly cookie (`getroot_access`, 8h) set only after PIN `2007`; `requireAdminOrRoot()` protects `/admin`. Grant actions accept a logged-in ADMIN **or** the PIN-root actor.
- **Lifecycle core (`src/lib/core.ts`)** — `acceptOfferCore`, `finishWorkCore`, `setOfferStatusCore`, `removeBusinessOfferCore`, `cancelApplicationCore`, `writeFeedbackCore`, `grantPlanCore`, `purgeExpiredChats`.
- **Wallet ledger** — one `WalletEntry` credit per paid shift, written in the same transaction as the balance/minutes/shifts update.
- **3s chat polling**, **plain HTML stat cards** — no Socket.io, no chart library.

## 5. Scalability (next steps, not in this demo)

- Swap SQLite for **Postgres**; index `Offer.status`, `Application.studentId`, `Chat.expiresAt`, `WalletEntry.studentId`, `BusinessProfile.planExpiresAt`.
- Replace the PIN cookie with real admin accounts + 2FA; move plan grants to a payment provider and webhooks.
- Move the 24h chat purge to a hosted cron/worker queue; add Redis caching and WebSocket chat.
- Paginate lists and rate-limit auth/PIN/chat endpoints.

## 6. Tests Achieved

`npm test` — 5 Vitest tests, all passing:

1. bcrypt hash/verify round-trip.
2. Zod schemas — offer 120 min accepted / 121 rejected; feedback 5 stars accepted / 6 rejected.
3. Accept-offer integration: `Application` + `Chat`, `ACCEPTED` statuses, ~24h expiry, idempotent.
4. Suspended users cannot log in (`canLogin`).
5. Finish credits wallet + hours + feedback, 24h purge deletes chat, admin removal logs reason, **business cannot grant itself a plan**, admin grants BothDiamond (30d) then GoldenEdge (365d).

Manual verification: business plan strip + locked screen, `/getroot` PIN flow, admin subscription grants, wallet/work log/feedback, chat purge, `npx tsc --noEmit` and `npm run build` clean.

## 7. Not in 6h Scope

Socket.io, Postgres, Docker, shadcn/ui, Playwright, Recharts, email verification, image uploads, availability JSON matching, multi-page admin area, real payment gateway, 2FA for root, and a hosted cron service (the in-app scheduler + optional `/api/cron/cleanup` cover the demo). Students never pay — no student subscription flow exists.

# Prompt2Resume — Bugs & Production-Readiness Audit

_Reviewed: backend (Express + Prisma + JWT) and frontend (Next.js)._ Issues are
ordered by how much they should block a real launch. Severity: 🔴 blocker · 🟠 important · 🟡 nice-to-have.

---

## ✅ Fixed in this session

Implemented locally (everything except payments):

- Removed the public `/api/ai-debug` endpoint.
- Added **rate limiting** (`helmet` security headers + per-IP global/auth limits and a
  per-user AI cap) and an optional `MAX_USERS` registration cap.
- **Token revocation**: `User.tokenVersion` is embedded in every JWT and bumped on
  logout, so old access/refresh tokens stop working.
- **Async bcrypt** (no more event-loop blocking) and **email-format validation** on register.
- **Atomic download reservation** — the daily cap is now race-safe (transaction + compensating delete).
- **Admin users page** rewritten from N+1 to 3 grouped queries, plus pagination.
- **Generic error responses** in production (no internal leak); **graceful shutdown** on SIGTERM/SIGINT.
- **LinkedIn API posting removed** per request (no credentials needed): the LinkedIn
  page is now a generator only — describe what you did and/or upload a screenshot (AI
  vision) → copy & paste. The OAuth routes, DB token fields, and at-rest token
  encryption were removed as no longer applicable.

Still open / out of scope: **payments (Stripe)**, plus the lower-priority items below
that weren't requested (email verification, password reset, observability, tests, queues).

---

## 1. Security bugs / risks

🔴 **Public diagnostic endpoint leaks state and burns money.** `GET /api/ai-debug`
in `src/index.js` is unauthenticated, reports whether `AI_API_KEY` is set, the
model name, and raw error messages, and runs a real Anthropic call on every hit.
It's marked "TEMPORARY — remove after debugging." Remove it (or gate it behind
admin auth) before going live — it's both an info leak and a cost/DoS vector.

🔴 **No rate limiting anywhere.** Login/register are open to brute-force; the AI
routes (`/api/ai/*`) are expensive and uncapped. Add `express-rate-limit` (a
tight limiter on auth, a per-user/day cap on AI calls).

🔴 **Payments are stubbed.** The pricing page advertises $30 / 100 resumes but no
payment is actually processed (confirmed in README "payment stubbed"). Pro plans
can't be sold until Stripe (or similar) is wired in.

🟠 **No email verification.** Registration accepts any string as an email and the
admin approves blind. Now that transactional email exists (see new email system),
add a verify-email step so approvals go to real, owned addresses.

🟠 **No password-reset flow.** Users who forget their password have no recovery;
the only reset is re-running the admin seed. Add a reset-token email flow.

🟠 **Refresh tokens can't be revoked.** They're stateless JWTs; `logout` only
clears the cookie. A stolen refresh token stays valid until expiry (30 days).
Add a server-side token store / `jti` blacklist, or rotate on every refresh.

🟠 **Weak email validation on register.** `auth.js` checks only that fields are
non-empty — `"foo"` is accepted as an email. Reuse the existing `isValidEmail`
helper from `lib/recruiter.js` (or `zod`) at the route boundary.

🟠 **Error handler leaks internals.** The global handler returns `err.message`
verbatim with a 500. In production, log the detail server-side and return a
generic message to the client.

🟠 **No security headers / CSRF.** `helmet` isn't used (no HSTS, CSP, etc.). With
cross-site cookies (`SameSite=None` in prod) state-changing routes are exposed to
CSRF; add CSRF tokens or prefer bearer-token auth for mutations.

🟡 **LinkedIn access token stored in plaintext** (`User.linkedinToken`). Encrypt
at rest, or store only what you must.

🟡 **Default admin password** in `.env.example` is `changeme1234`. Make setup fail
loudly if it's left unchanged in production.

---

## 2. Correctness / reliability bugs

🟠 **Download-limit race (TOCTOU).** The daily limit is checked and then a log row
is written separately, so concurrent downloads can slip past the cap. Make it
atomic (transaction + count, or a unique constraint per user+day).

🟠 **Blocking bcrypt.** `bcrypt.hashSync` / `compareSync` run synchronously and
block the event loop under load. Switch to the async `bcrypt.hash` / `compare`.

🟠 **N+1 queries on the admin users page.** `GET /api/admin/users` loads every
user, then fires 3 count queries per user in a loop. It will crawl past a few
hundred users. Aggregate with `groupBy`, and paginate the list.

🟡 **No pagination** on `/api/resumes` or `/api/tracker` — they return everything.
Fine early, a problem later.

🟡 **Fragile AI JSON parsing.** `extractJson` throws on malformed model output;
it's caught, but a single bad response fails the user's request. Consider a
retry-with-repair pass or schema-validated parsing.

🟡 **No graceful shutdown.** Prisma isn't `$disconnect`ed on `SIGTERM`; add a
shutdown hook so deploys/restarts drain cleanly.

---

## 3. Missing for production (features / ops)

- 🔴 **Stripe billing** (checkout, webhooks, plan sync) — required to monetize.
- 🟠 **Observability:** structured logging, error tracking (e.g. Sentry), uptime
  checks. Right now everything is `console.log`.
- 🟠 **Automated tests for routes.** Only `lib` units are tested (ATS, export,
  JWT, templates). No integration tests for auth/admin/ai. Add Supertest + CI.
- 🟠 **Background job/queue** for emails and AI so they don't run inline in the
  request (the new daily-learning job is a first step toward this).
- 🟠 **File storage** for generated resumes/exports (Supabase Storage is noted in
  the README as a "next step").
- 🟡 **Account management:** delete-account / data-export (GDPR), profile fields
  beyond display name.
- 🟡 **Admin audit log** and user search/filter.
- 🟡 **Cold-start mitigation** on Render free tier (keep-warm ping or paid plan).

---

## 4. What was added in this session (email system)

A Gmail/Nodemailer email layer plus three triggers you asked for:

- **`src/lib/email.js`** — `sendEmail(to, subject, text, html?)`. Never throws;
  no-ops with a log line if `GMAIL_USER` / `GMAIL_APP_PASSWORD` aren't set, so dev
  still runs.
- **New signup → admin** (`routes/auth.js`): the admin (`ADMIN_EMAIL`) is emailed
  when an account is requested.
- **Approved → user** (`routes/admin.js`): the user is emailed when the admin
  approves them, mirroring your `approveTurf` pattern.
- **Daily learning topic → users** (`src/jobs/dailyLearning.js`): for each
  approved, opted-in user, generates a personalized micro-lesson from their
  "Learn by building" profile (`learnTech` / `learnLevel`) and emails it. Falls
  back to a deterministic topic if AI is unavailable.
  - Run on a schedule: `npm run daily:learning` (point a Render Cron Job / system
    cron at it, e.g. daily at 8am).
  - Or trigger manually: `POST /api/admin/send-daily-learning`.
- Schema additions on `User`: `learnTech`, `learnLevel`, `dailyLearningEmail`,
  `lastLearningEmailAt`. Settings page has an opt-in toggle.

### To finish wiring the email feature
1. Set `GMAIL_USER`, `GMAIL_APP_PASSWORD` (a Google **App Password**, not your
   login), and optionally `MAIL_FROM` in `backend/.env`.
2. Run `npm run setup` (or `npm run db:push`) to add the new columns and
   regenerate the Prisma client.
3. Schedule `npm run daily:learning` once a day.

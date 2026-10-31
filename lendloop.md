
# Build LendLoop — take-home assignment

You are building a take-home assignment for a Full-Stack Developer role. Reviewers grade:
**code structure and clarity, security-minded thinking, UX and practicality, integration
design / reliability / error handling (n8n), documentation and reasoning.** Optimise for
those, not for feature count. Work in this directory (`lendloop/`). Commit in small,
meaningful steps with clear messages.

## The product

**LendLoop** — a neighborhood tool-lending board with automated workflows.
Tagline: *"Borrow what you need. Lend what you don't."*
Neighbors list tools they're willing to lend, request to borrow from each other, and get
automated notifications and reminders handled by n8n.

## Mandatory stack (do not substitute)

- **Next.js (App Router)** + **TypeScript** (strict mode)
- **Clerk** for authentication
- **Convex** for data + backend logic (queries, mutations, actions, HTTP endpoints, scheduled
  functions if needed)
- **n8n** for workflow automation, self-hosted via **Docker** (`docker-compose.yml` in the repo)
- **Tailwind CSS** for styling

### UI components — use the 21st.dev MCP

Use the **21st.dev Magic MCP** that is available to you to generate and refine the UI
components (landing hero, tool cards, category filter, date-range picker, request lists,
status badges, empty states, navigation). Keep the design **minimal, clean and consistent**:
one accent colour, good spacing, responsive down to phone width, accessible (labels, focus
states, contrast). Adapt every generated component to the project's conventions and types;
don't paste components you don't use.

### Installing dependencies

Install every npm package with **safe-install**, not plain npm/pnpm/bun install:

```bash
safe-install add <package>            # add a dependency
safe-install install --frozen-lockfile # install from the lockfile
```

Use **pnpm** as the package manager.

## Functional requirements

### Public page (signed out)

- LendLoop name + tagline.
- A **read-only list of available tools**: **name and category only**. **No owner
  details** of any kind (no name, email, id) may reach the browser for signed-out visitors.
  Enforce this in the Convex query's return shape, not by hiding fields in the UI.
- A **"Sign in to lend or borrow"** button wired to Clerk.

### Authenticated experience

Only signed-in users can:

- **List a tool** with: `name`, `category` (power tools, garden, kitchen, camping, cleaning,
  other), `condition` (new, good, fair, worn), short `description`.
- **Request to borrow** a tool for a **date range** (start ≤ end, not in the past, no
  overlap with an already approved loan for that tool, can't borrow your own tool).
- **Approve or decline** requests on **their own tools** only.
- **Mark a loan as returned** (lender side).

Views:

- **All tools** with availability status, **filterable by category**.
- **My listings**, **My requests** (as borrower), **Incoming requests** (as lender).
- A clean, minimal layout.

### Roles & rules — enforced in Convex, not only in the UI

Two roles:

- **admin**: can remove any listing, view all loans, mark a lender as **"Trusted Lender"**
  (show a badge on that lender's tools for signed-in users).
- **user**: can create, edit and delete **only their own** listings, and act only on requests
  involving **their own tools** or **their own borrowing**.

Implementation rules:

- Every Convex mutation/query derives the caller from `ctx.auth.getUserIdentity()` — never
  trust a user id sent by the client.
- Centralise authorization in small helpers (e.g. `requireUser`, `requireAdmin`,
  `requireToolOwner`, `requireLoanParty`) and use them everywhere.
- Store the role on the Convex `users` record (synced from Clerk on first sign-in). Document
  how an admin is bootstrapped (e.g. an env var listing admin emails, or a one-off internal
  mutation) — never a client-side toggle.
- Validate every argument with Convex validators (`v.*`).
- Model loan state as an explicit state machine: `requested → approved | declined`,
  `approved → returned`. Reject illegal transitions server-side.

## Automation with n8n

Build **at least two** n8n workflows and export them as JSON into `n8n/workflows/`.

### 1. Request notification

When a borrow request is **created or changes status**, Convex calls an **n8n Webhook**. The
workflow notifies the relevant user (lender on create, borrower on approve/decline). A
**logged mock notification** is acceptable (e.g. write to a log node / an n8n data table);
email is a bonus. Send **only the fields the notification needs** (data minimisation): e.g.
loan id, tool name, status, recipient first name and email — not whole documents.

Trigger it from a Convex **action** scheduled by the mutation
(`ctx.scheduler.runAfter(0, ...)`), so the user's request never waits on n8n.

### 2. Overdue reminders

A **scheduled** n8n workflow runs **daily**, fetches **overdue loans** (approved, end date
passed, not returned) from a **Convex HTTP endpoint**, sends a reminder to each borrower, and
**writes the reminder status back to Convex** through another HTTP endpoint.

### Security of the integration — both directions

- **Sign webhook payloads with HMAC-SHA256** using a shared secret, including a timestamp,
  and **verify the signature on the receiving side**:
  - Convex → n8n: n8n verifies the signature before doing anything (Code node with
    `crypto`, constant-time comparison, reject stale timestamps, e.g. > 5 minutes).
  - n8n → Convex: Convex HTTP endpoints verify the signature (and timestamp) before reading
    or writing data. Reject with 401 otherwise.
- **Secrets only in environment variables and n8n credentials** — never in code, never in the
  exported workflow JSON. Before committing exports, check they contain no secret values.
- **Idempotent write-backs**: retries must not create duplicate reminders or records. Use an
  idempotency key (e.g. `loanId + reminderDate`) with a uniqueness check in Convex; a repeated
  call returns the existing record.
- **Failures are visible, never silent**: retries on HTTP nodes (with backoff), plus an
  **n8n Error Workflow** wired to both workflows that records/logs the failure (workflow,
  node, error, execution id). Convex-side calls to n8n should also log failures and retry
  with a bounded backoff.

### Bonus (do it if time allows)

Show recent automation activity on each loan in the app, e.g. *"Reminder sent 2 days ago"*,
from the records n8n writes back.

## Repository deliverables

- The app source code.
- `n8n/workflows/*.json` — exported workflows (no secrets inside).
- `docker-compose.yml` — runs n8n locally (with a persistent volume).
- `.env.example` files for Next.js, Convex and n8n listing every variable (no real values).
- **`README.md`** covering:
  - Local setup step by step: install, Clerk app + JWT template for Convex, `npx convex dev`,
    `docker compose up` for n8n, importing the workflows, setting credentials, seeding data.
  - Environment variables (what each one is for, where it lives).
  - Architecture: a short diagram (Mermaid) of Next.js ↔ Clerk ↔ Convex ↔ n8n and the two
    workflow flows.
  - **Security and data-minimisation decisions**: auth model, RBAC enforcement, what the
    public endpoint exposes, HMAC scheme, secret handling, idempotency, error handling.
  - A short **"What I'd change for production"** section (e.g. real email provider, rate
    limiting, secret rotation, audit log, monitoring/alerting, queue for outbound webhooks,
    timezone handling for "overdue").
- A **seed script** creating a few demo users, tools and loans (including one overdue loan) so
  a reviewer can try everything in minutes.

## Quality bar

- TypeScript strict, no `any` in app code.
- Small, readable modules: `convex/` split by domain (`tools.ts`, `loans.ts`, `users.ts`,
  `http.ts`, `lib/auth.ts`, `lib/hmac.ts`), components grouped by feature.
- Tests for the parts that matter most: authorization helpers, loan state transitions,
  overlap check, HMAC sign/verify, idempotent write-back (Vitest; `convex-test` for Convex
  functions).
- Loading, empty and error states in the UI; optimistic feedback where cheap.
- `pnpm lint`, `pnpm typecheck` and `pnpm test` must pass. Add those scripts.

## Order of work

1. Scaffold Next.js + Convex + Clerk; confirm sign-in and an authenticated Convex query work.
2. Schema (`users`, `tools`, `loans`, `notifications`/`reminders`) with indexes; auth helpers.
3. Tools CRUD + public read-only query; then loans (request, approve/decline, return).
4. UI with the 21st.dev MCP: public page, all tools + filter, my listings, my requests,
   incoming requests, admin view.
5. HMAC helpers + Convex HTTP endpoints; outbound webhook action with retries.
6. n8n via Docker: both workflows + error workflow; export JSON; verify no secrets inside.
7. Seed script, tests, README, production notes.

Before finishing, run the full flow end to end (create → approve → overdue reminder →
write-back visible in the app) and fix anything that breaks. Report what you verified and
anything you could not.

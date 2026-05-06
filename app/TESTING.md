# Testing — Priya's Reinigungsservice

A complete, **free**, local-only harness for verifying every role × every feature
end-to-end. Two paths — automated (Playwright) and manual (the matrix at the
bottom). Run both.

---

## 1. Set up your free test stack

You have two choices. Both are free.

### Option A — Supabase Cloud (free tier, recommended)

1. Sign in to <https://supabase.com> and create a new project. Free tier
   includes 500 MB Postgres + 1 GB file storage + 50k monthly auth users.
   That's wildly enough for QA.
2. From the Supabase dashboard → **Project settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (SERVER ONLY) → `SUPABASE_SERVICE_ROLE_KEY`
3. From **Project settings → Database → Connection string**, copy the
   `URI` (not pooled) → `SUPABASE_DB_URL` (you'll need this for `psql`).
4. Apply migrations + seeds:
   ```bash
   # In the Supabase SQL editor, or via psql:
   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260504_000001_foundation.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260504_000002_domain.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260504_000003_storage.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260504_000004_oauth_signup.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260504_000005_requirements_extensions.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260504_000006_chat_default_membership.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260504_000007_chat_realtime.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260504_000008_fixes.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260504_000009_dashboard_seed.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260504_000010_clients_seed.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260504_000011_push_subscriptions.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260504_000012_chat_attachments_bucket.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260504_000013_training_assignments.sql
   psql "$SUPABASE_DB_URL" -f supabase/seed/seed.sql
   psql "$SUPABASE_DB_URL" -f supabase/seed/test_users.sql
   ```

### Option B — fully local Postgres (Supabase CLI)

Install the Supabase CLI (Homebrew, scoop, or the standalone binary), then:
```bash
supabase start          # boots Postgres, Studio, Storage, Auth in Docker
supabase db reset       # applies every migration + seed.sql
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" -f supabase/seed/test_users.sql
```
Use the keys from `supabase status` for `.env.local`.

### `.env.local`

Copy `.env.example` → `.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_LOCALE=de
NEXT_PUBLIC_DEFAULT_ORG_ID=00000000-0000-0000-0000-0000000000aa

# Optional — needed only if you want to test push notifications:
NEXT_PUBLIC_VAPID_PUBLIC_KEY=          # leave blank to disable push tests
WEB_PUSH_PRIVATE_KEY=
WEB_PUSH_SUBJECT=mailto:test@example.com
```

To generate a VAPID key pair for free:
```bash
npx web-push generate-vapid-keys
```

### Boot the app

```bash
npm install
npm run dev
# App at http://localhost:3000
```

Sign in with one of the test users below.

---

## 2. Test users

The seed `supabase/seed/test_users.sql` creates three confirmed accounts in the
default org:

| Email                  | Password    | Role        | Spec name        |
| ---------------------- | ----------- | ----------- | ---------------- |
| admin@priya.test       | Test1234!   | admin       | Management       |
| dispatcher@priya.test  | Test1234!   | dispatcher  | Project Manager  |
| employee@priya.test    | Test1234!   | employee    | Field Staff      |

The employee user is also linked to a `public.employees` row, so they appear in
schedule pickers, vacation forms, and training assignments.

---

## 3. Automated E2E tests (Playwright — deterministic)

```bash
npm install
npm run test:e2e:install     # one-time: download browser engines
npm run test:e2e             # headless run, deterministic suites only
npm run test:e2e:ui          # interactive inspector
```

Suites in `tests/e2e/*.spec.ts`:

- `auth.spec.ts` — login form, invalid credentials, unauthenticated redirect.
- `role-admin.spec.ts` — admin reaches every top-level destination.
- `role-dispatcher.spec.ts` — dispatcher sees schedule/clients/training; can review vacation.
- `role-employee.spec.ts` — field staff submit vacation, see chat + training, blocked from `/onboard`.
- `i18n.spec.ts` — DE strings render, switcher offers DE/EN/TA.

Add new tests by dropping a `*.spec.ts` file into `tests/e2e/`. The fixtures
in `tests/e2e/fixtures/auth.ts` give you `signIn(page, "admin" | "dispatcher" | "employee")`.

---

## 3b. Automated E2E tests (Stagehand — AI-driven)

Stagehand lets you write tests in plain English. It sits on top of Playwright,
so it shares the same dev-server, base URL, screenshots, and reports — only
the spec files differ. Use Stagehand for flows where deterministic selectors
are painful (canvas-based signature pad, drag-resize on the schedule, complex
modals) and for autonomous smoke runs that can spot "renders but is broken"
issues a fixed-selector test would never notice.

### One-time setup

1. Install (already in package.json — just run `npm install`):
   - `@browserbasehq/stagehand`
   - `@anthropic-ai/sdk`

2. Get an API key. **Free options:**
   - **Anthropic** — sign up at console.anthropic.com; new accounts get free
     credits, and the cheapest Claude Haiku model is fine for most flows.
     Set `ANTHROPIC_API_KEY` in `.env.local`.
   - **OpenAI** — alternative; new accounts also get free credits. Set
     `OPENAI_API_KEY` and `STAGEHAND_MODEL=gpt-4o-mini`.

3. (No Browserbase account required — we run the browser locally so it's
   completely free aside from LLM calls.)

### Run

```bash
npm run test:stagehand          # all Stagehand specs, headless
npm run test:stagehand:ui       # interactive — watch the AI click around
STAGEHAND_VERBOSE=1 npm run test:stagehand   # print every act/extract decision
```

### Specs

In `tests/e2e/stagehand/`:

- `login.stagehand.spec.ts` — pure natural-language login, then `extract()`
  pulls the user's display name from the dashboard.
- `onboarding.stagehand.spec.ts` — dispatcher onboards an Alltagshilfe client
  through all five wizard steps. Includes the canvas-based signature pad
  ("draw a signature by dragging from left to right") and the consent
  checkbox. This is where Stagehand earns its keep — every other test
  framework would force you to pick CSS selectors for that canvas.
- `explore.stagehand.spec.ts` — autonomous walk-through. Visits every
  top-level page and uses `page.extract({ schema })` to ask the model
  "summarize this page; is anything broken?". Fails the test if the
  AI reports `hasErrors: true`. Great pre-deploy smoke run.

### Writing your own

```ts
import { test, expect } from "../fixtures/stagehand-fixture";
import { z } from "zod";

test("I describe what I want, the agent does it", async ({ stagePage, baseURL }) => {
  await stagePage.goto(`${baseURL}/clients`);
  await stagePage.act("Click the new-client button");
  await stagePage.act("Pick Alltagshilfe as the customer type");

  // Extract structured data — schema-validated.
  const result = await stagePage.extract({
    instruction: "Get the page heading and any error messages shown",
    schema: z.object({
      heading: z.string(),
      errors: z.array(z.string()),
    }),
  });
  expect(result.errors).toHaveLength(0);
});
```

Three primitives:
- `await page.act(instruction)` — perform an action.
- `await page.observe(instruction)` — find candidate elements without acting.
- `await page.extract({ instruction, schema })` — pull structured data with
  Zod validation.

### Cost notes

A typical Stagehand spec costs cents-per-run with Claude Haiku, low cents
with Sonnet, more with GPT-4o. The `explore.stagehand.spec.ts` smoke test
makes ~10 LLM calls per run. If you're worried, set
`STAGEHAND_MODEL=claude-3-5-haiku-20241022` for the cheapest Anthropic model
or `STAGEHAND_MODEL=gpt-4o-mini` for the cheapest OpenAI model.

---

## 4. Manual test matrix

Walk this every time before deploying. Each row is **independent**: tear down
or skip if the previous one fails. Each column is "expected outcome per role".

### 4.1 Authentication & profile

| Test | Admin | Dispatcher | Employee |
|---|---|---|---|
| Sign in with correct password lands on `/dashboard` | ✅ | ✅ | ✅ |
| Sign in with wrong password shows error, stays on `/login` | ✅ | ✅ | ✅ |
| Sign in with unconfirmed email shows error | ✅ | ✅ | ✅ |
| Topbar shows correct full name + role badge | ✅ Management | ✅ Project Manager | ✅ Field Staff |
| Sign out from user menu returns to `/login` | ✅ | ✅ | ✅ |
| Direct `/dashboard` URL while signed-out → `/login` redirect | ✅ | ✅ | ✅ |
| Settings → Security → enable 2FA → QR + secret render | ✅ | ✅ | n/a (employees skip) |
| 2FA verify with valid 6-digit code marks Enabled | ✅ | ✅ | – |
| Sign out + sign in again with 2FA enabled prompts for code | ✅ | ✅ | – |

### 4.2 Clients (§4.1)

| Test | Admin | Dispatcher | Employee |
|---|---|---|---|
| `/clients` loads with 10 seeded clients + summary cards | ✅ | ✅ | ✅ (read-only) |
| Search filter narrows the list | ✅ | ✅ | ✅ |
| Type filter (Residential / Commercial / Alltagshilfe) works | ✅ | ✅ | ✅ |
| New-client wizard at `/clients/new` shows three options | ✅ | ✅ | redirect |
| Submit residential creates client, redirects to detail | ✅ | ✅ | – |
| Submit alltagshilfe requires insurance fields | ✅ | ✅ | – |
| Edit client persists changes | ✅ | ✅ | – |
| Archive client (admin-only) | ✅ | – | – |

### 4.3 Tablet onboarding (§4.10)

| Test | Admin | Dispatcher | Employee |
|---|---|---|---|
| `/onboard` loads stepper | ✅ | ✅ | redirect to `/dashboard` |
| Step "Type" requires a selection | ✅ | ✅ | – |
| Step "Client" enforces required fields per type | ✅ | ✅ | – |
| Step "Address" is skippable | ✅ | ✅ | – |
| Step "Service" frequency + day picker work | ✅ | ✅ | – |
| Step "Sign" requires name + signature SVG + consent checkbox | ✅ | ✅ | – |
| Submit creates client + property + service_scope + signature | ✅ | ✅ | – |
| Success page shows "Onboard another" + "To clients" buttons | ✅ | ✅ | – |
| Inspect DB: `client_signatures` row has signature_svg starting with `<svg ` | ✅ | ✅ | – |

### 4.4 Properties (§4.2)

| Test | Admin | Dispatcher | Employee |
|---|---|---|---|
| `/properties` lists with summary | ✅ | ✅ | ✅ |
| Property detail loads | ✅ | ✅ | ✅ |
| New property succeeds | ✅ | ✅ | – |
| Auto-channel `#prop-<name>` exists in chat after create | ✅ | ✅ | ✅ visible |
| Photo upload to private bucket succeeds, gallery renders signed URLs | ✅ | ✅ | – |
| Damage report card: log report w/ category + severity + description | ✅ | ✅ | ✅ |
| Damage report photo attaches | ✅ | ✅ | ✅ |
| "Mark resolved" button visible to admin/dispatcher | ✅ | ✅ | hidden |
| "💬 Discuss" button posts a structured card to property channel | ✅ | ✅ | ✅ |
| Clicking "Discuss" deep-links to `/chat/<channel-id>` | ✅ | ✅ | ✅ |

### 4.5 Schedule (§4.3, §4.4)

| Test | Admin | Dispatcher | Employee |
|---|---|---|---|
| Week calendar renders | ✅ | ✅ | ✅ (own shifts only) |
| Sidebar filters apply | ✅ | ✅ | ✅ |
| "Plan shift" modal opens, validates, creates a shift | ✅ | ✅ | hidden |
| "New assignment" modal opens | ✅ | ✅ | hidden |
| Shift detail panel shows all fields | ✅ | ✅ | ✅ |
| Drag-resize / drag-move shift (if implemented) updates DB | ✅ | ✅ | – |

### 4.6 Employees (§4.3)

| Test | Admin | Dispatcher | Employee |
|---|---|---|---|
| `/employees` loads with seeded roster | ✅ | ✅ | ✅ |
| Employee detail loads | ✅ | ✅ | ✅ |
| Invite modal sends invitation (admin-only) | ✅ | – | – |
| Edit employee data | ✅ | ✅ | – |
| Archive employee (admin-only) | ✅ | – | – |

### 4.7 Vacation (§4.8)

| Test | Admin | Dispatcher | Employee |
|---|---|---|---|
| `/vacation` lists requests | ✅ all | ✅ all | ✅ own only |
| "New request" button visible | ✅ | ✅ | ✅ |
| Submit valid date range creates pending row | ✅ | ✅ | ✅ |
| Approve / Reject buttons visible | ✅ | ✅ | hidden |
| Approve fires audit_log row | ✅ | ✅ | – |
| Balance card updates after approval | – | – | ✅ |

### 4.8 Training (§4.9)

| Test | Admin | Dispatcher | Employee |
|---|---|---|---|
| `/training` hub renders | ✅ | ✅ | ✅ (filtered) |
| "New module" button visible | ✅ | ✅ | hidden |
| Create module with YouTube URL embeds the iframe | ✅ | ✅ | – |
| Create module with `.mp4` URL renders `<video>` | ✅ | ✅ | – |
| Mark started / completed / reset persists per employee | – | – | ✅ |
| Mandatory tag visible on flagged modules | ✅ | ✅ | ✅ |
| Stat strip: total / completed / mandatory / progress all numeric | ✅ | ✅ | ✅ |
| Assign… modal opens with employee picker | ✅ | ✅ | hidden |
| Save assignments restricts module visibility for non-listed employees | ✅ | ✅ | reflected |

### 4.9 Invoices (§4.7)

| Test | Admin | Dispatcher | Employee |
|---|---|---|---|
| `/invoices` lists with status pills | ✅ | ✅ | hidden |
| Create invoice from client detail | ✅ | ✅ | – |
| Invoice PDF downloads correctly (`/api/invoices/<id>/pdf`) | ✅ | ✅ | – |
| Mark sent / Mark paid update DB + status pill | ✅ | ✅ | – |
| Lexware sync button visible (admin-only) | ✅ | – | – |

### 4.10 Reports (§4.7)

| Test | Admin | Dispatcher | Employee |
|---|---|---|---|
| `/reports` shows KPI cards | ✅ | ✅ | hidden |
| `/reports/alltagshilfe` renders the monthly hours table | ✅ | ✅ | – |
| Month navigator updates the data | ✅ | ✅ | – |

### 4.11 Settings (§5)

| Test | Admin | Dispatcher | Employee |
|---|---|---|---|
| `/settings` visible | ✅ | ✅ | hidden |
| Company section editable, save persists | ✅ | view-only | – |
| Tax / VAT rate editable, save persists | ✅ | view-only | – |
| Notifications matrix toggles persist | ✅ | view-only | – |
| Locale section saves date format / week start | ✅ | view-only | – |
| Push toggle card shows current device state | ✅ | ✅ | – |
| Click Enable → browser permission prompt → state becomes "Active" | ✅ | ✅ | – |

### 4.12 Chat (§4.6)

| Test | Admin | Dispatcher | Employee |
|---|---|---|---|
| `/chat` channel list renders | ✅ | ✅ | ✅ |
| Send a text message — appears in the thread | ✅ | ✅ | ✅ |
| Realtime: message sent in another browser tab appears live | ✅ | ✅ | ✅ |
| 📎 attach: pick an image, preview chip renders, send → image bubble | ✅ | ✅ | ✅ |
| 📎 attach: PDF, file chip with size renders | ✅ | ✅ | ✅ |
| 🎤 record: permission prompt, record, stop, send → audio bubble | ✅ | ✅ | ✅ |
| Clicking image bubble opens it full-size in new tab | ✅ | ✅ | ✅ |
| Audio bubble plays via native control | ✅ | ✅ | ✅ |
| Damage report → "💬 Discuss" posts a card here | ✅ | ✅ | ✅ |

### 4.13 Notifications (§5)

| Test | Admin | Dispatcher | Employee |
|---|---|---|---|
| `/notifications` lists rows, badge in topbar matches unread count | ✅ | ✅ | ✅ |
| "Mark read" updates badge | ✅ | ✅ | ✅ |
| "Mark all read" clears the badge | ✅ | ✅ | ✅ |
| When push is enabled, an emit_notification fires a desktop alert | ✅ | ✅ | ✅ |
| Clicking the desktop alert opens the deep-link URL | ✅ | ✅ | ✅ |

### 4.14 i18n & responsiveness

| Test | DE | EN | TA |
|---|---|---|---|
| Switch language from topbar | ✅ | ✅ | ✅ |
| All visible strings translate (no `nav.something` raw keys) | ✅ | ✅ | ✅ |
| Tamil renders with Noto Sans Tamil | – | – | ✅ |
| Mobile breakpoint <768 px: sidebar drawer + bottom nav | ✅ | ✅ | ✅ |
| Tablet 768–1023 px: collapsed icon-only sidebar | ✅ | ✅ | ✅ |
| Desktop ≥1024 px: full sidebar + sticky topbar | ✅ | ✅ | ✅ |

---

## 5. RBAC sanity (run as a smoke check)

Each "must-deny" call exercises a server action that should fail when a
user without the permission tries it. Easiest way: open DevTools as the
employee user and from the React DevTools, invoke the action directly,
or use `curl` against the action endpoint.

| Action                         | admin | dispatcher | employee |
| ------------------------------ | ----- | ---------- | -------- |
| `client.create`                | allow | allow      | deny     |
| `client.archive` / `delete`    | allow | deny       | deny     |
| `property.create` / `update`   | allow | allow      | deny     |
| `shift.create`                 | allow | allow      | deny     |
| `invoice.create` / `update`    | allow | allow      | deny     |
| `invoice.delete`               | allow | deny       | deny     |
| `invoice.lexware_sync`         | allow | deny       | deny     |
| `vacation.approve`             | allow | allow      | deny     |
| `damage.create`                | allow | allow      | allow    |
| `damage.resolve`               | allow | allow      | deny     |
| `training.manage`              | allow | allow      | deny     |
| `settings.update`              | allow | deny       | deny     |
| `employee.create` / `archive`  | admin | deny       | deny     |

When a denied action runs, the action returns
`{ ok: false, error: "Role 'X' is not permitted to <action>" }` — the UI
surfaces this through `toast.error`.

---

## 6. Cleanup between runs

Truncate everything but the org + settings + test users:
```sql
truncate
  public.notifications, public.audit_log,
  public.chat_messages, public.chat_members, public.chat_channels,
  public.invoice_items, public.invoices,
  public.shifts,
  public.properties,
  public.contracts, public.service_scopes, public.property_keys,
  public.vacation_requests,
  public.training_modules, public.employee_training_progress,
  public.training_assignments,
  public.damage_reports, public.client_signatures,
  public.push_subscriptions
restart identity cascade;
```

Then re-apply `supabase/seed/seed.sql` for fresh demo data.

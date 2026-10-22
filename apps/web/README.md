# Outreach dashboard

Next.js dashboard with seven routes: overview, discovery, leads, campaigns, inbox, analytics, and settings.
The root route redirects to `/overview`.

## Run

From the repository root:

```powershell
pnpm dev
```

Open http://localhost:3000/overview.
For the live API health indicator, also run the FastAPI backend on port 8000.
`NEXT_PUBLIC_API_BASE_URL` is configured in `apps/web/.env.local`.
The Next.js `/api/health` route forwards only the readiness status; business data is not fetched yet.

## Current behavior

- Leads, profile evidence, approval status, review counts, search and pagination use PostgreSQL through FastAPI.
- Add lead saves manually entered contacts and optional public source evidence to the database.
- Approval requires evidence and respects backend suppression/validation. Approval does not send email.
- Missing location/qualification data is shown as unavailable instead of fabricated values.
- The overview queue and sidebar counts refresh after creation or approval.
- There is no fallback to fictional leads. Loading, empty, and error states are explicit.
- Campaign creation, listing, detail views, editing, recipient selection, and schedule/sequence storage use PostgreSQL.
- Inbox conversations, illustrative activity charts, and preferences still use labeled sample/local data.

## Local authenticated bridge

Run the backend on localhost:8000 and Next.js in development mode on localhost:3000.
Refresh the local owner credential from `services/control-api` when needed:

```powershell
.venv/Scripts/python.exe -m app.auth.bootstrap --email dev@outreach.invalid --workspace "Local development"
```

Next.js `/api/leads` routes use server-only credentials in `apps/web/.env.local` and forward only the permitted lead endpoints.
The Bearer token and workspace authentication headers are never sent to the browser or written to localStorage.
Requests are restricted to localhost and mutating requests reject foreign origins.
This is a local single-user bridge: it deliberately returns 503 outside development mode.
A production deployment requires real user sign-in and per-user server-side workspace credentials.

Existing demo lead values in browser storage are ignored. The database may be empty; use Add lead to create your first contact.
Sample campaigns and conversations remain under `outreach-workspace-demo-v1` in localStorage.

## Checks

From the repository root, with the dashboard running:

```powershell
pnpm lint
pnpm typecheck
pnpm build
services/local-worker/.venv/Scripts/python.exe tests/e2e/dashboard_smoke.py
```

The smoke check covers all routes on desktop and mobile, persistence, approvals, campaign creation,
research briefs, reply drafts, preferences, chart controls, and browser runtime errors.
For the live lead workflow also run:

```powershell
services/local-worker/.venv/Scripts/python.exe tests/e2e/live_leads.py
```

This creates a uniquely named integration fixture, verifies persistence and approval, and removes only its own fixture data afterward.

Screenshots are written to `artifacts/dashboard-desktop.png` and `artifacts/dashboard-mobile.png`.

## Campaign workflow

Open `/campaigns/new` to define a campaign brief, select approved contacts, write up to eight sequence
steps, and choose a timezone, sending days, daily limit, and local sending window.
Creation opens `/campaigns/{id}` with Overview, Sequence, Recipients, Activity and Settings tabs.
Use Edit campaign to update an unsent draft. Saves use optimistic version checks to prevent stale edits
from overwriting newer changes. Campaign creation is retry-safe and edits write audit events.
No start/send action is available yet: Gmail and worker dispatch are not implemented.

Campaign data is never read from the old browser demo store. The local bridge handles GET/POST/PUT
campaign requests using server-side credentials. Production sign-in is still required before deployment.

```powershell
services/local-worker/.venv/Scripts/python.exe tests/e2e/live_campaigns.py
```

This checks creation, approved recipients, follow-ups, schedule, opening, editing, persistence,
audit history, and mobile layouts with isolated fixtures that are removed afterward.
The local development server uses Webpack to avoid repeated Turbopack refreshes observed on this Windows workspace.

The dashboard bridge reads OUTREACH_API_TOKEN, OUTREACH_WORKSPACE_ID and OUTREACH_TOKEN_EXPIRES_AT from server-only environment variables. Bootstrap refreshes them in the ignored apps/web/.env.local; none use the NEXT_PUBLIC_ prefix. This avoids development bundler watch loops caused by reading credentials from an external workspace file on every request.


### Data source switch

Use the API data / Mock data switch in the dashboard header. API is the default; the selection is remembered in this browser. Switching resets open forms and selections.

All section fixtures live in lib/mock-data.ts. Mock lead and campaign edits run in memory, reset on reload, and never call the backend. Browser preferences and reply drafts use separate storage per source.

API mode uses existing lead, campaign, and Gmail endpoints. Live inbox and time-series analytics are not implemented, so API mode shows their unavailable state. Research briefs and outreach preferences remain browser-local.

# Control API

FastAPI foundation with 16 PostgreSQL tables and a frozen initial Alembic migration.
Health and authenticated lead endpoints are exposed. Worker leasing and sending are future work. Database tenant constraints do not replace API authorization.
Models use UUID identifiers, UTC-capable timestamps and JSONB. Scores use 0â€“100 for fit and 0â€“1 for confidence.
Email status `published` records source evidence; it does not assert deliverability.

## Start locally

From the repository root, with Docker Desktop installed and running, start PostgreSQL and apply/verify migrations in one command:

```powershell
./scripts/start-database.ps1
```

Or run the steps individually:

```powershell
docker compose --env-file .env -f infra/docker-compose.dev.yml up -d
cd services/control-api
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Settings load the root `.env` using an absolute path, independently of the working directory.
Environment variables override that file. DATABASE_URL must use `postgresql+psycopg://`.
No tables are created on startup: apply migrations explicitly.
Database sessions roll back uncommitted changes on close; service transactions must commit explicitly.

- API docs: http://localhost:8000/docs
- Liveness: http://localhost:8000/api/v1/health/live
- Readiness: http://localhost:8000/api/v1/health/ready

Readiness returns 503 if PostgreSQL is unreachable or the migration revision is not current.
Responses never include connection errors or credentials. Liveness does not contact the database.
Gmail OAuth and encrypted credential storage are implemented; see ../../GMAIL_SETUP.md. Worker credentials are not implemented yet.

## Migrations

From this directory:

```powershell
.venv/Scripts/python.exe -m alembic upgrade head --sql
.venv/Scripts/python.exe -m alembic revision --autogenerate -m "Describe schema change"
```

Review generated migrations before applying. Downgrading the initial revision removes all application tables;
use only on disposable development databases. The initial migration is frozen and does not import live models.
Update the health readiness revision when adding a migration.

## Checks

From the repository root:

```powershell
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
.venv/Scripts/python.exe -m pytest tests/integration/test_backend.py
.venv/Scripts/ruff.exe check services/control-api tests/integration/test_backend.py
```

The default tests verify API lifecycle/readiness and PostgreSQL upgrade/downgrade SQL generation.
Live database migration and constraint tests require PostgreSQL and are not replaced by SQL rendering.

## Lead API (implemented)

Business routes require a signed Bearer token and `X-Workspace-ID` matching a database membership.
Tokens are validated with HS256, issuer, audience, issued-at and expiration checks. No login endpoint
or public signup is exposed yet. This local bootstrap is for development; production identity-provider
integration remains outstanding.

From `services/control-api`:

```powershell
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m app.auth.bootstrap --email dev@outreach.invalid --workspace "Local development"
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The bootstrap writes an eight-hour token and workspace ID to the ignored root `.secrets/local-api.json` and updates server-only OUTREACH_* values in `apps/web/.env.local`.
It does not print credentials. Rerun to refresh an expired token. Never place this token in browser localStorage.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | /api/v1/leads | Paginated leads; query, status, limit and offset filters |
| POST | /api/v1/leads | Create a contact/company with optional source evidence |
| GET | /api/v1/leads/{id} | Contact, company and per-field evidence |
| GET | /api/v1/leads/summary | Workspace total, approved and review counts |
| POST | /api/v1/leads/approve | Atomically approve up to 100 contacts |

Creation requires `Idempotency-Key` (1–100 characters). Repeating the same key/body returns the same
contact; changing the body returns 409. Retried approvals are naturally idempotent and do not duplicate audit events.
Approvals fail if any requested contact is outside the workspace, missing evidence, invalid/bounced,
or suppressed. Evidence is manually supplied and has not been fetched/verified by a research worker.
Email status remains unknown; approval does not assert mailbox deliverability or authorize a send.
All mutations commit their audit event in the same database transaction.

Example creation body:

```json
{
  "name": "Example Founder",
  "title": "Founder",
  "company_name": "Example company",
  "company_domain": "example.invalid",
  "evidence": [{
    "field_name": "title",
    "field_value": "Founder",
    "source_url": "https://example.invalid/team",
    "confidence": 0.8,
    "observed_at": "2026-10-22T10:00:00Z"
  }]
}
```

The example uses a reserved domain; replace it with legitimately collected source data for actual records.
The dashboard lead workflow is connected through a local-development server-side API bridge. Campaign and inbox data remain samples.

Integration tests in `tests/integration/test_leads_api.py` require migrated local PostgreSQL.
They use an outer transaction and nested savepoints; all test records are rolled back.
Run `.venv/Scripts/python.exe -m pytest tests/integration -q` from the repository root.

## Campaign API

- `GET /api/v1/campaigns`: workspace-scoped list with limit/offset.
- `POST /api/v1/campaigns`: create a draft with Idempotency-Key.
- `GET /api/v1/campaigns/{id}`: details, steps, enrolled recipients, status/counts, schedule, blockers and audit activity.
- `PUT /api/v1/campaigns/{id}`: edit an unsent draft/paused campaign, requiring expected_version.

Only approved, non-suppressed contacts from the same workspace can be enrolled.
Sequences support 1–8 steps; the initial step has zero delay and follow-ups wait 1–90 days after the prior step.
Schedule validation requires a valid IANA timezone, unique weekdays, a local window ending after it starts,
and a daily limit of 1–10. No email dispatch is implemented by these routes.
Edits are blocked when there are messages or the campaign is running/completed, and version conflicts return 409.
Migration 0003 allows drafts without mailboxes. Its downgrade refuses to run while any draft lacks a mailbox.

The dashboard bridge reads OUTREACH_API_TOKEN, OUTREACH_WORKSPACE_ID and OUTREACH_TOKEN_EXPIRES_AT from server-only environment variables. Bootstrap refreshes them in the ignored apps/web/.env.local; none use the NEXT_PUBLIC_ prefix. This avoids development bundler watch loops caused by reading credentials from an external workspace file on every request.

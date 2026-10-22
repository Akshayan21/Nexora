# Outreach Agent

Gmail connection is available from Settings. See [Gmail setup](GMAIL_SETUP.md) for Google credentials, the callback URL, and local startup steps. Connecting is read-only; dispatch and inbox sync remain unimplemented.

Hybrid outreach project: Next.js dashboard, FastAPI control API, local Python worker.
FastAPI startup, PostgreSQL models and the initial Alembic migration are implemented. The authenticated lead and campaign APIs is implemented for local development. Research, production sign-in, inbox integration, and sending are not implemented.
See [backend setup](services/control-api/README.md) for database migration and API startup commands.

## Requirements

Node.js 22+, pnpm 11.25.0, Python 3.12+ (installed here with Python 3.14), Docker Desktop with Compose.

## Install (PowerShell, repository root)

```powershell
pnpm install --frozen-lockfile
python -m venv services/control-api/.venv
services/control-api/.venv/Scripts/python.exe -m pip install -r services/control-api/requirements.txt
python -m venv services/local-worker/.venv
services/local-worker/.venv/Scripts/python.exe -m pip install -r services/local-worker/requirements.txt
services/local-worker/.venv/Scripts/python.exe -m playwright install chromium
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item infra/searxng/settings.example.yml infra/searxng/settings.yml
```

Local development environment files may already exist with generated secrets; preserve those files instead of overwriting them.
Replace every CHANGE_ME locally, including the SearXNG secret. Keep secrets out of Git.
The web environment is separate because Next.js loads environment files from apps/web.
The committed Python locks were generated on Windows with Python 3.14. For another OS or Python version, resolve from requirements.in if a locked wheel is unavailable.
The control API loads the root .env automatically. The worker entrypoint is not implemented.
requirements.in files declare direct dependencies; requirements.txt files lock the installed environment.
Regenerate each lock using its own virtual environment after dependency updates.

## Start the dashboard

From the `outreach-agent` folder, run:

```powershell
npm.cmd run dev
```

Open the localhost URL printed in the terminal (normally http://localhost:3000).
Keep the terminal open; press Ctrl+C to stop. This startup command does not require pnpm on PATH; dependencies must already be installed using the install steps above.

## Run infrastructure

```powershell
docker compose --env-file .env -f infra/docker-compose.dev.yml up -d
docker compose -f infra/docker-compose.local.yml up -d
docker compose -f infra/docker-compose.local.yml exec ollama ollama pull qwen3:4b
pnpm dev
```

API startup commands are in services/control-api/README.md. The worker entrypoint is not implemented. Containers use localhost ports.
Docker images use moving tags for development; pin digests before deployment.
Dry-run mode and human lead approval default to enabled. Do not enable sending before stop-condition tests.

## Verify

```powershell
pnpm lint
pnpm typecheck
pnpm build
services/control-api/.venv/Scripts/python.exe -m pip check
services/local-worker/.venv/Scripts/python.exe -m pip check
```

Auth provider selection and application credentials are deferred to implementation.

The dashboard Leads page and overview review queue now use PostgreSQL through a local server-side authenticated bridge. See apps/web/README.md for startup and credential refresh instructions.

Campaigns now support database-backed creation, individual detail pages, approved recipients, editable email sequences and schedules, audit history, and optimistic edit version checks. Gmail and worker dispatch remain unimplemented.

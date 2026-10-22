$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$dockerCommand = Get-Command docker.exe -ErrorAction SilentlyContinue
$dockerCandidates = @(
    "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe",
    "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
)
if ($dockerCommand) { $dockerPath = $dockerCommand.Source }
else { $dockerPath = $dockerCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1 }
if (-not $dockerPath) { throw 'Install Docker Desktop, then rerun this script.' }
$env:PATH = (Split-Path -Parent $dockerPath) + [IO.Path]::PathSeparator + $env:PATH
& $dockerPath info --format '{{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop and wait until its Linux engine is running, then retry.' }
Push-Location $projectRoot
try {
    & $dockerPath compose --env-file .env -f infra/docker-compose.dev.yml up -d --wait --wait-timeout 120 postgres
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL did not become healthy. Check Docker Compose logs.' }
    $apiPython = Join-Path $projectRoot 'services/control-api/.venv/Scripts/python.exe'
    if (-not (Test-Path -LiteralPath $apiPython)) { throw 'Install backend dependencies first.' }
    Push-Location (Join-Path $projectRoot 'services/control-api')
    try {
        & $apiPython -m alembic upgrade head
        if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
        & $apiPython -m alembic current
        if ($LASTEXITCODE -ne 0) { throw 'Could not verify migration revision.' }
        & $apiPython -c 'from app.config import get_settings; from app.database import build_engine; from app.models import Base; from sqlalchemy import inspect; engine=build_engine(get_settings()); tables=set(inspect(engine).get_table_names()); missing=set(Base.metadata.tables)-tables; assert not missing, f"Missing tables: {missing}"; print(f"Verified {len(Base.metadata.tables)} application tables."); engine.dispose()'
        if ($LASTEXITCODE -ne 0) { throw 'Database schema verification failed.' }
    }
    finally { Pop-Location }
    & $dockerPath compose --env-file .env -f infra/docker-compose.dev.yml ps
}
finally { Pop-Location }

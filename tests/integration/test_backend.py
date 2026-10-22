from io import StringIO
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from alembic import command
from alembic.config import Config
from app.config import Settings
from app.main import create_app
from app.models import Base
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.exc import OperationalError

API_ROOT = Path(__file__).resolve().parents[2] / "services" / "control-api"


def test_settings_reject_non_postgres():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url="sqlite://")


def test_liveness_and_database_readiness(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr("app.main.build_engine", lambda _: engine)
    settings = Settings(
        _env_file=None, database_url="postgresql+psycopg://test:test@localhost/test"
    )
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/v1/health/live").json() == {"status": "ok"}
        engine.connect.assert_not_called()
        connection = engine.connect.return_value.__enter__.return_value
        connection.execute.return_value.scalar.return_value = "0003_campaign_details"
        assert client.get("/api/v1/health/ready").status_code == 200
        connection.execute.return_value.scalar.return_value = "old_revision"
        assert client.get("/api/v1/health/ready").status_code == 503
        engine.connect.side_effect = OperationalError("secret database error", {}, Exception())
        response = client.get("/api/v1/health/ready")
        assert response.status_code == 503
        assert response.json() == {"status": "not_ready"}
        assert "secret" not in response.text
        response = client.options(
            "/api/v1/health/live",
            headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "GET"},
        )
        assert "access-control-allow-origin" not in response.headers
    engine.dispose.assert_called_once()


def test_initial_migration_renders_postgres_upgrade_and_downgrade():
    output = StringIO()
    config = Config(str(API_ROOT / "alembic.ini"), output_buffer=output)
    command.upgrade(config, "head", sql=True)
    sql = output.getvalue()
    for table in Base.metadata.tables:
        assert f"CREATE TABLE {table} (" in sql
    assert "JSONB" in sql
    assert "TIMESTAMP WITH TIME ZONE" in sql
    assert "UNIQUE (campaign_lead_id, step_id)" in sql
    assert "UNIQUE (idempotency_key)" in sql
    assert "FOREIGN KEY(workspace_id, company_id)" in sql
    assert "CREATE INDEX ix_jobs_due" in sql
    assert "CREATE INDEX ix_campaign_leads_due" in sql
    output.seek(0)
    output.truncate()
    command.downgrade(config, "0001_initial:base", sql=True)
    for table in Base.metadata.tables:
        assert f"DROP TABLE {table};" in output.getvalue()

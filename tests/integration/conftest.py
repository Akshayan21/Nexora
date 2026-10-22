from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest
from app.config import Settings, get_settings
from app.database import build_engine, get_session
from app.main import create_app
from app.models import User, Workspace, WorkspaceMember
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


@pytest.fixture
def api():
    settings = Settings(database_url=get_settings().database_url, auth_secret="test-secret-" * 5)
    engine = build_engine(settings)
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
    )
    user = User(auth_subject=f"test:{uuid4()}", email="test@example.invalid")
    workspace = Workspace(name="API test workspace")
    other = Workspace(name="Other isolated workspace")
    session.add_all([user, workspace, other])
    session.flush()
    session.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role="owner"))
    session.commit()
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": str(user.id),
            "exp": now + timedelta(minutes=5),
            "iat": now,
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
        },
        settings.auth_secret.get_secret_value(),
        algorithm="HS256",
    )
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": str(workspace.id)}
    app = create_app(settings)
    app.dependency_overrides[get_session] = lambda: session
    try:
        with TestClient(app) as client:
            yield client, headers, session, other.id
    finally:
        session.close()
        transaction.rollback()
        connection.close()
        engine.dispose()

from dataclasses import dataclass
from uuid import UUID

import jwt
from fastapi import Depends, Header, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_session
from app.models import User, WorkspaceMember

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    user_id: UUID
    workspace_id: UUID
    role: str


def current_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    workspace_id: UUID = Header(alias="X-Workspace-ID"),
    session: Session = Depends(get_session),
) -> Principal:
    if not credentials:
        raise HTTPException(401, "Bearer token required", headers={"WWW-Authenticate": "Bearer"})
    settings = request.app.state.settings
    if not settings.auth_secret or len(settings.auth_secret.get_secret_value()) < 32:
        raise HTTPException(503, "API authentication is not configured")
    try:
        claims = jwt.decode(
            credentials.credentials,
            settings.auth_secret.get_secret_value(),
            algorithms=["HS256"],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
            options={"require": ["sub", "exp", "iat", "iss", "aud"]},
        )
        user_id = UUID(claims["sub"])
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise HTTPException(
            401, "Invalid or expired token", headers={"WWW-Authenticate": "Bearer"}
        ) from None
    if session.get(User, user_id) is None:
        raise HTTPException(401, "User is unavailable")
    membership = session.get(WorkspaceMember, (workspace_id, user_id))
    if membership is None:
        raise HTTPException(403, "Workspace access denied")
    return Principal(user_id, workspace_id, membership.role)

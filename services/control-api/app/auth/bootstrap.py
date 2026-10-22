"""Create a local development owner and issue an expiring API credential."""

import argparse
import json
from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import select

from app.config import ROOT, get_settings
from app.database import build_engine, build_session_factory
from app.models import User, Workspace, WorkspaceMember


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--workspace", default="Local workspace")
    args = parser.parse_args()
    settings = get_settings()
    if not settings.auth_secret or len(settings.auth_secret.get_secret_value()) < 32:
        raise SystemExit("Configure AUTH_SECRET with at least 32 characters first.")
    engine = build_engine(settings)
    try:
        with build_session_factory(engine)() as session:
            subject = "local:" + args.email.strip().lower()
            user = session.scalar(select(User).where(User.auth_subject == subject))
            if user is None:
                user = User(auth_subject=subject, email=args.email.strip().lower())
                session.add(user)
                session.flush()
            membership = session.scalar(
                select(WorkspaceMember)
                .where(WorkspaceMember.user_id == user.id, WorkspaceMember.role == "owner")
                .order_by(WorkspaceMember.workspace_id)
            )
            if membership is None:
                workspace = Workspace(name=args.workspace)
                session.add(workspace)
                session.flush()
                membership = WorkspaceMember(
                    workspace_id=workspace.id, user_id=user.id, role="owner"
                )
                session.add(membership)
            session.commit()
            now = datetime.now(UTC)
            expires = now + timedelta(hours=8)
            token = jwt.encode(
                {
                    "sub": str(user.id),
                    "iss": settings.jwt_issuer,
                    "aud": settings.jwt_audience,
                    "iat": now,
                    "exp": expires,
                },
                settings.auth_secret.get_secret_value(),
                algorithm="HS256",
            )
            folder = ROOT / ".secrets"
            folder.mkdir(exist_ok=True)
            path = folder / "local-api.json"
            path.write_text(
                json.dumps(
                    {
                        "workspace_id": str(membership.workspace_id),
                        "access_token": token,
                        "expires_at": expires.isoformat(),
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            web_env = ROOT / "apps" / "web" / ".env.local"
            values = {
                "OUTREACH_API_TOKEN": token,
                "OUTREACH_WORKSPACE_ID": str(membership.workspace_id),
                "OUTREACH_TOKEN_EXPIRES_AT": expires.isoformat(),
            }
            lines = web_env.read_text(encoding="utf-8").splitlines() if web_env.exists() else []
            lines = [line for line in lines if line.split("=", 1)[0] not in values]
            lines.extend(f"{key}={value}" for key, value in values.items())
            web_env.write_text("\n".join(lines) + "\n", encoding="utf-8")
            print(f"Local owner ready. Credential saved to {path}. Expires in 8 hours.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()

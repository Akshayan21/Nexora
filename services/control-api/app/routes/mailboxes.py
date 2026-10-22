"""Workspace-scoped Gmail OAuth. No message sending is performed here."""
import base64
import hashlib
import json
import secrets
from urllib.parse import urlencode, urlsplit

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import Principal, current_principal
from app.database import get_session
from app.models import AuditEvent, Mailbox, WorkspaceMember

router = APIRouter(prefix="/mailboxes", tags=["mailboxes"])
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def cipher(settings):
    try:
        return Fernet(settings.token_encryption_key.get_secret_value().encode())
    except (AttributeError, ValueError):
        raise HTTPException(503, "Set TOKEN_ENCRYPTION_KEY to a valid Fernet key") from None


def configured(settings):
    cipher(settings)
    if (not settings.google_client_id or settings.google_client_id == "CHANGE_ME"
            or not settings.google_client_secret
            or settings.google_client_secret.get_secret_value() in ("", "CHANGE_ME")):
        raise HTTPException(503, "Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env")
    uri = urlsplit(settings.google_redirect_uri)
    if uri.path != "/api/mailboxes/google/callback" or uri.query or uri.fragment:
        raise HTTPException(503, "GOOGLE_REDIRECT_URI must point to the dashboard Gmail callback")
    if uri.scheme != "https" and not (
        uri.scheme == "http" and uri.hostname in ("localhost", "127.0.0.1")
    ):
        raise HTTPException(503, "Google redirect URI must use HTTPS or localhost")


def mailbox_query(principal):
    return select(Mailbox).where(Mailbox.workspace_id == principal.workspace_id)


@router.get("")
def status(request: Request, principal: Principal = Depends(current_principal),
           session: Session = Depends(get_session)):
    setup_error = None
    try:
        configured(request.app.state.settings)
    except HTTPException as exc:
        setup_error = exc.detail
    rows = session.scalars(mailbox_query(principal).order_by(Mailbox.created_at)).all()
    return {"configured": setup_error is None, "setup_error": setup_error,
            "mailboxes": [{"id": str(m.id), "address": m.address, "state": m.state}
                          for m in rows]}


@router.post("/google/start")
def start(request: Request, response: Response,
          principal: Principal = Depends(current_principal)):
    settings = request.app.state.settings
    configured(settings)
    redirect = urlsplit(settings.google_redirect_uri)
    dashboard_origin = request.headers.get("X-Dashboard-Origin")
    expected_origin = f"{redirect.scheme}://{redirect.netloc}"
    if dashboard_origin and dashboard_origin != expected_origin:
        raise HTTPException(409, f"Open the dashboard at {expected_origin}/settings to connect Gmail")
    nonce, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(64)
    payload = {"state": nonce, "verifier": verifier, "user": str(principal.user_id),
               "workspace": str(principal.workspace_id)}
    response.set_cookie("gmail_oauth", cipher(settings).encrypt(json.dumps(payload).encode()).decode(),
                        max_age=600, httponly=True, samesite="lax", path="/api/mailboxes",
                        secure=settings.google_redirect_uri.startswith("https://"))
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=")
    return {"url": "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode({
        "client_id": settings.google_client_id, "redirect_uri": settings.google_redirect_uri,
        "response_type": "code", "scope": " ".join(SCOPES), "state": nonce,
        "access_type": "offline", "prompt": "consent select_account",
        "code_challenge": challenge.decode(), "code_challenge_method": "S256",
    })}


class Completion(BaseModel):
    state: str
    code: str = ""
    error: str = ""


def validate_state(settings, cookie, body, principal):
    try:
        data = json.loads(cipher(settings).decrypt((cookie or "").encode(), ttl=600))
        if (not secrets.compare_digest(data["state"], body.state)
                or data["user"] != str(principal.user_id)
                or data["workspace"] != str(principal.workspace_id)):
            raise ValueError
        return data
    except (InvalidToken, ValueError, KeyError, TypeError):
        raise HTTPException(400, "Gmail sign-in expired or invalid. Please connect again.") from None


@router.post("/google/complete")
def complete(body: Completion, request: Request,
             principal: Principal = Depends(current_principal),
             session: Session = Depends(get_session)):
    settings = request.app.state.settings
    configured(settings)
    data = validate_state(settings, request.cookies.get("gmail_oauth"), body, principal)
    if body.error or not body.code:
        raise HTTPException(400, "Gmail permission was not granted. Please connect again.")
    try:
        with httpx.Client(timeout=15) as client:
            token_response = client.post("https://oauth2.googleapis.com/token", data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret.get_secret_value(),
                "redirect_uri": settings.google_redirect_uri, "code": body.code,
                "code_verifier": data["verifier"], "grant_type": "authorization_code",
            })
            token_response.raise_for_status()
            tokens = token_response.json()
            if not set(SCOPES).issubset(set(tokens.get("scope", "").split())):
                raise ValueError
            if not tokens.get("refresh_token"):
                raise ValueError
            profile_response = client.get("https://gmail.googleapis.com/gmail/v1/users/me/profile",
                                          headers={"Authorization": f"Bearer {tokens['access_token']}"})
            profile_response.raise_for_status()
            address = profile_response.json()["emailAddress"].strip().lower()
            if "@" not in address or len(address) > 320:
                raise ValueError
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        raise HTTPException(502, "Google could not complete the Gmail connection. Please try again.") from None
    # Serialize connects within a workspace to avoid duplicate mailbox inserts.
    session.scalar(select(WorkspaceMember).where(
        WorkspaceMember.workspace_id == principal.workspace_id,
        WorkspaceMember.user_id == principal.user_id).with_for_update())
    mailbox = session.scalar(mailbox_query(principal).where(Mailbox.address == address))
    if mailbox is None:
        mailbox = Mailbox(workspace_id=principal.workspace_id, address=address, provider="gmail")
        session.add(mailbox)
    mailbox.encrypted_credential_ref = cipher(settings).encrypt(json.dumps(tokens).encode()).decode()
    mailbox.state = "active"
    session.add(AuditEvent(workspace_id=principal.workspace_id, actor_id=principal.user_id,
                           action="mailbox.connected", metadata_json={"address": address}))
    session.commit()
    return {"connected": True}


@router.post("/{mailbox_id}/disconnect")
def disconnect(mailbox_id: str, request: Request, principal: Principal = Depends(current_principal),
               session: Session = Depends(get_session)):
    from uuid import UUID
    try:
        identifier = UUID(mailbox_id)
    except ValueError:
        raise HTTPException(404, "Mailbox not found") from None
    mailbox = session.scalar(mailbox_query(principal).where(Mailbox.id == identifier).with_for_update())
    if mailbox is None:
        raise HTTPException(404, "Mailbox not found")
    if mailbox.encrypted_credential_ref:
        try:
            tokens = json.loads(cipher(request.app.state.settings).decrypt(
                mailbox.encrypted_credential_ref.encode()))
            with httpx.Client(timeout=10) as client:
                result = client.post("https://oauth2.googleapis.com/revoke",
                                     data={"token": tokens["refresh_token"]})
                if result.status_code not in (200, 400):
                    raise ValueError
        except (InvalidToken, httpx.HTTPError, ValueError, KeyError):
            raise HTTPException(502, "Could not revoke Gmail access. Try again or revoke it in your Google Account.") from None
    mailbox.encrypted_credential_ref = None
    mailbox.state = "disconnected"
    session.add(AuditEvent(workspace_id=principal.workspace_id, actor_id=principal.user_id,
                           action="mailbox.disconnected", metadata_json={"address": mailbox.address}))
    session.commit()
    return {"disconnected": True}

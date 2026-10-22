import json
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from app.models import Mailbox
from app.routes import mailboxes
from cryptography.fernet import Fernet
from pydantic import SecretStr
from sqlalchemy import select


@pytest.fixture
def gmail(api, monkeypatch):
    client, headers, session, other = api
    settings = client.app.state.settings
    settings.google_client_id = "test-client"
    settings.google_client_secret = SecretStr("test-secret")
    settings.google_redirect_uri = "http://localhost:3000/api/mailboxes/google/callback"
    settings.token_encryption_key = SecretStr(Fernet.generate_key().decode())
    requests = []

    def handle(request):
        requests.append(request)
        if request.url.path == "/token":
            return httpx.Response(200, json={"access_token": "private-access", "refresh_token":
                                           "private-refresh", "scope": " ".join(mailboxes.SCOPES)})
        if request.url.path.endswith("/profile"):
            return httpx.Response(200, json={"emailAddress": "owner@gmail.com"})
        return httpx.Response(200)

    transport = httpx.MockTransport(handle)
    original = httpx.Client
    monkeypatch.setattr(mailboxes, "httpx", SimpleNamespace(
        Client=lambda **kwargs: original(transport=transport, **kwargs), HTTPError=httpx.HTTPError))
    return client, headers, session, other, requests


def begin(client, headers):
    response = client.post("/api/v1/mailboxes/google/start", headers=headers)
    assert response.status_code == 200
    query = parse_qs(urlsplit(response.json()["url"]).query)
    assert query["code_challenge_method"] == ["S256"]
    assert "HttpOnly" in response.headers["set-cookie"]
    cookie = client.cookies.get("gmail_oauth")
    client.cookies.clear()
    client.cookies.set("gmail_oauth", cookie, path="/")
    return query["state"][0]


def test_connect_encrypt_status_disconnect(gmail):
    client, headers, session, _, requests = gmail
    state = begin(client, headers)
    result = client.post("/api/v1/mailboxes/google/complete", headers=headers,
                         json={"state": state, "code": "test-code"})
    assert result.status_code == 200
    row = session.scalar(select(Mailbox).where(Mailbox.address == "owner@gmail.com"))
    assert row.state == "active"
    assert "private-refresh" not in row.encrypted_credential_ref
    tokens = json.loads(mailboxes.cipher(client.app.state.settings).decrypt(
        row.encrypted_credential_ref.encode()))
    assert tokens["refresh_token"] == "private-refresh"
    status = client.get("/api/v1/mailboxes", headers=headers)
    assert status.json()["mailboxes"][0]["address"] == "owner@gmail.com"
    assert "private-access" not in status.text
    result = client.post(f"/api/v1/mailboxes/{row.id}/disconnect", headers=headers)
    assert result.status_code == 200
    assert row.encrypted_credential_ref is None
    assert row.state == "disconnected"
    assert requests[-1].url.path == "/revoke"


def test_state_and_cookie_required(gmail):
    client, headers, _, _, requests = gmail
    state = begin(client, headers)
    assert client.post("/api/v1/mailboxes/google/complete", headers=headers,
                       json={"state": "wrong", "code": "code"}).status_code == 400
    client.cookies.clear()
    assert client.post("/api/v1/mailboxes/google/complete", headers=headers,
                       json={"state": state, "code": "code"}).status_code == 400
    assert not requests


def test_cancel_and_authentication(gmail):
    client, headers, _, other, requests = gmail
    state = begin(client, headers)
    assert client.post("/api/v1/mailboxes/google/complete", headers=headers,
                       json={"state": state, "error": "access_denied"}).status_code == 400
    assert client.get("/api/v1/mailboxes", headers={"X-Workspace-ID": str(other)}).status_code == 401
    assert client.get("/api/v1/mailboxes", headers={**headers, "X-Workspace-ID": str(other)}).status_code == 403
    assert not requests


def test_invalid_encryption_configuration(gmail):
    client, headers, _, _, _ = gmail
    client.app.state.settings.token_encryption_key = SecretStr("CHANGE_ME")
    assert client.get("/api/v1/mailboxes", headers=headers).json()["configured"] is False
    assert client.post("/api/v1/mailboxes/google/start", headers=headers).status_code == 503


def test_callback_host_must_match_dashboard(gmail):
    client, headers, _, _, requests = gmail
    result = client.post("/api/v1/mailboxes/google/start", headers={
        **headers, "X-Dashboard-Origin": "http://127.0.0.1:3000"})
    assert result.status_code == 409
    assert "http://localhost:3000/settings" in result.json()["detail"]
    assert not requests


def test_google_failure_does_not_save_credentials(gmail, monkeypatch):
    client, headers, session, _, _ = gmail
    state = begin(client, headers)
    original = httpx.Client
    transport = httpx.MockTransport(lambda request: httpx.Response(400, json={
        "error": "invalid_grant", "error_description": "private-provider-detail"}))
    monkeypatch.setattr(mailboxes, "httpx", SimpleNamespace(
        Client=lambda **kwargs: original(transport=transport, **kwargs), HTTPError=httpx.HTTPError))
    response = client.post("/api/v1/mailboxes/google/complete", headers=headers,
                           json={"state": state, "code": "test-code"})
    assert response.status_code == 502
    assert "private-provider-detail" not in response.text
    assert session.scalar(select(Mailbox).where(Mailbox.workspace_id == headers["X-Workspace-ID"])) is None

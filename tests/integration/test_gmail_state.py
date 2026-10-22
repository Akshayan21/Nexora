import json
import time
from uuid import uuid4

import pytest
from app.auth.dependencies import Principal
from app.config import Settings
from app.routes.mailboxes import Completion, cipher, validate_state
from cryptography.fernet import Fernet
from fastapi import HTTPException


def test_expired_and_cross_workspace_state():
    settings = Settings(database_url="postgresql+psycopg://test@localhost/test",
                        token_encryption_key=Fernet.generate_key().decode())
    principal = Principal(uuid4(), uuid4(), "owner")
    payload = json.dumps({"state": "nonce", "user": str(principal.user_id),
                          "workspace": str(principal.workspace_id), "verifier": "secret"}).encode()
    expired = cipher(settings).encrypt_at_time(payload, int(time.time()) - 601).decode()
    body = Completion(state="nonce", code="code")
    with pytest.raises(HTTPException) as error:
        validate_state(settings, expired, body, principal)
    assert error.value.status_code == 400
    cookie = cipher(settings).encrypt(payload).decode()
    assert validate_state(settings, cookie, body, principal)["verifier"] == "secret"
    with pytest.raises(HTTPException):
        validate_state(settings, cookie, body, Principal(principal.user_id, uuid4(), "owner"))
    with pytest.raises(HTTPException):
        validate_state(settings, cookie, body, Principal(uuid4(), principal.workspace_id, "owner"))

from app.models import AuditEvent, Contact, SuppressionEntry
from sqlalchemy import func, select


def payload(evidence=True):
    return {
        "name": "Test Founder",
        "title": "Founder",
        "email": "Founder@Example.invalid",
        "company_name": "Test Company",
        "company_domain": "example.invalid",
        "evidence": [
            {
                "field_name": "title",
                "field_value": "Founder",
                "source_url": "https://example.invalid/team",
                "confidence": 0.8,
                "observed_at": "2026-10-22T10:00:00Z",
            }
        ]
        if evidence
        else [],
    }


def create(client, headers, key, evidence=True):
    return client.post(
        "/api/v1/leads", headers={**headers, "Idempotency-Key": key}, json=payload(evidence)
    )


def test_auth_and_tenant_isolation(api):
    client, headers, session, other_id = api
    assert (
        client.get(
            "/api/v1/leads", headers={"X-Workspace-ID": headers["X-Workspace-ID"]}
        ).status_code
        == 401
    )
    assert (
        client.get(
            "/api/v1/leads", headers={**headers, "Authorization": "Bearer invalid"}
        ).status_code
        == 401
    )
    assert (
        client.get(
            "/api/v1/leads", headers={**headers, "X-Workspace-ID": str(other_id)}
        ).status_code
        == 403
    )
    foreign = Contact(workspace_id=other_id, name="Private person", email_status="unknown")
    session.add(foreign)
    session.commit()
    assert client.get(f"/api/v1/leads/{foreign.id}", headers=headers).status_code == 404
    assert (
        client.post(
            "/api/v1/leads/approve", headers=headers, json={"contact_ids": [str(foreign.id)]}
        ).status_code
        == 404
    )
    assert client.get("/api/v1/leads", headers=headers).json()["total"] == 0


def test_creation_retries_search_evidence_and_approval(api):
    client, headers, session, _ = api
    response = create(client, headers, "retry-test")
    assert response.status_code == 201, response.text
    lead = response.json()
    assert lead["email"] == "founder@example.invalid"
    assert lead["email_status"] == "unknown"
    assert len(lead["evidence"]) == 1
    assert create(client, headers, "retry-test").json()["id"] == lead["id"]
    changed = payload()
    changed["name"] = "A different person"
    assert (
        client.post(
            "/api/v1/leads", headers={**headers, "Idempotency-Key": "retry-test"}, json=changed
        ).status_code
        == 409
    )
    listed = client.get(
        "/api/v1/leads", params={"query": "Test Company", "limit": 1}, headers=headers
    ).json()
    assert listed["total"] == 1
    assert client.get("/api/v1/leads/summary", headers=headers).json() == {
        "total": 1,
        "approved": 0,
        "needs_review": 1,
    }
    assert listed["items"][0]["id"] == lead["id"]
    assert client.get("/api/v1/leads", params={"query": "%"}, headers=headers).json()["total"] == 0
    body = {"contact_ids": [lead["id"]]}
    assert (
        client.post("/api/v1/leads/approve", headers=headers, json=body).json()["changed_count"]
        == 1
    )
    assert (
        client.post("/api/v1/leads/approve", headers=headers, json=body).json()["changed_count"]
        == 0
    )
    assert client.get(f"/api/v1/leads/{lead['id']}", headers=headers).json()["status"] == "approved"
    assert (
        client.get("/api/v1/leads", params={"status": "needs_review"}, headers=headers).json()[
            "total"
        ]
        == 0
    )
    assert (
        session.scalar(
            select(func.count())
            .select_from(AuditEvent)
            .where(
                AuditEvent.workspace_id == headers["X-Workspace-ID"],
                AuditEvent.action == "lead.approved",
            )
        )
        == 1
    )


def test_approval_guardrails_are_atomic(api):
    client, headers, session, _ = api
    good = create(client, headers, "good").json()["id"]
    missing = create(client, headers, "without-evidence", False).json()["id"]
    response = client.post(
        "/api/v1/leads/approve", headers=headers, json={"contact_ids": [good, missing]}
    )
    assert response.status_code == 409
    assert client.get(f"/api/v1/leads/{good}", headers=headers).json()["approved_at"] is None
    session.add(
        SuppressionEntry(
            workspace_id=headers["X-Workspace-ID"],
            normalized_email="founder@example.invalid",
            reason="unsubscribe",
        )
    )
    session.commit()
    assert (
        client.post(
            "/api/v1/leads/approve", headers=headers, json={"contact_ids": [good]}
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/api/v1/leads/approve", headers=headers, json={"contact_ids": [good, good]}
        ).status_code
        == 422
    )


def test_input_validation_and_pagination(api):
    client, headers, _, _ = api
    assert client.get("/api/v1/leads?limit=101", headers=headers).status_code == 422
    bad = payload()
    bad["evidence"][0]["source_url"] = "javascript:alert(1)"
    assert (
        client.post(
            "/api/v1/leads", headers={**headers, "Idempotency-Key": "bad"}, json=bad
        ).status_code
        == 422
    )

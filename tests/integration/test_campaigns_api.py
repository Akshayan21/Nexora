from uuid import UUID

from app.models import Campaign, SuppressionEntry
from sqlalchemy import select
from test_leads_api import create


def draft(contact_ids=None):
    return {
        "name": "Founder introductions",
        "audience": "B2B software founders",
        "objective": "Offer a short product consultation",
        "contact_ids": contact_ids or [],
        "steps": [
            {
                "subject": "A relevant introduction",
                "body": "Hello, here is a brief introduction.",
                "delay_days": 0,
            },
            {
                "subject": "Following up",
                "body": "One final note. Reply if this is relevant.",
                "delay_days": 3,
            },
        ],
        "schedule": {
            "timezone": "Asia/Kolkata",
            "daily_limit": 5,
            "weekdays": [0, 1, 2, 3, 4],
            "window_start": "09:00",
            "window_end": "17:00",
        },
    }


def test_campaign_create_retry_open_edit_and_version_conflict(api):
    client, headers, _session, _ = api
    payload = draft()
    response = client.post(
        "/api/v1/campaigns", headers={**headers, "Idempotency-Key": "campaign-retry"}, json=payload
    )
    assert response.status_code == 201, response.text
    campaign = response.json()
    assert campaign["state"] == "draft"
    assert campaign["sending_enabled"] is False
    assert len(campaign["steps"]) == 2
    assert campaign["schedule"]["daily_limit"] == 5
    assert (
        client.post(
            "/api/v1/campaigns",
            headers={**headers, "Idempotency-Key": "campaign-retry"},
            json=payload,
        ).json()["id"]
        == campaign["id"]
    )
    changed = {**payload, "name": "Changed name"}
    assert (
        client.post(
            "/api/v1/campaigns",
            headers={**headers, "Idempotency-Key": "campaign-retry"},
            json=changed,
        ).status_code
        == 409
    )
    edit = {**payload, "name": "Edited campaign", "expected_version": 1}
    edit["steps"][1]["body"] = "Updated follow-up message"
    updated = client.put(f"/api/v1/campaigns/{campaign['id']}", headers=headers, json=edit)
    assert updated.status_code == 200, updated.text
    assert updated.json()["version"] == 2
    assert updated.json()["steps"][1]["body"] == "Updated follow-up message"
    assert len(updated.json()["activity"]) == 2
    assert (
        client.put(f"/api/v1/campaigns/{campaign['id']}", headers=headers, json=edit).status_code
        == 409
    )
    assert (
        client.get(f"/api/v1/campaigns/{campaign['id']}", headers=headers).json()["name"]
        == "Edited campaign"
    )
    assert client.get("/api/v1/campaigns", headers=headers).json()["total"] == 1


def test_campaign_recipient_safety_and_tenant_isolation(api):
    client, headers, session, other_id = api
    lead = create(client, headers, "campaign-contact").json()["id"]
    assert (
        client.post(
            "/api/v1/campaigns",
            headers={**headers, "Idempotency-Key": "unapproved"},
            json=draft([lead]),
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/api/v1/leads/approve", headers=headers, json={"contact_ids": [lead]}
        ).status_code
        == 200
    )
    response = client.post(
        "/api/v1/campaigns", headers={**headers, "Idempotency-Key": "approved"}, json=draft([lead])
    )
    assert response.status_code == 201, response.text
    assert response.json()["recipients"][0]["id"] == lead
    foreign = Campaign(
        workspace_id=other_id,
        name="Private",
        audience="Private",
        objective="Private",
        settings_json={},
    )
    session.add(foreign)
    session.commit()
    assert client.get(f"/api/v1/campaigns/{foreign.id}", headers=headers).status_code == 404
    assert (
        client.put(
            f"/api/v1/campaigns/{foreign.id}",
            headers=headers,
            json={**draft(), "expected_version": 1},
        ).status_code
        == 404
    )
    session.add(
        SuppressionEntry(
            workspace_id=UUID(headers["X-Workspace-ID"]),
            normalized_email="founder@example.invalid",
            reason="unsubscribe",
        )
    )
    session.commit()
    assert (
        client.post(
            "/api/v1/campaigns",
            headers={**headers, "Idempotency-Key": "suppressed"},
            json=draft([lead]),
        ).status_code
        == 409
    )
    saved = session.scalar(select(Campaign).where(Campaign.id == UUID(response.json()["id"])))
    saved.state = "active"
    session.commit()
    assert (
        client.put(
            f"/api/v1/campaigns/{saved.id}",
            headers=headers,
            json={**draft(), "expected_version": 1},
        ).status_code
        == 409
    )


def test_campaign_invalid_sequence_and_schedule(api):
    client, headers, _, _ = api
    invalid = draft()
    invalid["schedule"]["window_end"] = "08:00"
    assert (
        client.post(
            "/api/v1/campaigns", headers={**headers, "Idempotency-Key": "bad-window"}, json=invalid
        ).status_code
        == 422
    )
    invalid = draft()
    invalid["steps"][1]["delay_days"] = 0
    assert (
        client.post(
            "/api/v1/campaigns", headers={**headers, "Idempotency-Key": "bad-delay"}, json=invalid
        ).status_code
        == 422
    )
    invalid = draft()
    invalid["schedule"]["timezone"] = "Not/AZone"
    assert (
        client.post(
            "/api/v1/campaigns",
            headers={**headers, "Idempotency-Key": "bad-timezone"},
            json=invalid,
        ).status_code
        == 422
    )

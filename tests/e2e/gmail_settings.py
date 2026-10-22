"""Exercise Gmail settings with mocked API responses; never contacts Google."""
import json

from playwright.sync_api import expect, sync_playwright


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.add_init_script("localStorage.setItem('outreach-data-source', 'api')")
    state = {"configured": True, "setup_error": None, "mailboxes": []}
    calls = []

    def mailbox_api(route):
        calls.append(route.request.url)
        if route.request.url.endswith("/disconnect"):
            state["mailboxes"] = []
            route.fulfill(json={"disconnected": True})
        elif route.request.url.endswith("/start"):
            route.fulfill(status=503, json={"detail": "Google setup required"})
        else:
            route.fulfill(body=json.dumps(state), content_type="application/json")

    page.route("**/api/mailboxes**", mailbox_api)
    page.goto("http://localhost:3000/settings", wait_until="networkidle")
    section = page.get_by_role("region", name="Gmail connection", exact=True)
    expect(section.get_by_role("button", name="Connect Gmail", exact=True)).to_be_enabled()
    section.get_by_role("button", name="Connect Gmail", exact=True).click()
    expect(section.get_by_role("alert")).to_have_text("Google setup required")
    state["mailboxes"] = [{"id": "test-mailbox", "address": "test@gmail.com", "state": "active"}]
    page.goto("http://localhost:3000/settings?gmail=connected", wait_until="networkidle")
    expect(section.get_by_text("test@gmail.com", exact=True)).to_be_visible()
    expect(section.get_by_text("Gmail connected successfully.", exact=True)).to_be_visible()
    section.get_by_role("button", name="Disconnect", exact=True).click()
    expect(section.get_by_text("Gmail disconnected and access revoked.", exact=True)).to_be_visible()
    expect(section.get_by_role("button", name="Connect Gmail", exact=True)).to_be_enabled()
    page.set_viewport_size({"width": 390, "height": 844})
    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
    state["configured"] = False
    state["setup_error"] = "Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env"
    page.reload(wait_until="networkidle")
    expect(section.get_by_role("button", name="Connect Gmail", exact=True)).to_be_disabled()
    expect(section.get_by_text(state["setup_error"], exact=True)).to_be_visible()
    assert any(url.endswith("/start") for url in calls)
    assert any(url.endswith("/disconnect") for url in calls)
    browser.close()
    print("PASS: Gmail settings setup, status, connection errors, callback feedback, disconnect, mobile layout.")

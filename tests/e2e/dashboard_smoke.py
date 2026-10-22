"""Run with the local worker's Python while Next.js runs on localhost:3000."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)

def visit(page, url):
    # Provider effects fetch campaigns only after the client has hydrated.
    with page.expect_response(lambda r: "/api/campaigns?limit=" in r.url) as ready:
        page.goto(url, wait_until="load")
    ready.value.json()

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = context.new_page()
    page.set_default_timeout(15000)
    page.set_default_navigation_timeout(20000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    visit(page, "http://localhost:3000/overview")
    expect(page.get_by_role("heading", level=1)).to_have_text("Overview")
    page.screenshot(path=str(ARTIFACTS / "dashboard-desktop.png"), full_page=True)
    page.get_by_role("link", name="New campaign", exact=True).click()
    expect(page.get_by_role("heading", name="New campaign", exact=True)).to_be_visible()
    visit(page, "http://localhost:3000/campaigns")
    expect(page.get_by_role("heading", name="Campaigns", exact=True)).to_be_visible()
    visit(page, "http://localhost:3000/leads")
    expect(page.get_by_role("button", name="Add lead", exact=True)).to_be_visible()
    page.get_by_label("Search people or companies").fill("no-such-contact-in-database")
    expect(page.locator("tbody tr")).to_have_count(0)
    visit(page, "http://localhost:3000/discover")
    page.get_by_role("button", name="Use an example").click()
    page.get_by_role("button", name="Save research brief").click()
    expect(page.get_by_role("status")).to_contain_text("Research brief saved")
    expect(page.get_by_role("heading", name="Saved research briefs")).to_be_visible()
    visit(page, "http://localhost:3000/inbox")
    page.get_by_label("Your reply").fill("Thanks, Lana. I will share a short overview.")
    page.get_by_role("button", name="Save reply draft").click()
    expect(page.get_by_role("status")).to_contain_text("Thanks, Lana")
    visit(page, "http://localhost:3000/settings")
    page.get_by_label("Daily email limit").fill("5")
    page.get_by_role("button", name="Save demo preferences").click()
    expect(page.get_by_role("status")).to_contain_text("Preferences saved")
    page.reload()
    expect(page.get_by_label("Daily email limit")).to_have_value("5")
    visit(page, "http://localhost:3000/analytics")
    page.wait_for_load_state("networkidle")
    page.get_by_label("Analytics date range").select_option("30")
    expect(page.get_by_role("img", name="Sample email activity over the last 30 days")).to_be_visible()
    for route in ["overview", "discover", "leads", "campaigns", "inbox", "analytics", "settings"]:
        visit(page, f"http://localhost:3000/{route}")
        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), route
    mobile = context.new_page()
    mobile.set_viewport_size({"width": 390, "height": 844})
    mobile.on("pageerror", lambda error: errors.append(str(error)))
    for route in ["overview", "discover", "leads", "campaigns", "inbox", "analytics", "settings"]:
        visit(mobile, f"http://localhost:3000/{route}")
        assert not mobile.evaluate("document.documentElement.scrollWidth > innerWidth"), f"mobile {route}"
    visit(mobile, "http://localhost:3000/overview")
    mobile.screenshot(path=str(ARTIFACTS / "dashboard-mobile.png"), full_page=True)
    mobile.get_by_role("button", name="Open navigation").click()
    mobile.get_by_role("link", name="Discover", exact=True).click()
    expect(mobile.get_by_role("heading", level=1)).to_have_text("Discover leads")
    assert not errors, errors
    print("PASS: all seven routes; drafts, database lead access, filtering, discovery briefs, replies, preferences, chart ranges, mobile navigation, and no browser errors or horizontal overflow.")
    browser.close()

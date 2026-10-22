"""Browser-to-PostgreSQL lead test. Removes only its own uniquely named fixture."""
import subprocess
from pathlib import Path
from uuid import uuid4
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[2]
name="Integration Lead "+uuid4().hex[:8]
domain="integration-"+uuid4().hex+".invalid"
created=None
try:
    with sync_playwright() as p:
        browser=p.chromium.launch()
        page=browser.new_page(viewport={"width":1440,"height":1000})
        errors=[]
        requests=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.on("request",lambda r:requests.append(r) if "/api/leads" in r.url else None)
        page.goto("http://localhost:3000/leads",wait_until="networkidle")
        page.evaluate("localStorage.setItem('outreach-workspace-demo-v1',JSON.stringify({leads:[{id:'fake',name:'Old fictional lead'}],campaigns:[],paused:false,dailyLimit:10,searches:[],replies:{}}))")
        page.reload(wait_until="networkidle")
        expect(page.get_by_text("Old fictional lead")).to_have_count(0)
        page.get_by_role("button",name="Add lead",exact=True).click()
        page.get_by_label("Full name",exact=True).fill(name)
        page.get_by_label("Role",exact=True).fill("Founder")
        page.get_by_label("Company",exact=True).fill("Integration fixture")
        page.get_by_label("Company domain",exact=True).fill(domain)
        page.get_by_label("Public source URL",exact=False).fill("https://"+domain+"/team")
        with page.expect_response(lambda r:r.url.endswith("/api/leads") and r.request.method=="POST") as response:
            page.get_by_role("button",name="Save lead",exact=True).click()
        result=response.value
        assert result.status==201,result.text()
        created=result.json()["id"]
        expect(page.get_by_role("dialog")).to_have_count(0)
        page.get_by_label("Search people or companies").fill(name)
        expect(page.locator("tbody tr")).to_have_count(1)
        page.get_by_role("button",name="View "+name,exact=True).click()
        expect(page.get_by_role("link",name="https://"+domain+"/team",exact=True)).to_be_visible()
        page.get_by_role("button",name="Approve lead",exact=True).click()
        expect(page.locator(".profile-approval strong")).to_have_text("Approved")
        page.get_by_role("button",name="Close",exact=True).click()
        page.reload(wait_until="networkidle")
        page.get_by_label("Search people or companies").fill(name)
        expect(page.locator("tbody tr")).to_contain_text("Approved")
        page.goto("http://localhost:3000/overview",wait_until="networkidle")
        page.get_by_role("tab",name="Approved").click()
        expect(page.locator(".desk-leads")).to_contain_text(name)
        assert not any("authorization" in r.headers or "x-workspace-id" in r.headers for r in requests)
        leak=page.evaluate("Object.values(localStorage).join(' ')")
        assert "access_token" not in leak
        for route in ["leads","overview"]:
            page.set_viewport_size({"width":390,"height":844})
            page.goto("http://localhost:3000/"+route,wait_until="networkidle")
            assert not page.evaluate("document.documentElement.scrollWidth>innerWidth"),route
        denied=page.request.post("http://localhost:3000/api/leads/approve",headers={"Origin":"https://untrusted.invalid"},data={"contact_ids":[created]})
        assert denied.status==403
        assert not errors,errors
        browser.close()
        print("PASS: database creation, source profile, approval persistence, overview sync, old-demo rejection, credential isolation, origin checks, and mobile layout.")
finally:
    if created:
        cleanup="""import sys; from uuid import UUID; sys.path.insert(0,'services/control-api'); from app.config import get_settings; from app.database import build_engine; from app.models import AuditEvent,ContactEvidence,Contact,Company; from sqlalchemy import select,delete; engine=build_engine(get_settings()); contact_id=UUID(sys.argv[1]);
with engine.begin() as connection:
 row=connection.execute(select(Contact.company_id,Contact.workspace_id).where(Contact.id==contact_id)).first()
 if row:
  connection.execute(delete(AuditEvent).where(AuditEvent.workspace_id==row.workspace_id,AuditEvent.metadata_json['contact_id'].astext==str(contact_id)))
  connection.execute(delete(ContactEvidence).where(ContactEvidence.contact_id==contact_id,ContactEvidence.workspace_id==row.workspace_id))
  connection.execute(delete(Contact).where(Contact.id==contact_id,Contact.workspace_id==row.workspace_id))
  connection.execute(delete(Company).where(Company.id==row.company_id,~select(Contact.id).where(Contact.company_id==Company.id).exists()))
engine.dispose()
"""
        subprocess.run([str(root/'services/control-api/.venv/Scripts/python.exe'),'-c',cleanup,created],cwd=root,check=True)

"""Create, open, and edit an isolated campaign fixture through the dashboard."""
import subprocess
from pathlib import Path
from uuid import uuid4
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[2]
tag=uuid4().hex[:8]
name="Campaign integration "+tag
contact=None
campaign=None
try:
 with sync_playwright() as p:
  browser=p.chromium.launch();page=browser.new_page(viewport={"width":1440,"height":1000});errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
  page.goto("http://localhost:3000/campaigns",wait_until="networkidle")
  response=page.request.post("http://localhost:3000/api/leads",headers={"Idempotency-Key":"campaign-contact-"+tag},data={"name":"Campaign Recipient "+tag,"title":"Founder","company_name":"Integration fixture","company_domain":"campaign-"+tag+".invalid","evidence":[{"field_name":"title","field_value":"Founder","source_url":"https://campaign-"+tag+".invalid/team","confidence":0.5,"observed_at":"2026-10-22T10:00:00Z"}]})
  assert response.status==201,response.text();contact=response.json()["id"]
  assert page.request.post("http://localhost:3000/api/leads/approve",data={"contact_ids":[contact]}).status==200
  page.get_by_role("link",name="New campaign",exact=True).click()
  page.get_by_label("Campaign name",exact=True).fill(name)
  page.get_by_label("Audience description",exact=True).fill("Approved B2B founders in India")
  page.get_by_label("Campaign objective",exact=True).fill("Offer a short product consultation and ask for a reply.")
  page.locator(".recipient-picker label").filter(has_text="Campaign Recipient "+tag).locator("input").check()
  page.get_by_label("Step 1 subject",exact=True).fill("A product introduction")
  page.get_by_label("Step 1 message",exact=True).fill("Hello, here is a short introduction to our work. Reply if relevant.")
  page.get_by_role("button",name="Add follow-up",exact=True).click()
  page.get_by_label("Step 2 subject",exact=True).fill("Following up on my introduction")
  page.get_by_label("Step 2 message",exact=True).fill("One final follow-up. Let me know if you would prefer no more messages.")
  page.get_by_label("Follow-up 1 delay in days").fill("4")
  page.get_by_label("Daily sending limit",exact=True).fill("5")
  page.screenshot(path=str(root/"artifacts/campaign-editor.png"),full_page=True)
  with page.expect_response(lambda r:r.url.endswith("/api/campaigns") and r.request.method=="POST") as result:
   page.get_by_role("button",name="Create draft",exact=True).click()
  response=result.value;assert response.status==201,response.text();campaign=response.json()["id"]
  expect(page).to_have_url("http://localhost:3000/campaigns/"+campaign)
  expect(page.get_by_role("heading",level=1)).to_have_text(name)
  expect(page.locator(".campaign-status-banner")).to_contain_text("Sending is off")
  page.get_by_role("tab",name="Sequence").click();expect(page.get_by_role("heading",name="Following up on my introduction")).to_be_visible()
  page.get_by_role("tab",name="Recipients").click();expect(page.locator("tbody")).to_contain_text("Campaign Recipient "+tag)
  page.get_by_role("link",name="Edit campaign",exact=True).click();expect(page.get_by_label("Campaign name",exact=True)).to_have_value(name)
  page.get_by_label("Campaign name",exact=True).fill(name+" edited")
  page.get_by_label("Step 2 message",exact=True).fill("Updated message saved to the database.")
  page.get_by_role("button",name="Save changes",exact=True).click()
  expect(page).to_have_url("http://localhost:3000/campaigns/"+campaign)
  expect(page.get_by_role("heading",level=1)).to_have_text(name+" edited")
  page.reload(wait_until="networkidle");expect(page.get_by_role("heading",level=1)).to_have_text(name+" edited")
  page.get_by_role("tab",name="Activity").click();expect(page.locator(".campaign-audit")).to_contain_text("Campaign updated")
  page.get_by_role("tab",name="Sequence").click();expect(page.locator(".sequence-detail")).to_contain_text("Updated message saved to the database.")
  page.get_by_role("tab",name="Overview",exact=True).click();page.screenshot(path=str(root/"artifacts/campaign-detail.png"),full_page=True)
  page.set_viewport_size({"width":390,"height":844})
  for route in ["/campaigns","/campaigns/"+campaign,"/campaigns/"+campaign+"/edit"]:
   page.goto("http://localhost:3000"+route,wait_until="networkidle");assert not page.evaluate("document.documentElement.scrollWidth>innerWidth"),route
  assert not errors,errors
  browser.close();print("PASS: detailed creation, approved recipients, sequence, schedule, opening, edits, persisted changes, audit history, and mobile layouts.")
finally:
 if campaign or contact:
  code="""import sys;sys.path.insert(0,'services/control-api');from uuid import UUID;from sqlalchemy import select,delete;from app.config import get_settings;from app.database import build_engine;from app.models import Campaign,CampaignLead,CampaignStep,AuditEvent,Contact,ContactEvidence,Company;engine=build_engine(get_settings());campaign_id=UUID(sys.argv[1]) if sys.argv[1] else None;contact_id=UUID(sys.argv[2]) if sys.argv[2] else None
with engine.begin() as conn:
 if campaign_id:
  conn.execute(delete(AuditEvent).where(AuditEvent.metadata_json['campaign_id'].astext==str(campaign_id)))
  conn.execute(delete(CampaignLead).where(CampaignLead.campaign_id==campaign_id))
  conn.execute(delete(CampaignStep).where(CampaignStep.campaign_id==campaign_id))
  conn.execute(delete(Campaign).where(Campaign.id==campaign_id))
 if contact_id:
  company=conn.scalar(select(Contact.company_id).where(Contact.id==contact_id))
  conn.execute(delete(AuditEvent).where(AuditEvent.metadata_json['contact_id'].astext==str(contact_id)))
  conn.execute(delete(ContactEvidence).where(ContactEvidence.contact_id==contact_id))
  conn.execute(delete(Contact).where(Contact.id==contact_id))
  if company:conn.execute(delete(Company).where(Company.id==company,~select(Contact.id).where(Contact.company_id==Company.id).exists()))
engine.dispose()
"""
  subprocess.run([str(root/"services/control-api/.venv/Scripts/python.exe"),"-c",code,campaign or "",contact or ""],cwd=root,check=True)

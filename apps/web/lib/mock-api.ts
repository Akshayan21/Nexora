import { mockLeads, mockCampaigns } from "./mock-data";
const leads = structuredClone(mockLeads);
const campaigns = structuredClone(mockCampaigns);
export async function mockRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const {pathname, searchParams: q} = new URL(url, "http://mock.local");
  const method = init?.method || "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  let result: unknown;
  if (pathname === "/api/leads/summary") result = { total: leads.length, approved: leads.filter(l => l.status === "approved").length, needs_review: leads.filter(l => l.status === "needs_review").length };
  else if (pathname === "/api/leads/approve") {
    for (const lead of leads) if (body.contact_ids.includes(lead.id)) { lead.status = "approved"; lead.approved_at = new Date().toISOString(); }
    result = {approved: body.contact_ids.length};
  } else if (pathname === "/api/leads" && method === "POST") {
    const lead = {...body, id: crypto.randomUUID(), status:"needs_review", email_status:"unverified", approved_at:null, created_at:new Date().toISOString()};
    leads.unshift(lead); result = lead;
  } else if (pathname === "/api/leads") {
    const filtered = leads.filter(l => (!q.get("status") || l.status === q.get("status")) && `${l.name} ${l.company_name} ${l.title} ${l.email}`.toLowerCase().includes((q.get("query") || "").toLowerCase()));
    const offset = Number(q.get("offset") || 0); result = {items:filtered.slice(offset, offset+Number(q.get("limit") || 25)), total:filtered.length};
  } else if (pathname.startsWith("/api/leads/")) result = leads.find(l => l.id === pathname.split("/").pop());
  else if (pathname.startsWith("/api/campaigns")) {
    const id = pathname.split("/")[3];
    if (method === "POST" || method === "PUT") {
      const existing = campaigns.find(c => c.id === id);
      const campaign = {...structuredClone(mockCampaigns[2]), ...existing, ...body, id:existing?.id || crypto.randomUUID(), version:(existing?.version || 0)+1, recipients:leads.filter(l => body.contact_ids.includes(l.id)).map(l => ({id:l.id,name:l.name,email:l.email,state:"pending"})), recipient_count:body.contact_ids.length};
      if (existing) campaigns[campaigns.indexOf(existing)] = campaign; else campaigns.unshift(campaign);
      result = campaign;
    } else result = id ? campaigns.find(c => c.id === id) : {items:campaigns,total:campaigns.length};
  } else throw new Error(`No mock handler for ${method} ${pathname}`);
  if (!result) throw new Error("Mock record not found");
  return structuredClone(result) as T;
}

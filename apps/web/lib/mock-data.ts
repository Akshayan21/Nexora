import type { ApiLead } from "@/components/workspace/leads-context";
import type { CampaignDetail } from "@/components/workspace/campaign-context";

export const conversations = [
  {
    id: "t1",
    name: "Lana Steiner",
    company: "Catalog",
    initials: "LS",
    color: "mint",
    subject: "Re: A thought on Catalog’s next chapter",
    text: "Hi Akshayan, thanks for reaching out. This is actually something we’re exploring right now. Could you share a little more about how you work with teams like ours?",
    intent: "Interested",
    time: "12 min ago",
  },
  {
    id: "t2",
    name: "Drew Cano",
    company: "Circooles",
    initials: "DC",
    color: "blue",
    subject: "Re: A quick introduction",
    text: "Thanks for the note! Do you have a short overview that I could share with my co-founder? We’d like to understand the scope before setting up a call.",
    intent: "Question",
    time: "48 min ago",
  },
  {
    id: "t3",
    name: "Phoenix Baker",
    company: "Sisyphus",
    initials: "PB",
    color: "lavender",
    subject: "Re: Your recent product launch",
    text: "I’m away from my desk this week and will return on Monday. I’ll take a look when I’m back.",
    intent: "Out of office",
    time: "2 hours ago",
  },
];

export const mockAnalytics = {
  weekly: { labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], sent: [12,16,14,22,18,26,28], replies: [1,2,1,3,4,4,5] },
  monthly: { labels: ["Sep 23", "Sep 28", "Oct 3", "Oct 8", "Oct 13", "Oct 18", "Oct 22"], sent: [22,40,32,54,48,68,80], replies: [4,8,6,12,10,16,20] },
};
export const mockSettings = { paused: false, dailyLimit: 10, searches: ["B2B SaaS founders hiring a sales team | North America | 25 leads", "Heads of growth at developer tools companies | Europe | 10 leads"], replies: {} };
export const mockLeads: ApiLead[] = [
  ["Lana Steiner", "Founder", "Catalog", "catalog.example"],
  ["Drew Cano", "Co-founder", "Circooles", "circooles.example"],
  ["Phoenix Baker", "Head of Growth", "Sisyphus", "sisyphus.example"],
  ["Olivia Rhye", "CEO", "Layers", "layers.example"],
  ["Orlando Diggs", "VP Sales", "Quotient", "quotient.example"],
  ["Andi Lane", "Founder", "Linear Labs", "linearlabs.example"],
].map(([name,title,company_name,company_domain], i) => ({
  id: `mock-lead-${i+1}`, name, title, company_name, company_domain,
  email: `${name.split(" ")[0].toLowerCase()}@${company_domain}`, email_status: "unverified",
  status: i < 3 ? "approved" : "needs_review", approved_at: i < 3 ? "2026-10-20T09:00:00Z" : null,
  created_at: "2026-10-19T09:00:00Z",
  evidence: [{id: `mock-evidence-${i}`, field_name: "title", field_value: title, source_url: `https://${company_domain}/team`, summary: "Illustrative company profile: growing a B2B SaaS team.", confidence: 0.85, observed_at: "2026-10-19T09:00:00Z"}],
}));
export const mockCampaigns: CampaignDetail[] = ["SaaS founder introductions", "Growth team partnerships", "Product launch follow-up"].map((name,i) => ({
  id: `mock-campaign-${i+1}`, name, audience: "B2B SaaS founders and growth leaders", objective: "Start a conversation about outreach automation",
  state: ["active", "paused", "draft"][i], version: 1, created_at: "2026-10-20T09:00:00Z",
  recipient_count: 3, sent: [90,46,0][i], replies: [14,6,0][i],
  schedule: {timezone: "Asia/Kolkata", daily_limit: 25, weekdays: [0,1,2,3,4], window_start: "09:00", window_end: "17:00"},
  steps: [{subject: "A thought on your next stage of growth", body: "Hi {{first_name}}, I noticed your team is growing. Would you be open to a short conversation about making outreach more thoughtful?", delay_days: 0}, {subject: "Following up", body: "Hi {{first_name}}, happy to share a short overview if this is relevant to your team.", delay_days: 3}],
  recipients: mockLeads.slice(0,3).map(l => ({id:l.id,name:l.name,email:l.email,state:"pending"})),
  activity: [{action: "Campaign draft created", created_at: "2026-10-20T09:00:00Z"}],
  sending_enabled: false, blockers: ["Mock workspace: email sending is simulated."],
}));

export const mockMailbox = { address: "akshayan@workspace.example", state: "active" };

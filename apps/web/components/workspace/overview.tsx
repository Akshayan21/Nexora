"use client";
import { mockAnalytics, conversations } from "@/lib/mock-data";
import { useDataSource } from "./data-source";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Download, Plus } from "lucide-react";
import { useWorkspace } from "./store";
import { useLeadData, useLeadPage } from "./leads-context";
import { Avatar, Badge } from "./ui";
import { LeadDetails } from "./forms";
import type { Lead } from "@/lib/demo-data";

export function ActivityChart({ period = "7" }: { period?: string }) {
  const [point, setPoint] = useState<number | null>(null);
  const source = useDataSource();
  const sample = period === "7" ? mockAnalytics.weekly : mockAnalytics.monthly;
  const { labels } = sample;
  const sent = source === "mock" ? sample.sent : sample.sent.map(() => 0);
  const replies = source === "mock" ? sample.replies : sample.replies.map(() => 0);
  const max = period === "7" ? 30 : 90;
  const points = (values: number[]) =>
    values.map((v, i) => `${40 + i * 90},${178 - (v / max) * 146}`).join(" ");
  return (
    <div className="chart-container">
      <div className="chart-legend">
        <span>
          <i className="legend-sent" />
          Emails sent
        </span>
        <span>
          <i className="legend-reply" />
          Replies received
        </span>
        {point !== null && (
          <strong className="chart-tooltip">
            {labels[point]}: {sent[point]} sent, {replies[point]} replies
          </strong>
        )}
      </div>
      <svg
        viewBox="0 0 610 215"
        className="activity-chart"
        role="img"
        aria-label={`Sample email activity over the last ${period} days`}
        onMouseLeave={() => setPoint(null)}
      >
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e5cde1" stopOpacity=".65" />
            <stop offset="100%" stopColor="#faf4f9" stopOpacity=".05" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="40"
              x2="580"
              y1={32 + i * 48.7}
              y2={32 + i * 48.7}
              stroke="#ebe5ea"
              strokeDasharray="3 4"
            />
            <text x="8" y={36 + i * 48.7} className="chart-label">
              {Math.round(max - (i * max) / 3)}
            </text>
          </g>
        ))}
        <polygon points={`40,178 ${points(sent)} 580,178`} fill="url(#area)" />
        <polyline
          points={points(sent)}
          fill="none"
          stroke="#603158"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <polyline
          points={points(replies)}
          fill="none"
          stroke="#cfb4ca"
          strokeWidth="2.3"
          strokeLinejoin="round"
        />
        {labels.map((label, i) => (
          <g key={label}>
            <text
              x={40 + i * 90}
              y="205"
              textAnchor="middle"
              className="chart-label"
            >
              {label}
            </text>
            <circle
              cx={40 + i * 90}
              cy={178 - (sent[i] / max) * 146}
              r="4"
              fill="white"
              stroke="#603158"
              strokeWidth="2"
            />
            <rect
              x={20 + i * 90}
              y="20"
              width="40"
              height="165"
              fill="transparent"
              onMouseEnter={() => setPoint(i)}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
export function Overview() {
  const { state, leadSummary } = useWorkspace();
  const live = useLeadData();
  const source = useDataSource();
  const [activityPeriod, setActivityPeriod] = useState("7");
  const [lead, setLead] = useState<Lead | null>(null);
  const [tab, setTab] = useState("Needs review");

  const page = useLeadPage("", tab, 0, 8);
  const visible = page.items;
  const sent = state.campaigns.reduce((n, c) => n + c.sent, 0);
  const replies = state.campaigns.reduce((n, c) => n + c.replies, 0);
  function exportReport() {
    const csv = `metric,value\nLeads,${leadSummary.total}\nNeeds review,${leadSummary.needs_review}\nEmails sent,${sent}\nReplies,${replies}\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "outreach-workspace-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="workbench">
      <div className="desk-heading">
        <div>
          <h1>Overview</h1>
          <p>Review the queue. Keep outreach moving.</p>
        </div>
        <Link href="/campaigns/new" className="button primary">
          <Plus size={15} />
          New campaign
        </Link>
      </div>
      <div className="desk-demo">
        <span>{source === "mock" ? "Mock workspace" : "API workspace"}</span>
        <p>
          {source === "mock" ? "All sections use sample data. Edits never reach the API." : "Leads and campaigns use the API. Live inbox and activity tracking are not connected."}
        </p>
        <Link href="/settings">
          Workspace setup <ArrowUpRight size={13} />
        </Link>
      </div>
      <dl className="overview-summary" aria-label="Workspace summary">
        <div><dt>Total leads</dt><dd>{leadSummary.total}</dd><span>People in your workspace</span></div>
        <div><dt>Needs review</dt><dd>{leadSummary.needs_review}</dd><Link href="/leads">Review your leads <ArrowUpRight size={14} /></Link></div>
        <div><dt>Approved leads</dt><dd>{leadSummary.approved}</dd><span>Ready for a campaign</span></div>
        <div><dt>Campaigns</dt><dd>{state.campaigns.length}</dd><Link href="/campaigns">View campaigns <ArrowUpRight size={14} /></Link></div>
      </dl>
      <div className="desk-layout">
        <div className="desk-main">
          <section className="queue-section" aria-labelledby="queue-heading">
            <div className="desk-section-heading">
              <h2 id="queue-heading">Lead review</h2>
              <Link href="/discover" className="text-link">
                <Plus size={13} />
                Discover leads
              </Link>
            </div>
            <div
              className="queue-tabs"
              role="tablist"
              aria-label="Lead review status"
            >
              {["Needs review", "Approved"].map((t) => (
                <button
                  role="tab"
                  aria-selected={tab === t}
                  className={tab === t ? "selected" : ""}
                  key={t}
                  onClick={() => setTab(t)}
                >
                  {t}
                  <span>
                    {t === "Approved"
                      ? leadSummary.approved
                      : leadSummary.needs_review}
                  </span>
                </button>
              ))}
            </div>
            {page.loading && (
              <p className="live-loading" role="status">
                Loading database contacts…
              </p>
            )}
            {page.error && (
              <div className="live-error" role="alert">
                <p>{page.error}</p>
                <button className="button compact" onClick={live.refresh}>
                  Retry
                </button>
              </div>
            )}
            <div className="table-scroll">
              <table className="desk-leads">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Research signal</th>
                    <th>Fit</th>
                    <th aria-label="Review lead" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <button
                          className="desk-person"
                          onClick={() => setLead(l)}
                        >
                          <Avatar initials={l.initials} color={l.color} small />
                          <span>
                            <strong>{l.name}</strong>
                            <small>
                              {l.role} <span className="person-at">at</span>{" "}
                              {l.company}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className="signal-text">{l.signal}</span>
                        <small className="evidence-note">
                          Open profile to review source evidence
                        </small>
                      </td>
                      <td>
                        <span className="desk-fit">
                          {l.score === null ? "—" : `${l.score}/100`}
                        </span>
                      </td>
                      <td>
                        <button
                          className="review-row-action"
                          onClick={() => setLead(l)}
                        >
                          {tab === "Approved" ? "View" : "Review"}
                          <ArrowUpRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!page.loading && !page.error && visible.length === 0 && (
              <div className="queue-empty">
                <Check size={19} />
                <p>
                  {tab === "Needs review"
                    ? "Your review queue is clear."
                    : "No approved leads yet."}
                </p>
                <Link href="/discover">Find your next leads <ArrowUpRight size={15} /></Link>
              </div>
            )}
            <div className="queue-bottom">
              <span>{page.total} database contacts</span>
              <Link href="/leads">
                Open leads <ArrowRight size={13} />
              </Link>
            </div>
          </section>
          <section
            className="desk-activity"
            aria-labelledby="overview-activity-title"
          >
            <div className="desk-section-heading">
              <div>
                <h2 id="overview-activity-title">Outreach activity</h2>
                <p className="desk-chart-caption">
                  {source === "mock" ? "Mock sends and replies over time" : "Live activity tracking is not connected"}
                </p>
              </div>
              <label className="select-wrap">
                <select
                  aria-label="Overview activity date range"
                  value={activityPeriod}
                  onChange={(e) => setActivityPeriod(e.target.value)}
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                </select>
              </label>
            </div>
            <ActivityChart period={activityPeriod} />
            <Link href="/analytics" className="desk-chart-detail">
              Open analytics <ArrowUpRight size={13} />
            </Link>
          </section>
          <section
            className="desk-campaigns"
            aria-labelledby="campaigns-heading"
          >
            <div className="desk-section-heading">
              <h2 id="campaigns-heading">Campaigns</h2>
              <Link className="text-link" href="/campaigns">
                Manage campaigns <ArrowUpRight size={13} />
              </Link>
            </div>
            <div className="table-scroll">
              <table className="desk-campaign-table">
                <thead>
                  <tr>
                    <th>Sequence</th>
                    <th>Status</th>
                    <th>Sent</th>
                    <th>Replies</th>
                  </tr>
                </thead>
                <tbody>
                  {state.campaigns.slice(0, 4).map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/campaigns/${c.id}`}>
                          <strong>{c.name}</strong>
                          <small>{c.leads} recipients</small>
                        </Link>
                      </td>
                      <td>
                        <Badge
                          tone={
                            state.paused || c.status === "Paused"
                              ? "amber"
                              : c.status === "Active"
                                ? "green"
                                : "neutral"
                          }
                        >
                          {state.paused && c.status === "Active"
                            ? "Paused"
                            : c.status}
                        </Badge>
                      </td>
                      <td>{c.sent || "–"}</td>
                      <td>{c.replies || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {state.campaigns.length === 0 && (
              <div className="overview-campaign-empty">
                <p>No campaigns yet. Build a sequence for your approved leads.</p>
                <Link className="text-link" href="/campaigns/new">Create your first campaign <ArrowUpRight size={15} /></Link>
              </div>
            )}
          </section>
        </div>
        <aside className="desk-rail" aria-label="Workspace status">
          <section>
            <h2>Sending status</h2>
            <div className="sending-state">
              <span className="status-dot" />
              Not connected
            </div>
            <p>
              Connect Gmail before starting live outreach. Drafts remain in
              dry-run mode.
            </p>
            <Link className="rail-link" href="/settings">
              Set up mailbox <ArrowUpRight size={14} />
            </Link>
          </section>
          <section>
            <h2>Campaign totals</h2>
            <dl className="desk-metrics">
              <div>
                <dt>Emails sent</dt>
                <dd>{sent}</dd>
              </div>
              <div>
                <dt>Replies</dt>
                <dd>{replies}</dd>
              </div>
              <div>
                <dt>Reply rate</dt>
                <dd>{sent ? ((replies / sent) * 100).toFixed(1) : 0}%</dd>
              </div>
            </dl>
            <div
              className="overview-campaign-bars"
              role="img"
              aria-label="Campaign email volume comparison"
            >
              {state.campaigns
                .filter((c) => c.sent > 0)
                .map((c) => (
                  <div key={c.id} className="overview-campaign-bar">
                    <div>
                      <span>{c.name}</span>
                      <strong>{c.sent}</strong>
                    </div>
                    <div className="overview-bar-track">
                      <span
                        style={{
                          width: `${(c.sent / Math.max(...state.campaigns.map((c) => c.sent), 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              {state.campaigns.every((c) => c.sent === 0) && (
                <p>No campaign sends yet.</p>
              )}
            </div>
            <Link className="rail-link" href="/analytics">
              View analytics <ArrowUpRight size={14} />
            </Link>
          </section>
          <section className="rail-inbox">
            <div className="desk-section-heading">
              <h2>Recent replies</h2>
              <Link href="/inbox" aria-label="Open inbox">
                <ArrowUpRight size={14} />
              </Link>
            </div>
            {source === "mock" ? conversations.slice(0,2).map(thread => <Link key={thread.id} href="/inbox" className="rail-reply"><strong>{thread.name}</strong><span>{thread.text}</span><small>{thread.company} · Mock reply</small></Link>) : <p>Live inbox is not connected.</p>}
          </section>
          <button className="rail-export" onClick={exportReport}>
            <Download size={14} />
            Export workspace report
          </button>
        </aside>
      </div>
      {lead && <LeadDetails lead={lead} close={() => setLead(null)} />}
    </div>
  );
}

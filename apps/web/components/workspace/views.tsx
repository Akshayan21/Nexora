"use client";
import { useDataSource } from "./data-source";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  Compass,
  FileText,
  Pause,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useWorkspace } from "./store";
import { AddLeadForm } from "./add-lead";
import { useLeadData, useLeadPage } from "./leads-context";
import { Avatar, Badge, Empty, PanelTitle } from "./ui";
import { LeadDetails } from "./forms";
import { CampaignsScreen } from "./campaigns";
import { AnalyticsDashboard } from "./analytics";
import { GmailConnection } from "./gmail-connection";
import { conversations, type Lead } from "@/lib/demo-data";
function Heading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="heading-eyebrow">Workspace</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function DemoNotice() {
  const source = useDataSource();
  return (
    <div className="demo-strip">
      <span>
        <span className="demo-indicator" />
        {source === "mock" ? "Mock workspace" : "API workspace"}
      </span>
      <p>
        Demo changes are saved in this browser. Live research and email sending
        are not connected.
      </p>
    </div>
  );
}
export function LeadsView() {
  const { summary, approve: approveContacts, refresh } = useLeadData();
  const [adding, setAdding] = useState(false);
  const [offset, setOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All leads");
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Lead | null>(null);
  const [error, setError] = useState("");
  const page = useLeadPage(query, filter, offset);
  const leads = page.items;
  async function approve() {
    setSaving(true);
    setError("");
    try {
      await approveContacts(selected);
      setSelected([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Heading
        title="Leads"
        description="Review profiles and approve contacts for outreach."
        action={
          <button className="button primary" onClick={() => setAdding(true)}>
            <Plus size={16} />
            Add lead
          </button>
        }
      />
      <div className="live-leads-notice">
        <span className="status-dot" />
        Leads use the data source selected above. Mock edits stay in this session; API approvals are saved to PostgreSQL.
      </div>
      <section className="panel">
        <PanelTitle
          title="All leads"
          subtitle={`${summary.total} contacts in your database workspace`}
          action={
            <Badge tone="green">
              <ShieldCheck size={12} />
              Approval required
            </Badge>
          }
        />
        <div className="table-toolbar">
          <div className="tabs">
            {["All leads", "Needs review", "Approved"].map((t) => (
              <button
                key={t}
                onClick={() => {
                  setFilter(t);
                  setOffset(0);
                  setSelected([]);
                }}
                className={filter === t ? "selected" : ""}
              >
                {t}
                <span>
                  {t === "All leads"
                    ? summary.total
                    : t === "Approved"
                      ? summary.approved
                      : summary.needs_review}
                </span>
              </button>
            ))}
          </div>
          <label className="search-input">
            <Search size={16} />
            <input
              placeholder="Search people or companies"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOffset(0);
                setSelected([]);
              }}
              aria-label="Search people or companies"
            />
          </label>
        </div>
        {selected.length > 0 && (
          <div className="bulk-actions">
            <span>{selected.length} selected</span>
            <button
              className="button primary compact"
              onClick={approve}
              disabled={saving}
            >
              <CheckCheck size={15} />
              {saving ? "Saving…" : "Approve selected leads"}
            </button>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {page.loading && (
          <p className="live-loading" role="status">
            Loading contacts from the database…
          </p>
        )}
        {page.error && (
          <div className="live-error" role="alert">
            <p>{page.error}</p>
            <button className="button compact" onClick={refresh}>
              Retry
            </button>
          </div>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all visible leads"
                    checked={
                      leads.length > 0 &&
                      leads.every((l) => selected.includes(l.id))
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? leads.map((l) => l.id) : [],
                      )
                    }
                  />
                </th>
                <th>Name</th>
                <th>Company</th>
                <th>Location</th>
                <th>Fit score</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${l.name}`}
                      checked={selected.includes(l.id)}
                      onChange={(e) =>
                        setSelected((s) =>
                          e.target.checked
                            ? [...s, l.id]
                            : s.filter((id) => id !== l.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="person-cell"
                      onClick={() => setDetail(l)}
                    >
                      <Avatar initials={l.initials} color={l.color} small />
                      <span>
                        <strong>{l.name}</strong>
                        <small>{l.role}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <strong>{l.company}</strong>
                    <small>{l.domain}</small>
                  </td>
                  <td>{l.location}</td>
                  <td>
                    <span className="fit-score">
                      {l.score === null ? "Not scored" : `${l.score}%`}
                    </span>
                  </td>
                  <td>
                    <Badge tone={l.status === "Approved" ? "green" : "amber"}>
                      {l.status}
                    </Badge>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`View ${l.name}`}
                      onClick={() => setDetail(l)}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!page.loading && !page.error && !leads.length && (
          <Empty
            title={
              summary.total === 0
                ? "Your database has no leads yet"
                : "No leads match this search"
            }
          >
            Add your first lead, or adjust the search and status filter.
          </Empty>
        )}
        <div className="table-footer">
          <span>
            Showing {leads.length ? offset + 1 : 0}–{offset + leads.length} of{" "}
            {page.total} contacts
          </span>
          <div className="pagination-actions">
            <button
              className="button compact"
              disabled={offset === 0 || page.loading}
              onClick={() => {
                setOffset(Math.max(0, offset - 25));
                setSelected([]);
              }}
            >
              Previous
            </button>
            <button
              className="button compact"
              disabled={offset + 25 >= page.total || page.loading}
              onClick={() => {
                setOffset(offset + 25);
                setSelected([]);
              }}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      {adding && <AddLeadForm close={() => setAdding(false)} />}
      {detail && <LeadDetails lead={detail} close={() => setDetail(null)} />}
    </>
  );
}
export function CampaignsView() {
  return <CampaignsScreen />;
}

export function DiscoverView() {
  const { state, update } = useWorkspace();
  const [criteria, setCriteria] = useState("");
  const [region, setRegion] = useState("Anywhere");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      update((s) => ({
        ...s,
        searches: [
          `${criteria} | ${region} | ${new FormData(e.currentTarget).get("limit")} leads`,
          ...s.searches,
        ].slice(0, 10),
      }));
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Heading
        title="Discover leads"
        description="Describe your audience and save a research brief."
      />
      <DemoNotice />
      <div className="discovery-layout">
        <section className="panel discovery-form">
          <div className="discovery-emblem">
            <Compass size={27} />
          </div>
          <h2>Define your audience</h2>
          <p>
            Describe your ideal audience. Your agent will turn it into a
            research plan.
          </p>
          <form onSubmit={submit}>
            <label className="field">
              Who are you looking for?
              <textarea
                required
                rows={5}
                value={criteria}
                onChange={(e) => {
                  setCriteria(e.target.value);
                  setSaved(false);
                }}
                placeholder="e.g. Founders at B2B SaaS companies with 10–50 employees, based in North America and growing their team."
              />
            </label>
            <div className="form-two">
              <label className="field">
                Location
                <select
                  value={region}
                  onChange={(e) => {
                    setRegion(e.target.value);
                    setSaved(false);
                  }}
                >
                  <option>Anywhere</option>
                  <option>North America</option>
                  <option>Europe</option>
                  <option>India</option>
                  <option>Asia Pacific</option>
                </select>
              </label>
              <label className="field">
                Lead limit
                <select defaultValue="10" name="limit">
                  <option value="10">10 leads</option>
                  <option value="25">25 leads</option>
                  <option value="50">50 leads</option>
                </select>
              </label>
            </div>
            <button className="button primary full" type="submit">
              <Sparkles size={16} />
              Save research brief <ArrowRight size={16} />
            </button>
            <p className="form-hint">
              Saves your criteria locally. Live discovery is not connected yet.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {saved && (
              <div className="notice success" role="status">
                <Check size={19} />
                <span>
                  Research brief saved.{" "}
                  <Link href="/leads">Open your database leads</Link> while the
                  research worker is being connected.
                </span>
              </div>
            )}
          </form>
        </section>
        <aside>
          <section className="panel discovery-tips">
            <span className="tip-icon">
              <SlidersHorizontal size={20} />
            </span>
            <h3>What to include</h3>
            <p>
              The more specific your audience, the more relevant your
              connections.
            </p>
            {[
              [
                "Role & seniority",
                "Founders, heads of growth, or decision makers.",
              ],
              ["Company profile", "Industry, team size, and business model."],
              ["A timely signal", "Hiring, launching a product, or expanding."],
            ].map(([title, text]) => (
              <div className="tip" key={title}>
                <Check size={15} />
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </div>
            ))}
            <button
              className="button full"
              onClick={() => {
                setCriteria(
                  "Founders at B2B SaaS companies with 10–50 employees, currently hiring their first sales team.",
                );
                setSaved(false);
              }}
            >
              Use an example <ArrowUpRight size={14} />
            </button>
          </section>
          <div className="private-note">
            <ShieldCheck size={17} />
            <p>
              Your research runs locally. You review every lead before outreach.
            </p>
          </div>
        </aside>
      </div>
      {state.searches.length > 0 && (
        <section className="panel saved-briefs">
          <PanelTitle
            title="Saved research briefs"
            subtitle="Stored in this browser, ready for a future research run."
          />
          {state.searches.map((s, i) => (
            <div key={`${s}-${i}`}>
              <FileText size={18} />
              <p>{s}</p>
              <Badge>Saved</Badge>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
export function InboxView() {
  const { state, update } = useWorkspace();
  const [active, setActive] = useState("t1");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const source = useDataSource();
  const thread = conversations.find((t) => t.id === active)!;
  if (source === "api") return <><Heading title="Inbox" description="Review replies and prepare responses." /><Empty title="Live inbox is not connected">Connect the inbox API to load actual conversations.</Empty></>;
  return (
    <>
      <Heading
        title="Inbox"
        description="Review replies and prepare responses."
      />
      <DemoNotice />
      <section className="panel inbox-layout">
        <div className="thread-list">
          <div className="thread-list-head">
            <h2>
              Inbox <span>3</span>
            </h2>
            <label className="search-input">
              <Search size={15} />
              <input
                placeholder="Search conversations"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search conversations"
              />
            </label>
          </div>
          {conversations
            .filter((t) =>
              `${t.name} ${t.company}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((t) => (
              <button
                key={t.id}
                className={`thread-item ${active === t.id ? "selected" : ""}`}
                onClick={() => {
                  setActive(t.id);
                  setReply("");
                  setError("");
                }}
              >
                <Avatar initials={t.initials} color={t.color} small />
                <div>
                  <strong>
                    {t.name}
                    <time>{t.time}</time>
                  </strong>
                  <small>{t.company}</small>
                  <p>{t.text}</p>
                  <Badge tone={t.intent === "Interested" ? "green" : "neutral"}>
                    {t.intent}
                  </Badge>
                </div>
              </button>
            ))}
        </div>
        <div className="conversation">
          <div className="conversation-heading">
            <Avatar initials={thread.initials} color={thread.color} />
            <div>
              <h3>{thread.name}</h3>
              <p>{thread.company}</p>
            </div>
            <Badge tone="green">Sample thread</Badge>
          </div>
          <div className="message-body">
            <span className="conversation-date">Sample conversation</span>
            <h3>{thread.subject}</h3>
            <p>{thread.text}</p>
            <p>
              Best,
              <br />
              {thread.name.split(" ")[0]}
            </p>
            <div className="notice">
              <Pause size={16} />
              <span>
                Follow-ups stop when a reply is detected. This is a sample
                conversation.
              </span>
            </div>
          </div>
          <form
            className="reply-composer"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                update((s) => ({
                  ...s,
                  replies: { ...s.replies, [active]: reply.trim() },
                }));
                setReply("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <label htmlFor="reply">Your reply</label>
            <textarea
              id="reply"
              placeholder="Write a reply…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              required
            />
            <div>
              <span>
                <ShieldCheck size={13} />
                Draft only. Nothing is sent.
              </span>
              <button
                className="button primary compact"
                disabled={!reply.trim()}
                type="submit"
              >
                Save reply draft <ArrowRight size={14} />
              </button>
            </div>
            {state.replies[active] && (
              <p className="saved-reply" role="status">
                <Check size={14} />
                Saved draft: {state.replies[active]}
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </form>
        </div>
      </section>
    </>
  );
}
export function AnalyticsView() {
  return <AnalyticsDashboard />;
}

export function SettingsView() {
  const { state, update } = useWorkspace();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Heading
        title="Settings"
        description="Manage connections and outreach limits."
      />
      <DemoNotice />
      <div className="settings-layout">
        <section className="panel">
          <PanelTitle
            title="Outreach preferences"
            subtitle="Demo preferences apply only in this browser."
          />
          <form
            className="settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              try {
                update((s) => ({
                  ...s,
                  dailyLimit: Number(data.get("limit")),
                }));
                setSaved(true);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <label className="field">
              Daily email limit
              <input
                type="number"
                name="limit"
                defaultValue={state.dailyLimit}
                min="1"
                max="10"
                required
              />
              <small>The pilot supports up to 10 emails per day.</small>
            </label>
            <div className="setting-row">
              <span>
                <strong>Human approval</strong>
                <small>Review contacts before any outreach.</small>
              </span>
              <Badge tone="green">Always on</Badge>
            </div>
            <div className="setting-row">
              <span>
                <strong>Dry-run mode</strong>
                <small>Preview messages without sending.</small>
              </span>
              <Badge tone="green">Enabled</Badge>
            </div>
            <div className="setting-row">
              <span>
                <strong>Automatic AI replies</strong>
                <small>Substantive replies require your approval.</small>
              </span>
              <Badge>Disabled</Badge>
            </div>
            <button className="button primary" type="submit">
              Save demo preferences <Check size={15} />
            </button>
            {saved && (
              <p className="success-text" role="status">
                Preferences saved in this browser.
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </form>
        </section>
        <section className="panel">
          <PanelTitle
            title="Connections"
            subtitle="What’s ready, and what comes next."
          />
          <div className="connection-list">
            <GmailConnection />
            <div>
              <span className="summary-icon lavender">
                <Sparkles size={19} />
              </span>
              <span>
                <strong>Local AI worker</strong>
                <small>Worker integration is not built yet.</small>
              </span>
              <Badge>Not connected</Badge>
            </div>
            <div>
              <span className="summary-icon sand">
                <ShieldCheck size={19} />
              </span>
              <span>
                <strong>Control API</strong>
                <small>Live readiness appears in the top bar.</small>
              </span>
            </div>
          </div>
          <div className="notice settings-notice">
            <ShieldCheck size={18} />
            <span>
              Gmail credentials are encrypted on the server and never stored in
              this browser. Connecting Gmail does not enable email sending.
            </span>
          </div>
        </section>
      </div>
    </>
  );
}

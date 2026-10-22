"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Mail,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Badge, Empty } from "./ui";
import { leadRequest, useLeadPage } from "./leads-context";
import {
  useCampaign,
  useCampaignData,
  type CampaignDetail,
} from "./campaign-context";
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function date(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
function CampaignError({ message }: { message: string }) {
  return (
    <div className="live-error" role="alert">
      {message}
      <Link href="/campaigns" className="text-link">
        Back to campaigns
      </Link>
    </div>
  );
}
export function CampaignsScreen() {
  const { items, total, loading, error, refresh } = useCampaignData();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const campaigns = items.filter(
    (c) =>
      (filter === "all" || c.state === filter) &&
      `${c.name} ${c.audience}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Campaigns</h1>
          <p>Plan sequences, select recipients, and track each campaign.</p>
        </div>
        <Link href="/campaigns/new" className="button primary">
          <Plus size={16} />
          New campaign
        </Link>
      </div>
      <div className="campaign-live-note">
        <Check size={14} />
        Campaigns are stored in PostgreSQL. Sending is not connected.
      </div>
      <div className="campaign-index-toolbar">
        <div className="queue-tabs">
          {["all", "draft", "active", "paused", "completed"].map((t) => (
            <button
              key={t}
              className={filter === t ? "selected" : ""}
              onClick={() => setFilter(t)}
            >
              {t === "all" ? "All campaigns" : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <label className="search-input">
          <input
            aria-label="Search campaigns"
            placeholder="Search campaigns"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {loading && <p className="live-loading">Loading campaigns…</p>}
      {error && (
        <div className="live-error" role="alert">
          {error}
          <button className="button compact" onClick={refresh}>
            Retry
          </button>
        </div>
      )}
      <div className="table-scroll">
        <table className="campaign-index-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Status</th>
              <th>Recipients</th>
              <th>Sent</th>
              <th>Replies</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link
                    className="campaign-open-link"
                    href={`/campaigns/${c.id}`}
                  >
                    <strong>{c.name}</strong>
                    <small>{c.audience}</small>
                  </Link>
                </td>
                <td>
                  <Badge tone={c.state === "active" ? "green" : "neutral"}>
                    {c.state}
                  </Badge>
                </td>
                <td>{c.recipient_count}</td>
                <td>{c.sent}</td>
                <td>{c.replies}</td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
                <td>
                  <Link href={`/campaigns/${c.id}`} className="text-link">
                    Open <ArrowUpRight size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && !error && !campaigns.length && (
        <Empty title="No campaigns yet">
          Create a draft with your audience, email sequence, and sending
          preferences.
        </Empty>
      )}
      <div className="table-footer">
        Showing {campaigns.length} of {total} campaigns
      </div>
    </>
  );
}
export function EditCampaignScreen({ id }: { id: string }) {
  const { campaign, error } = useCampaign(id);
  return error ? (
    <CampaignError message={error} />
  ) : campaign ? (
    <CampaignEditor initial={campaign} />
  ) : (
    <p className="live-loading">Loading campaign…</p>
  );
}
export function CampaignEditor({ initial }: { initial?: CampaignDetail }) {
  const router = useRouter();
  const { refresh } = useCampaignData();
  const [name, setName] = useState(initial?.name || "");
  const [audience, setAudience] = useState(initial?.audience || "");
  const [objective, setObjective] = useState(initial?.objective || "");
  const [steps, setSteps] = useState(
    initial?.steps.map(({ subject, body, delay_days }) => ({
      subject,
      body,
      delay_days,
    })) || [{ subject: "", body: "", delay_days: 0 }],
  );
  const [schedule, setSchedule] = useState(
    initial?.schedule || {
      timezone: "Asia/Kolkata",
      daily_limit: 10,
      weekdays: [0, 1, 2, 3, 4],
      window_start: "09:00",
      window_end: "17:00",
    },
  );
  const [selected, setSelected] = useState(
    initial?.recipients.map((r) => r.id) || [],
  );
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const approved = useLeadPage(query, "Approved", offset, 25);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef({ body: "", key: "" });
  function updateStep(index: number, field: string, value: string | number) {
    setSteps((s) =>
      s.map((step, i) => (i === index ? { ...step, [field]: value } : step)),
    );
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!schedule.weekdays.length) {
      setError("Choose at least one sending day.");
      return;
    }
    const payload = {
      name,
      audience,
      objective,
      contact_ids: selected,
      steps,
      schedule,
      ...(initial ? { expected_version: initial.version } : {}),
    };
    const body = JSON.stringify(payload);
    if (attempt.current.body !== body)
      attempt.current = { body, key: crypto.randomUUID() };
    setSaving(true);
    setError("");
    try {
      const campaign = await leadRequest<CampaignDetail>(
        initial ? `/api/campaigns/${initial.id}` : "/api/campaigns",
        {
          method: initial ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(!initial ? { "Idempotency-Key": attempt.current.key } : {}),
          },
          body,
        },
      );
      refresh();
      router.push(`/campaigns/${campaign.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }
  return (
    <>
      <Link
        className="campaign-back"
        href={initial ? `/campaigns/${initial.id}` : "/campaigns"}
      >
        <ArrowLeft size={14} />
        {initial ? "Back to campaign" : "All campaigns"}
      </Link>
      <div className="page-heading">
        <div>
          <h1>{initial ? "Edit campaign" : "New campaign"}</h1>
          <p>
            {initial
              ? "Update your unsent draft. Changes are recorded in campaign activity."
              : "Define the audience, sequence, and sending preferences for your draft."}
          </p>
        </div>
        <Badge>{initial ? `Version ${initial.version}` : "Draft"}</Badge>
      </div>
      <form onSubmit={save} className="campaign-editor">
        <div className="campaign-editor-main">
          <section id="campaign-basics" className="campaign-form-section">
            <div className="campaign-section-heading">
              <span>1</span>
              <div>
                <h2>Campaign brief</h2>
                <p>Give the sequence a clear purpose.</p>
              </div>
            </div>
            <label className="field">
              Campaign name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={250}
                placeholder="e.g. Founder introductions · India"
              />
            </label>
            <label className="field">
              Audience description
              <textarea
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                required
                maxLength={3000}
                rows={2}
                placeholder="Who is this campaign for?"
              />
            </label>
            <label className="field">
              Campaign objective
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                required
                maxLength={5000}
                rows={3}
                placeholder="What are you offering, and what response are you hoping for?"
              />
            </label>
          </section>
          <section id="campaign-recipients" className="campaign-form-section">
            <div className="campaign-section-heading">
              <span>2</span>
              <div>
                <h2>
                  Recipients <small>{selected.length} selected</small>
                </h2>
                <p>
                  Only approved, non-suppressed database contacts can be added.
                </p>
              </div>
            </div>
            <label className="search-input recipient-search">
              <input
                aria-label="Search approved contacts"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOffset(0);
                }}
                placeholder="Search approved contacts"
              />
            </label>
            {approved.loading && (
              <p className="live-loading">Loading approved contacts…</p>
            )}
            {approved.error && (
              <p className="error" role="alert">
                {approved.error}
              </p>
            )}
            <div className="recipient-picker">
              {approved.items.map((l) => (
                <label key={l.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(l.id)}
                    onChange={(e) =>
                      setSelected((s) =>
                        e.target.checked
                          ? [...s, l.id]
                          : s.filter((id) => id !== l.id),
                      )
                    }
                  />
                  <span>
                    <strong>{l.name}</strong>
                    <small>
                      {l.role} at {l.company}
                    </small>
                  </span>
                  <Badge tone="green">Approved</Badge>
                </label>
              ))}
            </div>
            {!approved.loading && !approved.error && !approved.items.length && (
              <p className="campaign-inline-note">
                No approved contacts match.{" "}
                <Link href="/leads">Review your leads</Link>, or save this draft
                without recipients.
              </p>
            )}
            <div className="recipient-pagination">
              <span>
                {approved.total} approved contacts · {selected.length} selected
              </span>
              <button
                type="button"
                className="text-link"
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 25))}
              >
                Previous
              </button>
              <button
                type="button"
                className="text-link"
                disabled={offset + 25 >= approved.total}
                onClick={() => setOffset(offset + 25)}
              >
                Next
              </button>
              {selected.length > 0 && (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setSelected([])}
                >
                  Clear selection
                </button>
              )}
            </div>
          </section>
          <section id="campaign-sequence" className="campaign-form-section">
            <div className="campaign-section-heading">
              <span>3</span>
              <div>
                <h2>Email sequence</h2>
                <p>Write each message and choose the wait between steps.</p>
              </div>
            </div>
            {steps.map((step, i) => (
              <article className="sequence-editor" key={i}>
                <div className="sequence-editor-heading">
                  <span>
                    <Mail size={15} />
                    {i === 0 ? "Initial email" : `Follow-up ${i}`}
                  </span>
                  {i > 0 && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove follow-up ${i}`}
                      onClick={() =>
                        setSteps((s) => s.filter((_, n) => n !== i))
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                {i > 0 && (
                  <label className="sequence-delay">
                    Wait
                    <input
                      type="number"
                      aria-label={`Follow-up ${i} delay in days`}
                      value={step.delay_days}
                      min={1}
                      max={90}
                      required
                      onChange={(e) =>
                        updateStep(i, "delay_days", Number(e.target.value))
                      }
                    />
                    days after the previous email
                  </label>
                )}
                <label className="field">
                  Subject
                  <input
                    aria-label={`Step ${i + 1} subject`}
                    value={step.subject}
                    onChange={(e) => updateStep(i, "subject", e.target.value)}
                    required
                    maxLength={200}
                    placeholder="A specific, relevant introduction"
                  />
                </label>
                <label className="field">
                  Message
                  <textarea
                    aria-label={`Step ${i + 1} message`}
                    value={step.body}
                    onChange={(e) => updateStep(i, "body", e.target.value)}
                    required
                    maxLength={10000}
                    rows={6}
                    placeholder="Write your email. Include your identity and an opt-out instruction."
                  />
                </label>
                <p className="sequence-template-note">
                  Messages are stored as drafts. Personalization, compliance
                  footers, and send previews must be implemented before
                  dispatch.
                </p>
              </article>
            ))}
            <button
              type="button"
              className="button"
              disabled={steps.length >= 8}
              onClick={() =>
                setSteps((s) => [
                  ...s,
                  { subject: "", body: "", delay_days: 3 },
                ])
              }
            >
              <Plus size={14} />
              Add follow-up
            </button>
          </section>
          <section id="campaign-schedule" className="campaign-form-section">
            <div className="campaign-section-heading">
              <span>4</span>
              <div>
                <h2>Sending preferences</h2>
                <p>
                  Saved for the future scheduler. These settings do not start
                  outreach.
                </p>
              </div>
            </div>
            <div className="form-two">
              <label className="field">
                Timezone
                <input
                  list="campaign-timezones"
                  value={schedule.timezone}
                  required
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, timezone: e.target.value }))
                  }
                />
                <datalist id="campaign-timezones">
                  <option value="Asia/Kolkata" />
                  <option value="UTC" />
                  <option value="Europe/London" />
                  <option value="America/New_York" />
                  <option value="America/Los_Angeles" />
                </datalist>
              </label>
              <label className="field">
                Daily sending limit
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={schedule.daily_limit}
                  required
                  onChange={(e) =>
                    setSchedule((s) => ({
                      ...s,
                      daily_limit: Number(e.target.value),
                    }))
                  }
                />
              </label>
            </div>
            <fieldset className="sending-days">
              <legend>Sending days</legend>
              {days.map((day, i) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    checked={schedule.weekdays.includes(i)}
                    onChange={(e) =>
                      setSchedule((s) => ({
                        ...s,
                        weekdays: e.target.checked
                          ? [...s.weekdays, i].sort()
                          : s.weekdays.filter((d) => d !== i),
                      }))
                    }
                  />
                  {day}
                </label>
              ))}
            </fieldset>
            <div className="form-two">
              <label className="field">
                Window start
                <input
                  type="time"
                  value={schedule.window_start.slice(0, 5)}
                  required
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, window_start: e.target.value }))
                  }
                />
              </label>
              <label className="field">
                Window end
                <input
                  type="time"
                  value={schedule.window_end.slice(0, 5)}
                  required
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, window_end: e.target.value }))
                  }
                />
              </label>
            </div>
          </section>
          {error && (
            <div className="live-error" role="alert">
              {error}
              {initial && (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => window.location.reload()}
                >
                  Reload saved version
                </button>
              )}
            </div>
          )}
          <div className="campaign-editor-actions">
            <Link
              href={initial ? `/campaigns/${initial.id}` : "/campaigns"}
              className="button"
            >
              Cancel
            </Link>
            <button className="button primary" disabled={saving} type="submit">
              <Save size={15} />
              {saving ? "Saving…" : initial ? "Save changes" : "Create draft"}
            </button>
          </div>
        </div>
        <aside className="campaign-editor-summary">
          <h2>Draft summary</h2>
          <dl>
            <div>
              <dt>Recipients</dt>
              <dd>{selected.length}</dd>
            </div>
            <div>
              <dt>Email steps</dt>
              <dd>{steps.length}</dd>
            </div>
            <div>
              <dt>Sequence duration</dt>
              <dd>{steps.reduce((n, s) => n + s.delay_days, 0)} days</dd>
            </div>
            <div>
              <dt>Daily limit</dt>
              <dd>{schedule.daily_limit}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{schedule.timezone}</dd>
            </div>
          </dl>
          <div className="campaign-save-note">
            <Clock3 size={17} />
            <div>
              <strong>Saved as a draft</strong>
              <p>
                No emails will be sent. Gmail and the campaign worker are not
                connected yet.
              </p>
            </div>
          </div>
          <nav aria-label="Campaign form sections">
            <a href="#campaign-basics">Campaign brief</a>
            <a href="#campaign-recipients">Recipients</a>
            <a href="#campaign-sequence">Email sequence</a>
            <a href="#campaign-schedule">Sending preferences</a>
          </nav>
        </aside>
      </form>
    </>
  );
}
export function CampaignScreen({ id }: { id: string }) {
  const { campaign: c, error } = useCampaign(id);
  const [tab, setTab] = useState("Overview");
  if (error) return <CampaignError message={error} />;
  if (!c) return <p className="live-loading">Loading campaign…</p>;
  return (
    <>
      <Link className="campaign-back" href="/campaigns">
        <ArrowLeft size={14} />
        All campaigns
      </Link>
      <div className="page-heading campaign-detail-heading">
        <div>
          <div className="campaign-title-line">
            <h1>{c.name}</h1>
            <Badge>{c.state}</Badge>
          </div>
          <p>
            Created {date(c.created_at)} · Version {c.version}
          </p>
        </div>
        <Link href={`/campaigns/${id}/edit`} className="button">
          <Save size={14} />
          Edit campaign
        </Link>
      </div>
      <div className="campaign-status-banner">
        <Clock3 size={19} />
        <div>
          <strong>Draft saved. Sending is off.</strong>
          <p>{c.blockers.join(". ")}.</p>
        </div>
      </div>
      <div
        className="campaign-detail-tabs"
        role="tablist"
        aria-label="Campaign details"
      >
        {["Overview", "Sequence", "Recipients", "Activity", "Settings"].map(
          (t) => (
            <button
              role="tab"
              aria-selected={tab === t}
              key={t}
              className={tab === t ? "selected" : ""}
              onClick={() => setTab(t)}
            >
              {t}
              {t === "Sequence" && <span>{c.steps.length}</span>}
              {t === "Recipients" && <span>{c.recipient_count}</span>}
            </button>
          ),
        )}
      </div>
      {tab === "Overview" && (
        <div className="campaign-detail-overview">
          <section>
            <dl className="campaign-detail-metrics">
              <div>
                <dt>Recipients</dt>
                <dd>{c.recipient_count}</dd>
              </div>
              <div>
                <dt>Emails sent</dt>
                <dd>{c.sent}</dd>
              </div>
              <div>
                <dt>Replies</dt>
                <dd>{c.replies}</dd>
              </div>
            </dl>
            <div className="campaign-copy-section">
              <h2>Campaign objective</h2>
              <p>{c.objective}</p>
            </div>
            <div className="campaign-copy-section">
              <h2>Audience</h2>
              <p>{c.audience}</p>
            </div>
            <div className="campaign-copy-section">
              <h2>Sequence</h2>
              {c.steps.map((s, i) => (
                <button
                  key={s.id}
                  className="sequence-summary-row"
                  onClick={() => setTab("Sequence")}
                >
                  <span>{i + 1}</span>
                  <div>
                    <strong>{s.subject}</strong>
                    <small>
                      {i === 0
                        ? "Initial email"
                        : `Wait ${s.delay_days} days after previous email`}
                    </small>
                  </div>
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          </section>
          <aside>
            <h2>Schedule</h2>
            <p>
              {days
                .filter((_, i) => c.schedule.weekdays?.includes(i))
                .join(", ")}
            </p>
            <strong>
              {c.schedule.window_start?.slice(0, 5)}–
              {c.schedule.window_end?.slice(0, 5)}
            </strong>
            <p>{c.schedule.timezone}</p>
            <p>Up to {c.schedule.daily_limit} emails per day</p>
            <Link href={`/campaigns/${id}/edit`} className="text-link">
              Edit schedule <ArrowUpRight size={13} />
            </Link>
          </aside>
        </div>
      )}
      {tab === "Sequence" && (
        <section className="sequence-detail">
          {c.steps.map((s, i) => (
            <article key={s.id}>
              <div className="sequence-detail-label">
                <span>{i + 1}</span>
                <strong>{i === 0 ? "Initial email" : `Follow-up ${i}`}</strong>
                <small>
                  {i === 0
                    ? "No initial delay"
                    : `Wait ${s.delay_days} days after previous email`}
                </small>
              </div>
              <h2>{s.subject}</h2>
              <p>{s.body}</p>
              <span className="subtle-label">Draft · Not sent</span>
            </article>
          ))}
          <Link href={`/campaigns/${id}/edit`} className="button">
            Edit sequence <ArrowRight size={14} />
          </Link>
        </section>
      )}
      {tab === "Recipients" && (
        <section>
          {!c.recipients.length ? (
            <Empty title="No recipients yet">
              Edit this campaign to select approved contacts from your database.
            </Empty>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Business email</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {c.recipients.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name}</strong>
                      </td>
                      <td>{r.email || "Not collected"}</td>
                      <td>
                        <Badge tone="green">{r.state}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {tab === "Activity" && (
        <section className="campaign-audit">
          <h2>Campaign activity</h2>
          {c.activity.map((a, i) => (
            <div key={`${a.created_at}-${i}`}>
              <Check size={15} />
              <span>
                {a.action === "campaign.created"
                  ? "Campaign created"
                  : a.action === "campaign.updated"
                    ? "Campaign updated"
                    : a.action}
              </span>
              <time>{date(a.created_at)}</time>
            </div>
          ))}
        </section>
      )}
      {tab === "Settings" && (
        <section className="campaign-settings-detail">
          <h2>Saved preferences</h2>
          <dl>
            <div>
              <dt>Timezone</dt>
              <dd>{c.schedule.timezone}</dd>
            </div>
            <div>
              <dt>Sending days</dt>
              <dd>
                {days
                  .filter((_, i) => c.schedule.weekdays?.includes(i))
                  .join(", ")}
              </dd>
            </div>
            <div>
              <dt>Sending window</dt>
              <dd>
                {c.schedule.window_start?.slice(0, 5)}–
                {c.schedule.window_end?.slice(0, 5)}
              </dd>
            </div>
            <div>
              <dt>Daily limit</dt>
              <dd>{c.schedule.daily_limit}</dd>
            </div>
            <div>
              <dt>Dry-run mode</dt>
              <dd>Enabled; sending unavailable</dd>
            </div>
            <div>
              <dt>Stop conditions</dt>
              <dd>
                Reply, bounce, and unsubscribe checks are required before
                sending is implemented.
              </dd>
            </div>
          </dl>
          <Link href={`/campaigns/${id}/edit`} className="button">
            Edit preferences
          </Link>
        </section>
      )}
    </>
  );
}

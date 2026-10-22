"use client";
import { useState } from "react";
import {
  Check,
  FileText,
  MapPin,
  Building2,
  Globe,
  TrendingUp,
  Mail,
} from "lucide-react";
import { useLeadData, useLeadProfile } from "./leads-context";
import { Modal, Avatar } from "./ui";
import type { Lead } from "@/lib/demo-data";
export function LeadDetails({
  lead,
  close,
}: {
  lead: Lead;
  close: () => void;
}) {
  const { approve } = useLeadData();
  const profile = useLeadProfile(lead.id);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const current = profile.lead;
  const approved = current?.status === "approved";
  const evidence = current?.evidence || [];
  const location =
    evidence.find((e) => e.field_name === "location")?.field_value ||
    "Not collected";
  async function save() {
    setSaving(true);
    setError("");
    try {
      await approve([lead.id]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal title="Lead profile" close={close} className="lead-detail-modal">
      <div className="profile-identity">
        <Avatar initials={lead.initials} color={lead.color} />
        <div className="profile-name">
          <h3>{current?.name || lead.name}</h3>
          <p>
            {current?.title || lead.role}
            <span>
              at <strong>{current?.company_name || lead.company}</strong>
            </span>
          </p>
        </div>
        <div className="profile-score">
          <p>Not scored</p>
        </div>
      </div>
      {!current && !profile.error && (
        <p className="profile-fetch-status" role="status">
          Loading profile and source evidence…
        </p>
      )}
      {profile.error && (
        <p className="error profile-fetch-status" role="alert">
          {profile.error}
        </p>
      )}
      <dl className="profile-facts">
        <div>
          <dt>
            <Building2 size={14} />
            Company
          </dt>
          <dd>{current?.company_name || lead.company}</dd>
        </div>
        <div>
          <dt>
            <MapPin size={14} />
            Location
          </dt>
          <dd>{location}</dd>
        </div>
        <div>
          <dt>
            <Globe size={14} />
            Website
          </dt>
          <dd>{current?.company_domain || lead.domain}</dd>
        </div>
      </dl>
      <section className="profile-research">
        <h4>Research signal</h4>
        <div className="profile-signal">
          <TrendingUp size={18} />
          <div>
            <strong>
              {evidence.find((e) => e.field_name === "signal")?.field_value ||
                "No qualification signal recorded"}
            </strong>
            <p>
              Profile information comes from your database. Source entries are
              evidence records, not proof of email deliverability.
            </p>
          </div>
        </div>
      </section>
      <section className="profile-evidence">
        <div className="profile-section-title">
          <h4>Contact & evidence</h4>
          <span>
            {evidence.length
              ? `${evidence.length} source records`
              : "No source evidence"}
          </span>
        </div>
        <div className="profile-evidence-row">
          <Mail size={16} />
          <span>Business email</span>
          <strong>{current?.email || "Not collected"}</strong>
        </div>
        {current?.email && (
          <p>
            Email status: {current.email_status}. No send is authorized by
            viewing this profile.
          </p>
        )}
        {evidence.map((e) => (
          <article key={e.id} className="source-evidence">
            <div>
              <FileText size={15} />
              <strong>
                {e.field_name}: {e.field_value}
              </strong>
            </div>
            {e.summary && <p>{e.summary}</p>}
            {/^https?:\/\//i.test(e.source_url) && (
              <a href={e.source_url} target="_blank" rel="noopener noreferrer">
                {e.source_url}
              </a>
            )}
            <small>
              Observed {new Date(e.observed_at).toLocaleDateString()} ·{" "}
              {Math.round(e.confidence * 100)}% source confidence
            </small>
          </article>
        ))}
        {!evidence.length && (
          <p>Add source evidence before approving this contact.</p>
        )}
      </section>
      <div className="profile-demo-note">
        Saved in PostgreSQL. Approval does not send an email.
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="profile-footer">
        <div className={`profile-approval ${approved ? "is-approved" : ""}`}>
          <span className="approval-mark">
            {approved ? <Check size={13} /> : <span className="status-dot" />}
          </span>
          <span>
            <strong>{approved ? "Approved" : "Awaiting your review"}</strong>
            <small>
              {approved
                ? "Approval saved to the database."
                : "Review the source evidence above."}
            </small>
          </span>
        </div>
        <div className="profile-footer-actions">
          <button className="button" onClick={close}>
            Close
          </button>
          {!approved && (
            <button
              className="button primary"
              disabled={
                saving || !current || !!profile.error || !evidence.length
              }
              onClick={save}
            >
              <Check size={15} />
              {saving ? "Saving…" : "Approve lead"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

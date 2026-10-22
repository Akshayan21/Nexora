"use client";
import { useRef, useState, type FormEvent } from "react";
import { Modal } from "./ui";
import { leadRequest, useLeadData } from "./leads-context";
export function AddLeadForm({ close }: { close: () => void }) {
  const { refresh } = useLeadData();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const observedAt = useRef(new Date().toISOString());
  const attempt = useRef({ body: "", key: "" });
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const value = (key: string) => String(form.get(key) || "").trim();
    const title = value("title");
    const source = value("source");
    const body = JSON.stringify({
      name: value("name"),
      title: title || null,
      email: value("email") || null,
      company_name: value("company"),
      company_domain: value("domain"),
      evidence: source
        ? [
            {
              field_name: title ? "title" : "company",
              field_value: title || value("company"),
              source_url: source,
              confidence: 0.5,
              observed_at: observedAt.current,
              summary: "Manually entered source; not independently verified.",
            },
          ]
        : [],
    });
    if (attempt.current.body !== body)
      attempt.current = { body, key: crypto.randomUUID() };
    setSaving(true);
    setError("");
    try {
      await leadRequest("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": attempt.current.key,
        },
        body,
      });
      refresh();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal title="Add a lead" close={close}>
      <p className="modal-copy">
        Save a contact to your workspace database. Only enter contact details
        you can legitimately use.
      </p>
      <form onSubmit={submit}>
        <div className="form-two">
          <label className="field">
            Full name
            <input name="name" required maxLength={250} />
          </label>
          <label className="field">
            Role
            <input name="title" maxLength={250} />
          </label>
        </div>
        <div className="form-two">
          <label className="field">
            Company
            <input name="company" required maxLength={250} />
          </label>
          <label className="field">
            Company domain
            <input
              name="domain"
              required
              placeholder="company.com"
              maxLength={253}
            />
          </label>
        </div>
        <label className="field">
          Business email (optional)
          <input name="email" type="email" maxLength={320} />
        </label>
        <label className="field">
          Public source URL (optional)
          <input
            name="source"
            type="url"
            placeholder="https://company.com/team"
          />
          <small>
            Provide a page supporting the role or company. Source evidence is
            required before approval.
          </small>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            className="button"
            type="button"
            onClick={close}
            disabled={saving}
          >
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save lead"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

"use client";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { useDataSource } from "./data-source";
import { mockMailbox } from "@/lib/mock-data";
import { Badge } from "./ui";

type Connection = {
  configured: boolean;
  setup_error: string | null;
  mailboxes: { id: string; address: string; state: string }[];
};

export function GmailConnection() {
  const source = useDataSource();
  return source === "mock" ? <MockGmailConnection /> : <LiveGmailConnection />;
}
function MockGmailConnection() {
  const [connected, setConnected] = useState(true);
  return <section aria-label="Gmail connection"><div className="setting-row"><span><strong>Gmail · Mock connection</strong><small>{connected ? mockMailbox.address : "No mock mailbox connected"}</small></span><Badge>{connected ? "Connected (mock)" : "Disconnected (mock)"}</Badge></div><p>Sample mailbox. Connection changes are simulated.</p><button className="button" onClick={() => setConnected(!connected)}>{connected ? "Disconnect mock mailbox" : "Connect mock mailbox"}</button></section>;
}
function LiveGmailConnection() {
  const [data, setData] = useState<Connection | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const response = await fetch("/api/mailboxes", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "Could not load Gmail connection.");
    setData(result);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/mailboxes", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Could not load Gmail connection.");
        if (active) setData(result);
      })
      .catch((e) => { if (active) setError(e.message); });
    Promise.resolve().then(() => {
      if (!active) return;
      const url = new URL(window.location.href);
      const outcome = url.searchParams.get("gmail");
      if (outcome) {
        setMessage(outcome === "connected" ? "Gmail connected successfully." : outcome === "cancelled" ? "Google sign-in was cancelled. You can try again." : "Gmail connection failed or expired. Check your Google setup and try again.");
        url.searchParams.delete("gmail");
        window.history.replaceState(null, "", url);
      }
    });
    return () => { active = false; };
  }, []);
  async function act(id?: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(id ? `/api/mailboxes/${id}/disconnect` : "/api/mailboxes/google/start", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Gmail connection request failed.");
      if (!id) { window.location.assign(result.url); return; }
      await load();
      setMessage("Gmail disconnected and access revoked.");
    } catch (e) { setError(e instanceof Error ? e.message : "Gmail connection request failed."); }
    setBusy(false);
  }
  const connected = data?.mailboxes.filter((m) => m.state === "active") || [];
  return (
    <section className="gmail-connection" aria-label="Gmail connection">
      <div className="setting-row gmail-connection-summary">
        <span className="summary-icon mint"><Mail size={19} /></span>
        <span><strong>Gmail</strong><small>Connect your account with Google. Read-only access; no emails are sent.</small></span>
        <Badge tone={connected.length ? "green" : undefined}>{connected.length ? "Connected" : data ? "Not connected" : "Loading"}</Badge>
      </div>
      {connected.map((mailbox) => (
        <div className="setting-row" key={mailbox.id}>
          <span>{mailbox.address}</span>
          <button type="button" className="button" disabled={busy} onClick={() => act(mailbox.id)}>Disconnect</button>
        </div>
      ))}
      {data?.setup_error && <p className="error" role="status">{data.setup_error}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button type="button" className="button primary" disabled={busy || !data?.configured} onClick={() => act()}>
        {busy ? "Please wait…" : connected.length ? "Connect another Gmail account" : "Connect Gmail"}
      </button>
      {!data && <button type="button" className="button" disabled={busy} onClick={() => { setError(""); load().catch((e) => setError(e.message)); }}>Retry</button>}
    </section>
  );
}

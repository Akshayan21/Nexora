"use client";
import { mockAnalytics } from "@/lib/mock-data";
import { useDataSource } from "./data-source";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ActivityChart } from "./overview";
import { useWorkspace } from "./store";

export function AnalyticsDashboard() {
  const { state } = useWorkspace();
  const [period, setPeriod] = useState("7");
  const [hover, setHover] = useState<number | null>(null);
  const source = useDataSource();
  const sample = period === "7" ? mockAnalytics.weekly : mockAnalytics.monthly;
  const data = source === "mock" ? sample : {...sample, sent: sample.sent.map(() => 0), replies: sample.replies.map(() => 0)};
  const sent = data.sent.reduce((a, b) => a + b, 0);
  const replies = data.replies.reduce((a, b) => a + b, 0);
  const max = period === "7" ? 30 : 90;
  const campaigns = state.campaigns;
  const campaignMax = Math.max(
    10,
    Math.ceil(Math.max(...campaigns.map((c) => c.sent), 1) / 20) * 20,
  );
  return (
    <div className="analytics-workspace">
      <div className="page-heading">
        <div>
          <h1>Analytics</h1>
          <p>Sends, replies, and campaign performance.</p>
        </div>
        <label className="select-wrap">
          <select
            aria-label="Analytics date range"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setHover(null);
            }}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
          <ChevronDown size={15} />
        </label>
      </div>
      <div className="analytics-sample-note">
        <span className="status-dot" />
        {source === "mock" ? "Mock analytics. Illustrative sends and replies." : "Live message tracking is not connected. Campaign totals below use the API; time-series charts are unavailable."}
      </div>
      <dl className="analytics-totals">
        <div>
          <dt>Emails sent</dt>
          <dd>{sent}</dd>
          <small>In the selected sample period</small>
        </div>
        <div>
          <dt>Replies received</dt>
          <dd>{replies}</dd>
          <small>In the selected sample period</small>
        </div>
        <div>
          <dt>Reply rate</dt>
          <dd>
            {(sent ? (replies / sent) * 100 : 0).toFixed(1)}
            <span>%</span>
          </dd>
          <small>Replies divided by emails sent</small>
        </div>
      </dl>
      <section className="analytics-section">
        <div className="chart-section-heading">
          <div>
            <h2>Email volume</h2>
            <p>
              {period === "7"
                ? "Daily sends and replies across the sample week."
                : "Sends and replies grouped into date ranges across the sample month."}
            </p>
          </div>
          <div className="bar-legend">
            <span>
              <i />
              Sent
            </span>
            <span>
              <i className="reply-key" />
              Replies
            </span>
          </div>
        </div>
        <div className="volume-chart">
          <div className="bar-hover" aria-live="polite">
            {hover !== null ? (
              <>
                <strong>{data.labels[hover]}</strong>
                <span>{data.sent[hover]} sent</span>
                <span>{data.replies[hover]} replies</span>
              </>
            ) : (
              <span>Hover or focus a date to inspect its values</span>
            )}
          </div>
          <svg
            viewBox="0 0 920 290"
            role="img"
            aria-label={`Sample email volume bar chart over the last ${period} days`}
            className="volume-svg"
            onMouseLeave={() => setHover(null)}
          >
            <text x="12" y="13" className="axis-title">
              Emails
            </text>
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <line
                  x1="48"
                  x2="900"
                  y1={35 + i * 65}
                  y2={35 + i * 65}
                  className="plot-grid"
                />
                <text
                  x="33"
                  y={39 + i * 65}
                  textAnchor="end"
                  className="axis-text"
                >
                  {max - (i * max) / 3}
                </text>
              </g>
            ))}
            {data.labels.map((label, i) => {
              const x = 85 + i * 120;
              return (
                <g
                  key={label}
                  tabIndex={0}
                  role="button"
                  aria-label={`${label}: ${data.sent[i]} sent, ${data.replies[i]} replies`}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setHover(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setHover(i);
                    }
                  }}
                >
                  <title>{`${label}: ${data.sent[i]} sent, ${data.replies[i]} replies`}</title>
                  {hover === i && (
                    <rect
                      x={x - 20}
                      y="25"
                      width="94"
                      height="215"
                      fill="#f7f1f6"
                    />
                  )}
                  <rect
                    x={x}
                    y={230 - (data.sent[i] / max) * 195}
                    width="27"
                    height={(data.sent[i] / max) * 195}
                    rx="2"
                    fill="#603158"
                  />
                  <rect
                    x={x + 33}
                    y={230 - (data.replies[i] / max) * 195}
                    width="27"
                    height={(data.replies[i] / max) * 195}
                    rx="2"
                    fill="#c6a5c0"
                  />
                  <text
                    x={x + 28}
                    y="258"
                    textAnchor="middle"
                    className="axis-text"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>
      <div className="analytics-comparisons">
        <section className="analytics-section">
          <div className="chart-section-heading">
            <div>
              <h2>Campaign comparison</h2>
              <p>Campaign totals from the selected source, independent of the sample date filter.</p>
            </div>
          </div>
          <div
            className="campaign-bars"
            role="img"
            aria-label="Database campaign emails sent and replies comparison"
          >
            {campaigns.map((c) => (
              <div className="campaign-bar-group" key={c.id}>
                <div className="bar-campaign-title">
                  <strong>{c.name}</strong>
                  <span>
                    {c.sent
                      ? `${((c.replies / c.sent) * 100).toFixed(1)}% reply rate`
                      : "No sends yet"}
                  </span>
                </div>
                <div className="horizontal-bar-row">
                  <span>Sent</span>
                  <div className="horizontal-bar-track">
                    <div
                      className="horizontal-bar sent-bar"
                      style={{ width: `${(c.sent / campaignMax) * 100}%` }}
                    />
                  </div>
                  <strong>{c.sent}</strong>
                </div>
                <div className="horizontal-bar-row">
                  <span>Replies</span>
                  <div className="horizontal-bar-track">
                    <div
                      className="horizontal-bar replies-bar"
                      style={{ width: `${(c.replies / campaignMax) * 100}%` }}
                    />
                  </div>
                  <strong>{c.replies}</strong>
                </div>
              </div>
            ))}
            <div className="campaign-bar-axis">
              <span>0</span>
              <span>{campaignMax / 2}</span>
              <span>{campaignMax} emails</span>
            </div>
          </div>
        </section>
        <section className="analytics-section trend-section">
          <div className="chart-section-heading">
            <div>
              <h2>Activity trend</h2>
              <p>The same sample volume over time.</p>
            </div>
          </div>
          <ActivityChart period={period} />
          <div className="chart-reading">
            <strong>
              {(sent ? (replies / sent) * 100 : 0).toFixed(1)}% of sample sends received a
              reply.
            </strong>
            <p>
              This is illustrative data. No deliverability, bounce, or open
              tracking has been collected.
            </p>
          </div>
        </section>
      </div>
      <section className="analytics-section">
        <div className="chart-section-heading">
          <div>
            <h2>Campaign breakdown</h2>
            <p>Results by sequence from the selected source.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="analytics-breakdown">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Leads</th>
                <th>Sent</th>
                <th>Replies</th>
                <th>Reply rate</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>{c.leads}</td>
                  <td>{c.sent}</td>
                  <td>{c.replies}</td>
                  <td>
                    {c.sent
                      ? `${((c.replies / c.sent) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

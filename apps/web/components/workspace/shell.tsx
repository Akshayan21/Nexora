"use client";
import { DataSourceToggle, useDataSource } from "./data-source";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  AudioLines,
  Bell,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  Inbox,
  LayoutDashboard,
  Menu,
  Search,
  Settings2,
  Sparkles,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { useWorkspace } from "./store";
import { Avatar, Modal } from "./ui";
const nav = [
  ["Overview", "/overview", LayoutDashboard],
  ["Discover", "/discover", Compass],
  ["Leads", "/leads", Users],
  ["Campaigns", "/campaigns", Workflow],
  ["Inbox", "/inbox", Inbox],
  ["Analytics", "/analytics", ChartNoAxesCombined],
] as const;
export function Shell({ children }: { children: ReactNode }) {
  const source = useDataSource();
  const pathname = usePathname();
  const { leadSummary } = useWorkspace();
  const [mobile, setMobile] = useState(false);
  const [help, setHelp] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const title =
    nav.find(
      (n) => pathname === n[1] || pathname.startsWith(`${n[1]}/`),
    )?.[0] || "Settings";
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {mobile && (
        <button
          aria-label="Close navigation"
          className="nav-scrim"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <Link
          href="/overview"
          className="brand"
          onClick={() => setMobile(false)}
        >
          <span className="brand-symbol">
            <AudioLines size={23} />
          </span>
          outreach<span className="brand-period">.</span>
        </Link>
        <button className="workspace-picker" onClick={() => setHelp(true)}>
          <span className="workspace-letter">A</span>
          <span>
            <strong>Akshayan’s workspace</strong>
            <small>Personal workspace</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-label">Workspace</div>
        <nav aria-label="Main navigation">
          {nav.map(([label, href, Icon]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobile(false)}
              className={`nav-item ${pathname === href || pathname.startsWith(`${href}/`) ? "active" : ""}`}
              aria-current={
                pathname === href || pathname.startsWith(`${href}/`)
                  ? "page"
                  : undefined
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Leads" && (
                <span className="nav-count">{leadSummary.needs_review}</span>
              )}
              {label === "Inbox" && <span className="unread-count">{source === "mock" ? 3 : 0}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            Help & getting started
          </button>
          <Link
            className={`nav-item ${pathname === "/settings" ? "active" : ""}`}
            href="/settings"
            onClick={() => setMobile(false)}
          >
            <Settings2 size={18} />
            Settings
          </Link>
          <div className="profile">
            <Avatar initials="AK" color="sand" small />
            <span>
              <strong>Akshayan</strong>
              <small>Personal account</small>
            </span>
            <Link href="/settings" aria-label="Account settings">
              <ChevronDown size={16} />
            </Link>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <Link href="/overview" className="breadcrumb-workspace">Workspace</Link>
            <ChevronRight className="breadcrumb-slash" size={14} aria-hidden="true" />
            <strong aria-current="page">{title}</strong>
          </nav>
          <div className="topbar-actions"><DataSourceToggle />
            <Link
              href="/leads"
              className="topbar-search"
              aria-label="Search leads"
            >
              <Search size={16} /><span className="topbar-search-label">Search leads</span>
            </Link>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() => setNotifications(true)}
            >
              <Bell size={18} />
            </button>
            <span className="topbar-divider" aria-hidden="true" />
            <Link href="/settings" className="topbar-account" aria-label="Account settings">
              <Avatar initials="AK" color="sand" small />
              <ChevronDown size={13} aria-hidden="true" />
            </Link>
          </div>
        </header>
        <main id="main" className="main-content">
          {children}
        </main>
      </div>
      {help && (
        <Modal title="Your outreach workspace" close={() => setHelp(false)}>
          <p className="modal-copy">
            Discover relevant people, review their sources, and build thoughtful
            email sequences. Lead profiles and approvals are stored in
            PostgreSQL. Campaign drafts are stored in the database. Inbox conversations and activity charts still use labeled sample data.
          </p>
          <div className="notice">
            <Sparkles size={18} />
            <span>
              Start with Discover, then review your leads before creating a
              campaign. Live research and email sending are not connected yet.
            </span>
          </div>
          <Link
            className="button primary full"
            href="/discover"
            onClick={() => setHelp(false)}
          >
            Explore discovery <ArrowUpRight size={16} />
          </Link>
        </Modal>
      )}
      {notifications && (
        <Modal
          title="You’re all caught up"
          close={() => setNotifications(false)}
        >
          <div className="empty">
            <Bell size={27} />
            <h3>No new notifications</h3>
            <p>
              Approvals, research updates, and replies will appear here when
              live activity is connected.
            </p>
          </div>
          <button
            className="button full"
            onClick={() => setNotifications(false)}
          >
            Close <X size={15} />
          </button>
        </Modal>
      )}
    </div>
  );
}

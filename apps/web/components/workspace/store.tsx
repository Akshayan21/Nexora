"use client";
import { useMemo, useSyncExternalStore } from "react";
import { initialState, type DemoState } from "@/lib/demo-data";

import { useCampaignData } from "./campaign-context";
import { useLeadData } from "./leads-context";

import { getDataSource } from "@/lib/data-source";
import { mockSettings } from "@/lib/mock-data";
const storageKey = () => `outreach-workspace-${getDataSource()}-v2`;
const fallback = JSON.stringify(initialState);
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("outreach-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("outreach-change", callback);
  };
}
function snapshot() {
  try {
    return window.localStorage.getItem(storageKey()) || JSON.stringify(getDataSource() === "mock" ? { ...initialState, ...mockSettings } : initialState);
  } catch {
    return fallback;
  }
}
let memory = initialState;
export function useWorkspace() {
  const live = useLeadData();
  const campaigns = useCampaignData();
  const serialized = useSyncExternalStore(subscribe, snapshot, () => fallback);
  const state: DemoState = useMemo(() => {
    try {
      const parsed = JSON.parse(serialized);
      return Array.isArray(parsed.leads) && Array.isArray(parsed.campaigns)
        ? { ...initialState, ...parsed }
        : initialState;
    } catch {
      return initialState;
    }
  }, [serialized]);
  function update(change: (state: DemoState) => DemoState) {
    let current = memory;
    try {
      current = JSON.parse(snapshot());
    } catch {
      /* Use the current in-memory state. */
    }
    memory = change(current);
    try {
      window.localStorage.setItem(
        storageKey(),
        JSON.stringify({ ...memory, leads: [], campaigns: [] }),
      );
    } catch {
      throw new Error(
        "Browser storage is unavailable. Enable local storage to save demo changes.",
      );
    }
    window.dispatchEvent(new Event("outreach-change"));
  }
  return {
    state: {
      ...state,
      leads: live.leads,
      campaigns: campaigns.items.map((c) => ({
        id: c.id,
        name: c.name,
        audience: c.audience,
        status: (c.state[0].toUpperCase() + c.state.slice(1)) as
          | "Draft"
          | "Active"
          | "Paused"
          | "Completed"
          | "Failed",
        leads: c.recipient_count,
        sent: c.sent,
        replies: c.replies,
        color: "mint",
      })),
    },
    update,
    leadSummary: live.summary,
  };
}

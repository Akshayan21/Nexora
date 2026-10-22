"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { getDataSource } from "@/lib/data-source";
import { mockRequest } from "@/lib/mock-api";
import type { Lead } from "@/lib/demo-data";
export type Evidence = {
  id: string;
  field_name: string;
  field_value: string;
  source_url: string;
  summary: string | null;
  confidence: number;
  observed_at: string;
};
export type ApiLead = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  email_status: string;
  company_name: string | null;
  company_domain: string | null;
  status: "approved" | "needs_review";
  approved_at: string | null;
  created_at: string;
  evidence?: Evidence[];
};
export type Summary = { total: number; approved: number; needs_review: number };
export function mapLead(l: ApiLead): Lead {
  return {
    id: l.id,
    name: l.name,
    role: l.title || "Role not collected",
    company: l.company_name || "Company not collected",
    domain: l.company_domain || "Not collected",
    initials: l.name
      .split(/\s+/)
      .slice(0, 2)
      .map((n) => n[0])
      .join(""),
    color: "mint",
    location: "See profile",
    score: null,
    status: l.status === "approved" ? "Approved" : "Needs review",
    signal: "Open profile for source evidence",
  };
}
export async function leadRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  if (getDataSource() === "mock") return mockRequest<T>(url, init);
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail.map((e: { msg: string }) => e.msg).join("; ")
          : "Lead request failed",
    );
  }
  return data;
}
const blank = {
  leads: [] as Lead[],
  summary: { total: 0, approved: 0, needs_review: 0 },
  loading: true,
  error: "",
};
const Context = createContext({
  ...blank,
  version: 0,
  refresh: () => {},
  approve: async (...ids: string[][]) => {
    void ids;
  },
});
export function LeadsProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(
    (_: typeof blank, next: typeof blank) => next,
    blank,
  );
  const [version, refresh] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    let active = true;
    Promise.all([
      leadRequest<{ items: ApiLead[] }>("/api/leads?limit=100"),
      leadRequest<Summary>("/api/leads/summary"),
    ])
      .then(([page, summary]) => {
        if (active)
          dispatch({
            leads: page.items.map(mapLead),
            summary,
            loading: false,
            error: "",
          });
      })
      .catch((e) => {
        if (active) dispatch({ ...blank, loading: false, error: e.message });
      });
    return () => {
      active = false;
    };
  }, [version]);
  const approve = useCallback(async (ids: string[]) => {
    await leadRequest("/api/leads/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_ids: ids }),
    });
    refresh();
  }, []);
  return (
    <Context.Provider value={{ ...data, version, refresh, approve }}>
      {children}
    </Context.Provider>
  );
}
export function useLeadData() {
  return useContext(Context);
}
export function useLeadPage(
  query: string,
  status: string,
  offset = 0,
  limit = 25,
) {
  const { version } = useLeadData();
  const [data, dispatch] = useReducer(
    (
      _: { items: Lead[]; total: number; loading: boolean; error: string },
      next: { items: Lead[]; total: number; loading: boolean; error: string },
    ) => next,
    { items: [], total: 0, loading: true, error: "" },
  );
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) dispatch({ items: [], total: 0, loading: true, error: "" });
      const params = new URLSearchParams({
        query,
        limit: String(limit),
        offset: String(offset),
      });
      if (status !== "All leads")
        params.set(
          "status",
          status === "Approved" ? "approved" : "needs_review",
        );
      leadRequest<{ items: ApiLead[]; total: number }>(`/api/leads?${params}`)
        .then((p) => {
          if (active)
            dispatch({
              items: p.items.map(mapLead),
              total: p.total,
              loading: false,
              error: "",
            });
        })
        .catch((e) => {
          if (active)
            dispatch({ items: [], total: 0, loading: false, error: e.message });
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, status, offset, limit, version]);
  return data;
}
export function useLeadProfile(id: string) {
  const { version } = useLeadData();
  const [data, setData] = useState<{ lead: ApiLead | null; error: string }>({
    lead: null,
    error: "",
  });
  useEffect(() => {
    let active = true;
    leadRequest<ApiLead>(`/api/leads/${id}`)
      .then((lead) => {
        if (active) setData({ lead, error: "" });
      })
      .catch((e) => {
        if (active) setData({ lead: null, error: e.message });
      });
    return () => {
      active = false;
    };
  }, [id, version]);
  return data;
}

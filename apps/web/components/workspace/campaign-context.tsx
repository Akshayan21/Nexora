"use client";
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";
import { leadRequest } from "./leads-context";
export type CampaignSummary = {
  id: string;
  name: string;
  audience: string;
  objective: string;
  state: string;
  version: number;
  created_at: string;
  recipient_count: number;
  sent: number;
  replies: number;
};
export type CampaignDetail = CampaignSummary & {
  schedule: {
    timezone: string;
    daily_limit: number;
    weekdays: number[];
    window_start: string;
    window_end: string;
  };
  steps: { id?: string; subject: string; body: string; delay_days: number }[];
  recipients: {
    id: string;
    name: string;
    email: string | null;
    state: string;
  }[];
  activity: { action: string; created_at: string }[];
  sending_enabled: boolean;
  blockers: string[];
};
const initial = {
  items: [] as CampaignSummary[],
  total: 0,
  loading: true,
  error: "",
};
const Context = createContext({ ...initial, version: 0, refresh: () => {} });
export function CampaignProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(
    (_: typeof initial, next: typeof initial) => next,
    initial,
  );
  const [version, refresh] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    let active = true;
    leadRequest<{ items: CampaignSummary[]; total: number }>(
      "/api/campaigns?limit=100",
    )
      .then((r) => {
        if (active) dispatch({ ...r, loading: false, error: "" });
      })
      .catch((e) => {
        if (active) dispatch({ ...initial, loading: false, error: e.message });
      });
    return () => {
      active = false;
    };
  }, [version]);
  return (
    <Context.Provider value={{ ...data, version, refresh }}>
      {children}
    </Context.Provider>
  );
}
export function useCampaignData() {
  return useContext(Context);
}
export function useCampaign(id: string) {
  const { version } = useCampaignData();
  const [data, dispatch] = useReducer(
    (
      _: { campaign: CampaignDetail | null; error: string },
      next: { campaign: CampaignDetail | null; error: string },
    ) => next,
    { campaign: null, error: "" },
  );
  useEffect(() => {
    let active = true;
    leadRequest<CampaignDetail>(`/api/campaigns/${id}`)
      .then((campaign) => {
        if (active) dispatch({ campaign, error: "" });
      })
      .catch((e) => {
        if (active) dispatch({ campaign: null, error: e.message });
      });
    return () => {
      active = false;
    };
  }, [id, version]);
  return data;
}

export type Lead = {
  id: string;
  name: string;
  role: string;
  company: string;
  domain: string;
  initials: string;
  color: string;
  location: string;
  score: number | null;
  status: "Needs review" | "Approved";
  signal: string;
};
export type Campaign = {
  id: string;
  name: string;
  audience: string;
  status: "Active" | "Paused" | "Draft" | "Completed" | "Failed";
  leads: number;
  sent: number;
  replies: number;
  color: string;
};
export type DemoState = {
  leads: Lead[];
  campaigns: Campaign[];
  paused: boolean;
  dailyLimit: number;
  searches: string[];
  replies: Record<string, string>;
};
export const initialState: DemoState = {
  paused: false,
  dailyLimit: 10,
  searches: [],
  replies: {},
  leads: [],
  campaigns: [],
};
export { conversations } from "./mock-data";

"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import { getDataSource, setDataSource } from "@/lib/data-source";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("outreach-source-change", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("outreach-source-change", callback); };
}
export function useDataSource() { return useSyncExternalStore(subscribe, getDataSource, () => "api" as const); }
export function DataBoundary({children}: {children: ReactNode}) {
  const source = useDataSource();
  return <div key={source} style={{display:"contents"}}>{children}</div>;
}
export function DataSourceToggle() {
  const source = useDataSource();
  return <button className="button compact" role="switch" aria-checked={source === "mock"} aria-label="Use mock data" onClick={() => setDataSource(source === "mock" ? "api" : "mock")}>{source === "mock" ? "Mock data" : "API data"}</button>;
}

export type DataSource = "mock" | "api";
const key = "outreach-data-source";
export function getDataSource(): DataSource {
  if (typeof window === "undefined") return "api";
  try { return localStorage.getItem(key) === "mock" ? "mock" : "api"; } catch { return "api"; }
}
export function setDataSource(source: DataSource) {
  localStorage.setItem(key, source);
  window.dispatchEvent(new Event("outreach-source-change"));
}

export interface Bid {
  id: string;
  company_id: string;
  name: string;
  gc: string;
  location: string;
  trade: string;
  status: string;
  bid_date: string;
  value_cents: string;
  updated_at: string;
}

export interface Filter { status?: string; trade?: string; q?: string }

// What every variant's hook returns: the first page of matching rows, the match count,
// and which filter those rows belong to (so the bench knows when a filter change has landed).
export interface BidsView { rows: Bid[]; total: number; forKey: string | null }

export const COMPANY = "co_demo";
export const PAGE = 100;
export const API = "http://localhost:8787";
export const ELECTRIC = "http://localhost:3010";

export const keyOf = (f: Filter) => JSON.stringify([f.status ?? "", f.trade ?? "", f.q ?? ""]);

export async function rpc<T>(method: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${method}: ${r.status}`);
  return r.json();
}

// Local filtering for the variants that hold the whole tenant list.
export function applyFilter(all: Bid[], f: Filter): { rows: Bid[]; total: number } {
  const q = f.q?.toLowerCase();
  const hit = all.filter((b) =>
    (!f.status || b.status === f.status) && (!f.trade || b.trade === f.trade) &&
    (!q || b.name.toLowerCase().includes(q) || b.gc.toLowerCase().includes(q)));
  return { rows: hit.slice(0, PAGE), total: hit.length };
}

export const byDateDesc = (a: Bid, b: Bid) => (a.bid_date < b.bid_date ? 1 : a.bid_date > b.bid_date ? -1 : a.id < b.id ? -1 : 1);

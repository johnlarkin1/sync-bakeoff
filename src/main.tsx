import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { useBids as electric } from "./sources/electric";
import { useBids as queryClient } from "./sources/queryClient";
import { useBids as queryServer } from "./sources/queryServer";
import { useBids as yrs } from "./sources/yrs";
import { useBids as zero } from "./sources/zero";
import { useBids as replicache } from "./sources/replicache";
import { useBids as livestore } from "./sources/livestore";
import { ZeroProvider } from "@rocicorp/zero/react";
import { schema as zeroSchema } from "./zero/schema.ts";
import { Bid, BidsView, Filter, keyOf, rpc } from "./types";

const SOURCES: Record<string, (f: Filter) => BidsView> = { "query-server": queryServer, "query-client": queryClient, electric, yrs, zero, replicache, livestore };
const q = new URLSearchParams(location.search);
const variant = q.get("v") ?? "query-server";
const useBids = SOURCES[variant];
const hud = document.getElementById("hud")!;

// Bench hooks: resolve when the rows for a filter key, or a bid with a given name, are on screen.
type Waiter = { test: (v: BidsView) => boolean; resolve: () => void };
const waiters: Waiter[] = [];
let setFilterExternal: (f: Filter) => void = () => {};
let lastView: BidsView = { rows: [], total: 0, forKey: null };
const waitFor = (test: Waiter["test"]) => new Promise<void>((resolve) => waiters.push({ test, resolve }));

function Table({ rows }: { rows: Bid[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({ count: rows.length, getScrollElement: () => ref.current, estimateSize: () => 28, overscan: 10 });
  return (
    <div ref={ref} style={{ height: "calc(100vh - 45px)", overflow: "auto" }}>
      <div style={{ height: v.getTotalSize(), position: "relative" }}>
        {v.getVirtualItems().map((it) => {
          const b = rows[it.index];
          return (
            <div key={b.id} className="row" data-name={b.name} style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${it.start}px)` }}>
              <span>{b.id}</span><span>{b.name}</span><span>{b.gc}</span><span>{b.location}</span>
              <span>{b.trade}</span><span>{b.status}</span><span>{b.bid_date}</span>
              <span>${(Number(b.value_cents) / 100).toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function App() {
  const [f, setF] = useState<Filter>({});
  setFilterExternal = setF;
  const view = useBids(f);
  lastView = view;
  useEffect(() => {
    // After commit, wait one frame so the rows have painted.
    requestAnimationFrame(() => {
      for (let i = waiters.length - 1; i >= 0; i--)
        if (waiters[i].test(view)) { waiters[i].resolve(); waiters.splice(i, 1); }
    });
  });
  return (
    <>
      <div className="bar">
        <b>{variant}</b>
        <select value={f.status ?? ""} onChange={(e) => setF({ ...f, status: e.target.value || undefined })}>
          {["", "new", "reviewing", "bidding", "submitted", "won", "lost"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={f.trade ?? ""} onChange={(e) => setF({ ...f, trade: e.target.value || undefined })}>
          {["", "HVAC", "Plumbing", "Fire", "Electrical"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <input placeholder="search" value={f.q ?? ""} onChange={(e) => setF({ ...f, q: e.target.value || undefined })} />
        <span>{view.total.toLocaleString()} bids</span>
      </div>
      <Table rows={view.rows} />
    </>
  );
}

const FILTERS: Filter[] = [{ status: "won" }, { trade: "HVAC" }, { q: "harbor" }, { status: "bidding", trade: "Fire" }, { q: "tu" }, {}];
const pct = (xs: number[], p: number) => +[...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))].toFixed(1);

async function bench() {
  await waitFor((v) => v.forKey !== null && v.rows.length > 0);
  const readyMs = performance.now();

  const filterMs: number[] = [];
  for (let round = 0; round < 4; round++)
    for (const f of FILTERS) {
      const key = keyOf(f), t = performance.now();
      const done = waitFor((v) => v.forKey === key);
      setFilterExternal(f);
      await done;
      filterMs.push(performance.now() - t);
    }

  // Live updates: write through the API, time until the new name is on screen.
  const liveMs: number[] = [];
  for (let i = 0; i < 5; i++) {
    const name = `Live ${variant} ${Date.now()}`;
    const t = performance.now();
    const done = waitFor((v) => v.rows.some((b) => b.name === name));
    await rpc("bids.v1.BidService/UpdateBid", { id: lastView.rows[0].id, name });
    await done;
    liveMs.push(performance.now() - t);
  }

  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  const result = {
    variant, readyMs: Math.round(readyMs),
    filterP50: pct(filterMs, 0.5), filterP95: pct(filterMs, 0.95),
    liveP50: pct(liveMs, 0.5), liveMax: pct(liveMs, 1),
    heapMB: mem ? Math.round(mem.usedJSHeapSize / 2 ** 20) : null,
  };
  hud.textContent = JSON.stringify(result, null, 1);
  (window as unknown as { __result: unknown }).__result = result;
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })}>
    {variant === "zero" ? (
      <ZeroProvider cacheURL="http://localhost:4848" userID="bench" schema={zeroSchema} kvStore="mem">
        <App />
      </ZeroProvider>
    ) : <App />}
  </QueryClientProvider>,
);
if (q.has("run")) bench().catch((e) => ((window as unknown as { __result: unknown }).__result = { variant, error: String(e) }));

import { useEffect, useMemo, useState } from "react";
import { Replicache } from "replicache";
import { API, Bid, BidsView, Filter, applyFilter, keyOf } from "../types";

// Replicache over our own pull endpoint; /rt pokes trigger a pull. Reads subscribe to a scan of
// every bid, then filter in memory. In-memory store so every run starts cold, like the others.
let rep: Replicache | null = null;
function get() {
  if (rep) return rep;
  rep = new Replicache({ name: "bench", pullURL: `${API}/replicache/pull`, kvStore: "mem", pullInterval: null, mutators: {} });
  const ws = new WebSocket(API.replace("http", "ws") + "/rt");
  ws.onmessage = () => rep!.pull();
  return rep;
}

export function useBids(f: Filter): BidsView {
  const [all, setAll] = useState<Bid[] | null>(null);
  useEffect(() => get().subscribe(
    async (tx) => (await tx.scan({ prefix: "bid/" }).values().toArray()) as unknown as Bid[],
    { onData: (rows) => setAll(rows.length ? rows : null) },
  ), []);
  const key = keyOf(f);
  return useMemo(() => (all ? { ...applyFilter(all, f), forKey: key } : { rows: [], total: 0, forKey: null }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, key]);
}

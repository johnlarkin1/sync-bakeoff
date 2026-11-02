import { createYjsProvider } from "@y-sweet/client";
import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { Bid, BidsView, Filter, applyFilter, keyOf, rpc } from "../types";

// The whole bid list as one Yjs doc (map of id -> bid) synced from a yrs server. A local array
// copy is patched from map events, so a change costs one entry, not a full toJSON().
let started = false;
const listeners = new Set<() => void>();
let rows: Bid[] = [];
let synced = false;

function start() {
  if (started) return;
  started = true;
  const doc = new Y.Doc();
  const bids = doc.getMap<Bid>("bids");
  const index = new Map<string, number>();
  const rebuild = () => {
    rows = Array.from(bids.values());
    rows.forEach((b, i) => index.set(b.id, i));
  };
  bids.observe((e) => {
    if (!synced) return;
    rows = rows.slice();
    for (const k of e.keysChanged) {
      const b = bids.get(k);
      const i = index.get(k);
      if (b && i !== undefined) rows[i] = b;
      else rebuild();
    }
    listeners.forEach((l) => l());
  });
  const provider = createYjsProvider(doc, "bids-co_demo", () => rpc("yrs.v1.YrsService/GetToken", {}));
  provider.on("synced", () => {
    synced = true;
    rebuild();
    listeners.forEach((l) => l());
  });
}

export function useBids(f: Filter): BidsView {
  const [, bump] = useState(0);
  useEffect(() => {
    start();
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  const key = keyOf(f);
  const snapshot = rows;
  return useMemo(() => (synced ? { ...applyFilter(snapshot, f), forKey: key } : { rows: [], total: 0, forKey: null }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot, key, synced]);
}

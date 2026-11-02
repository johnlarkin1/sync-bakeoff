import { makeInMemoryAdapter } from "@livestore/adapter-web";
import { createStorePromise, Events, makeSchema, State } from "@livestore/livestore";
import { Schema } from "@livestore/utils/effect";
import { useEffect, useMemo, useState } from "react";
import { API, Bid, BidsView, COMPANY, Filter, PAGE, keyOf, rpc } from "../types";

// Client-only LiveStore: SQLite in the browser, materialized from events. The bids are imported
// as events from our API and each /rt change becomes an update event. LiveStore's own sync
// backend is not used, so this measures in-browser storage and queries, not its sync.
const bidFields = {
  id: Schema.String, company_id: Schema.String, name: Schema.String, gc: Schema.String,
  location: Schema.String, trade: Schema.String, status: Schema.String, bid_date: Schema.String,
  value_cents: Schema.String, updated_at: Schema.String,
};
const bids = State.SQLite.table({
  name: "bids",
  columns: {
    id: State.SQLite.text({ primaryKey: true }),
    company_id: State.SQLite.text(), name: State.SQLite.text(), gc: State.SQLite.text(),
    location: State.SQLite.text(), trade: State.SQLite.text(), status: State.SQLite.text(),
    bid_date: State.SQLite.text(), value_cents: State.SQLite.text(), updated_at: State.SQLite.text(),
  },
});
const events = {
  bidImported: Events.synced({ name: "bid.imported", schema: Schema.Struct(bidFields) }),
  bidUpdated: Events.synced({ name: "bid.updated", schema: Schema.Struct(bidFields) }),
};
const materializers = State.SQLite.materializers(events, {
  "bid.imported": (b) => bids.insert(b),
  "bid.updated": ({ id, ...rest }) => bids.update(rest).where({ id }),
});
const schema = makeSchema({ state: State.SQLite.makeState({ tables: { bids }, materializers }), events });

type Store = Awaited<ReturnType<typeof createStorePromise<typeof schema>>>;
let store: Store | null = null;
let version = 0;
const listeners = new Set<() => void>();
const notify = () => { version++; listeners.forEach((l) => l()); };

async function start() {
  const s = await createStorePromise({ schema, storeId: "bench", adapter: makeInMemoryAdapter(), disableDevtools: true });
  const { bids: all } = await rpc<{ bids: Bid[] }>("bids.v1.BidService/ListAllBids", { company_id: COMPANY });
  for (let i = 0; i < all.length; i += 2000)
    s.commit(...all.slice(i, i + 2000).map((b) => events.bidImported({ ...b, updated_at: String(b.updated_at) })));
  const ws = new WebSocket(API.replace("http", "ws") + "/rt");
  ws.onmessage = async (m) => {
    const { bid } = await rpc<{ bid: Bid }>("bids.v1.BidService/GetBid", { id: JSON.parse(m.data).id });
    s.commit(events.bidUpdated({ ...bid, updated_at: String(bid.updated_at) }));
    notify();
  };
  store = s;
  notify();
}
let started = false;

function run(f: Filter): { rows: Bid[]; total: number } {
  const where = ["company_id = ?"], args: string[] = [COMPANY];
  if (f.status) where.push("status = ?"), args.push(f.status);
  if (f.trade) where.push("trade = ?"), args.push(f.trade);
  if (f.q) where.push("(name LIKE ? OR gc LIKE ?)"), args.push(`%${f.q}%`, `%${f.q}%`);
  const w = where.join(" AND ");
  const rows = store!.query({ query: `SELECT * FROM bids WHERE ${w} ORDER BY bid_date DESC, id LIMIT ${PAGE}`, bindValues: args }) as Bid[];
  const [{ n }] = store!.query({ query: `SELECT count(*) AS n FROM bids WHERE ${w}`, bindValues: args }) as { n: number }[];
  return { rows, total: n };
}

export function useBids(f: Filter): BidsView {
  const [v, setV] = useState(version);
  useEffect(() => {
    if (!started) { started = true; start(); }
    const l = () => setV(version);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  const key = keyOf(f);
  return useMemo(() => (store ? { ...run(f), forKey: key } : { rows: [], total: 0, forKey: null }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v, key]);
}

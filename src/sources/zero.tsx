import { useQuery } from "@rocicorp/zero/react";
import { useMemo } from "react";
import { queries } from "../zero/queries.ts";
import { Bid, BidsView, Filter, PAGE, keyOf } from "../types";

export function useBids(f: Filter): BidsView {
  const [rows, details] = useQuery(queries.bids.filtered({ status: f.status ?? "", trade: f.trade ?? "", q: f.q ?? "" }));
  const key = keyOf(f);
  return useMemo(() => {
    if (details.type !== "complete" && rows.length === 0) return { rows: [], total: 0, forKey: null };
    const page: Bid[] = rows.slice(0, PAGE).map((r) => ({
      ...r, bid_date: new Date(r.bid_date).toISOString().slice(0, 10), value_cents: String(r.value_cents), updated_at: String(r.updated_at),
    }));
    return { rows: page, total: rows.length, forKey: key };
  }, [rows, details.type, key]);
}

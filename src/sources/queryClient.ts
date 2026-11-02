import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Bid, BidsView, COMPANY, Filter, applyFilter, keyOf, rpc } from "../types";
import { useRtInvalidation } from "./rt";

// Load the tenant's whole list once through Connect, filter in memory. /rt refetches the list.
export function useBids(f: Filter): BidsView {
  useRtInvalidation(useQueryClient());
  const q = useQuery({
    queryKey: ["bids", "all"],
    queryFn: () => rpc<{ bids: Bid[] }>("bids.v1.BidService/ListAllBids", { company_id: COMPANY }),
  });
  const key = keyOf(f);
  return useMemo(() => (q.data ? { ...applyFilter(q.data.bids, f), forKey: key } : { rows: [], total: 0, forKey: null }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.data, key]);
}

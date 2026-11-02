import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bid, BidsView, COMPANY, Filter, PAGE, keyOf, rpc } from "../types";
import { useRtInvalidation } from "./rt";

// Today's RFC plan: every filter change is a Connect round trip; the server filters and pages.
export function useBids(f: Filter): BidsView {
  useRtInvalidation(useQueryClient());
  const key = keyOf(f);
  const q = useQuery({
    queryKey: ["bids", key],
    queryFn: async () => ({ key, ...(await rpc<{ bids: Bid[]; total: number }>("bids.v1.BidService/ListBids", { company_id: COMPANY, filter: f, limit: PAGE })) }),
    placeholderData: keepPreviousData,
  });
  return q.data ? { rows: q.data.bids, total: q.data.total, forKey: q.data.key } : { rows: [], total: 0, forKey: null };
}

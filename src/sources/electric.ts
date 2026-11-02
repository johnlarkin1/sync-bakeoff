import { useShape } from "@electric-sql/react";
import { useMemo } from "react";
import { Bid, BidsView, COMPANY, ELECTRIC, Filter, applyFilter, keyOf } from "../types";

// Electric shape of the tenant's rows streamed from Postgres; filter in memory. Writes still go
// through the API, and changes arrive through the shape's live stream.
export function useBids(f: Filter): BidsView {
  const { data, isLoading } = useShape<Bid & Record<string, string>>({
    url: `${ELECTRIC}/v1/shape`,
    params: { table: "bids", where: `company_id = '${COMPANY}'` },
  });
  const key = keyOf(f);
  return useMemo(() => (isLoading ? { rows: [], total: 0, forKey: null } : { ...applyFilter(data as Bid[], f), forKey: key }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, isLoading, key]);
}

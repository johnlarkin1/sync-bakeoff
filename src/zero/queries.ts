import { type ReadonlyJSONValue, defineQueries, defineQuery } from "@rocicorp/zero";
import { zql } from "./schema.ts";

export interface BidFilter { status: string; trade: string; q: string }

// One synced query per filter. Zero answers it from the local store when the rows are already
// there, and keeps it live from zero-cache.
export const queries = defineQueries({
  bids: {
    filtered: defineQuery(({ args: raw }: { args: ReadonlyJSONValue | undefined }) => {
      const args = raw as unknown as BidFilter;
      let q = zql.bids.where("company_id", "co_demo");
      if (args.status) q = q.where("status", args.status);
      if (args.trade) q = q.where("trade", args.trade);
      if (args.q) {
        const like = `%${args.q}%`;
        q = q.where(({ or, cmp }) => or(cmp("name", "ILIKE", like), cmp("gc", "ILIKE", like)));
      }
      return q.orderBy("bid_date", "desc").orderBy("id", "asc");
    }),
  },
});

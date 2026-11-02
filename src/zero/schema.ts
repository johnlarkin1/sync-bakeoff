import { createBuilder, createSchema, number, string, table } from "@rocicorp/zero";

// Zero maps Postgres date/timestamptz/bigint to numbers (epoch ms for dates).
const bids = table("bids")
  .columns({
    id: string(),
    company_id: string(),
    name: string(),
    gc: string(),
    location: string(),
    trade: string(),
    status: string(),
    bid_date: number(),
    value_cents: number(),
    updated_at: number(),
  })
  .primaryKey("id");

export const schema = createSchema({ tables: [bids] });
export const zql = createBuilder(schema);

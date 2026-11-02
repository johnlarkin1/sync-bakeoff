// Connect-style JSON API (POST /<service>/<method>) plus an /rt WebSocket that pushes
// invalidations, standing in for main-backend + realtime-events in the web app RFC.
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import postgres from "postgres";
import { WebSocketServer } from "ws";

const sql = postgres("postgres://postgres:bakeoff@localhost:54329/bakeoff", { max: 10 });
const PORT = Number(process.env.PORT ?? 8787);
const COLS = sql`id, company_id, name, gc, location, trade, status, bid_date::text, value_cents::text, updated_at`;

function where(company, f = {}) {
  const parts = [sql`company_id = ${company}`];
  if (f.status) parts.push(sql`status = ${f.status}`);
  if (f.trade) parts.push(sql`trade = ${f.trade}`);
  if (f.q) parts.push(sql`(name ILIKE ${"%" + f.q + "%"} OR gc ILIKE ${"%" + f.q + "%"})`);
  return parts.reduce((a, p, i) => (i ? sql`${a} AND ${p}` : p));
}

const methods = {
  // Server-side filter + sort, first page only (what the UI shows above the fold).
  "bids.v1.BidService/ListBids": async ({ company_id, filter, limit = 100 }) => {
    const w = where(company_id, filter);
    const [rows, [{ n }]] = await Promise.all([
      sql`SELECT ${COLS} FROM bids WHERE ${w} ORDER BY bid_date DESC, id LIMIT ${limit}`,
      sql`SELECT count(*)::int AS n FROM bids WHERE ${w}`,
    ]);
    return { bids: rows, total: n };
  },
  // Whole tenant list, for client-side filtering.
  "bids.v1.BidService/ListAllBids": async ({ company_id }) => ({
    bids: await sql`SELECT ${COLS} FROM bids WHERE company_id = ${company_id} ORDER BY bid_date DESC, id`,
  }),
  "bids.v1.BidService/UpdateBid": async ({ id, name, status }) => {
    const [row] = await sql`UPDATE bids SET name = coalesce(${name ?? null}, name), status = coalesce(${status ?? null}, status),
      updated_at = now() WHERE id = ${id} RETURNING ${COLS}`;
    broadcast({ type: "bid.updated", company_id: row.company_id, id, version: row.updated_at });
    return { bid: row };
  },
};

const server = createServer(async (req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") return res.end();
  const fn = methods[req.url.slice(1)];
  if (req.method !== "POST" || !fn) return (res.statusCode = 404), res.end();
  let body = "";
  for await (const c of req) body += c;
  try {
    const out = await fn(JSON.parse(body || "{}"));
    res.setHeader("content-type", "application/json");
    // Connect servers gzip when the client accepts it; match that so byte counts are fair.
    const json = JSON.stringify(out);
    if (/gzip/.test(req.headers["accept-encoding"] ?? "") && json.length > 1024) {
      res.setHeader("content-encoding", "gzip");
      return res.end(gzipSync(json));
    }
    res.end(json);
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ code: "internal", message: String(e) }));
  }
});

const wss = new WebSocketServer({ server, path: "/rt" });
function broadcast(ev) {
  const msg = JSON.stringify(ev);
  for (const c of wss.clients) c.send(msg);
}

server.listen(PORT, () => console.log(`api on :${PORT}`));

# sync-bakeoff

How should a takeoff web app keep list data (a Bid Board of ~50k bids) in the browser? This repo compares fetching through an API against local-first sync engines and a CRDT, on the same table UI and the same synthetic data.

All data is synthetic. No customer data belongs in this repo.

## The question

The current plan is TanStack Query over Connect APIs, with a realtime socket that invalidates queries. Sync engines promise instant filtering, live updates without invalidation plumbing, and offline reads. This measures what that is worth and what it costs (first load, memory, bytes, moving parts).

## Variants

| Variant | Reads | Writes | Live updates | Status |
| --- | --- | --- | --- | --- |
| `query-server` | Connect-style RPC per filter change; server filters and pages | RPC | `/rt` WebSocket invalidates queries | done |
| `query-client` | one RPC for the tenant's whole list; filter in memory | RPC | `/rt` invalidates, list refetched | done |
| `electric` | Electric shape streamed from Postgres; filter in memory | RPC | shape live stream | done |
| `zero` | Zero client store synced from Postgres via zero-cache | Zero mutators | built in | planned |
| `replicache` | Replicache store over our push/pull endpoints | Replicache mutators | poke + pull | planned |
| `livestore` | LiveStore (SQLite in the browser, event log) | events | sync backend | planned |
| `yrs` | one Yjs doc holding the bids, served by a yrs server | doc updates | CRDT sync | planned |

## Setup

- Postgres 17 with logical replication, ~50k bids for `co_demo` and ~5.5k for a second tenant (`db/init.sql`, deterministic seed). Every variant reads only `co_demo`.
- Electric 1.8.1 in Docker.
- `server/api.mjs`: Connect-style JSON API (`POST /bids.v1.BidService/<Method>`, gzip) and an `/rt` WebSocket.
- `src/`: one React app. A shared virtualized table, and one `useBids(filter)` hook per variant in `src/sources/`.

## Metrics

Per variant, in a fresh Chrome page (1440 × 900), optionally with CDP CPU throttling:

- **first rows ms**: navigation to the first rows on screen.
- **filter p50/p95 ms**: 24 filter changes (status, trade, text search, cleared); time from the change to the matching rows painted. The floor is one frame (~16.7 ms).
- **live update p50/max ms**: five writes through the API to the top visible bid; time until the new name is on screen.
- **heap MB**: JS heap at the end of the run.
- **transfer KB**: bytes for data over the network (API, Electric, sockets), not the app bundle.

## Running

```bash
docker compose up -d
npm install
npm run server        # API on :8787 (the bench starts its own)
npm run dev           # http://localhost:5173/?v=electric
npm run bench         # writes results/results.md
node bench/run.mjs --variants electric --throttle 1 --reps 1
```

## Caveats

- Postgres, Electric and the API run on the same machine as the browser, so network latency is near zero. Server-side filtering looks better here than it will over a real network; a latency-shaping option is a TODO.
- One tenant, one user. No auth or row-level security in any variant yet, which flatters the sync engines (their permission models are part of the real cost).
- Writes come from the API for every variant, to model "someone else changed a bid".

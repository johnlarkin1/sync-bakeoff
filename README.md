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
| `zero` | one Zero synced query per filter, answered from the local store, replicated by zero-cache | API (mutators not used) | zero-cache replication | done |
| `replicache` | Replicache store over our pull endpoint (global-version cookie) | API (push not implemented) | `/rt` poke → pull | done |
| `livestore` | LiveStore client-only: SQLite in the browser, materialized from events the client commits (bids imported from the API) | API, then an update event | `/rt` → fetch bid → event | done (its sync backend is not used) |
| `yrs` | one Yjs doc (map of id → bid) on a y-sweet (yrs) server, seeded from Postgres | API, mirrored into the doc as a Yjs update | CRDT sync | done |

## Results (2026-11-01, Apple M5 Pro, 80 ms added latency per request)

Medians of 3 runs after one unrecorded warm-up, fresh servers per variant. Full table: [results/results.md](results/results.md).

| variant | CPU throttle | first rows ms | filter p50 ms | filter p95 ms | live update p50 ms | live update max ms | heap MB | transfer KB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| query-server | 1× | 342 | 16.8 | 100.4 | 100.1 | 101.7 | 9 | 33 |
| query-client | 1× | 628 | 16.7 | 17.5 | 402.3 | 713.7 | 52 | 5258 |
| electric | 1× | 661 | 16.7 | 17.2 | 85.5 | 87.2 | 77 | 17682 |
| yrs | 1× | 944 | 16.6 | 16.9 | 85 | 86.8 | 82 | 16969 |
| zero | 1× | 2136 | 33.3 | 35.3 | 87.9 | 250.6 | 43 | 17522 |
| replicache | 1× | 714 | 16.7 | 17.5 | 114.6 | 116.8 | 50 | 1150 |
| livestore | 1× | 4328 | 19.8 | 51.1 | 122.1 | 141.6 | 215 | 881 |
| query-server | 4× | 540 | 17 | 110.4 | 100.1 | 100.8 | 9 | 33 |
| query-client | 4× | 814 | 18.2 | 33.8 | 455.8 | 487.3 | 52 | 5258 |
| electric | 4× | 1771 | 32.4 | 44.3 | 87.2 | 99.5 | 89 | 17720 |
| yrs | 4× | 2942 | 53.6 | 83.7 | 138.6 | 251.6 | 85 | 16969 |
| zero | 4× | 10460 | 155 | 258.8 | 86.9 | 105.8 | 73 | 17522 |
| replicache | 4× | 2781 | 32.7 | 47.5 | 206.1 | 238.7 | 68 | 1150 |
| livestore | 4× | 22141 | 187.3 | 401.2 | 428.6 | 495.4 | 186 | 881 |

### What it shows

- **Server filtering (today's plan) wins first load, memory and bytes**, and its live updates (one invalidation plus a round trip, ~100 ms) are close to the sync engines (~85 ms). Its cost is one round trip on every new filter: p95 ~100–110 ms at 80 ms latency, where the local variants stay at one frame.
- **Electric is the strongest sync option here**: about 2× slower first load than server filtering, filters at one or two frames even at 4× CPU, and the fastest live updates. Its 17 MB is uncompressed on localhost; behind a CDN it would be gzipped.
- **yrs keeps up at 1× CPU** (filters at one frame, live updates 85 ms), but falls behind at 4× (first rows 2.9 s, filter p95 84 ms). One CRDT doc for list data works, but it is not cheaper than a row-sync engine.
- **Zero's per-filter synced queries are slow on a throttled CPU** in this setup (first rows 10.5 s, filter p95 259 ms at 4×). The client re-runs ILIKE queries over 50k rows; a narrower query design may do better.
- **Replicache** is solid (filters at one or two frames, 1.1 MB gzipped), but we wrote the pull server ourselves, and it is in maintenance mode in favor of Zero.
- **LiveStore (client-only)** is the heaviest: ~200 MB heap and 22 s to first rows at 4×, mostly from importing 50k events into in-browser SQLite. Not a fit for list data synced from Postgres.

### Not measured yet

Auth and row-level security per variant (their permission models are part of the real cost), bandwidth limits (everything is localhost), many concurrent users, offline and reconnect, and writes through each engine's own mutators.

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

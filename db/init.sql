-- Synthetic Bid Board rows. Deterministic: same seed, same data.
CREATE TABLE bids (
  id          text PRIMARY KEY,
  company_id  text NOT NULL,
  name        text NOT NULL,
  gc          text NOT NULL,
  location    text NOT NULL,
  trade       text NOT NULL,
  status      text NOT NULL,
  bid_date    date NOT NULL,
  value_cents bigint NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bids_company_date ON bids (company_id, bid_date DESC);

SELECT setseed(0.42);
INSERT INTO bids
SELECT
  'bid_' || lpad(g::text, 6, '0'),
  CASE WHEN g % 10 = 0 THEN 'co_other' ELSE 'co_demo' END,
  (ARRAY['Riverside','Oak Park','Harbor','Summit','Lakeview','Westgate','Pine Ridge','Elm Street'])[1 + (random()*7)::int]
    || ' ' || (ARRAY['Medical Center','High School','Office Tower','Warehouse','Library','Lab Building','Hotel','Retail'])[1 + (random()*7)::int]
    || ' Ph ' || (1 + (random()*3)::int),
  (ARRAY['Turner','Skanska','Whiting-Turner','Clark','Gilbane','Suffolk','Hensel Phelps','DPR'])[1 + (random()*7)::int],
  (ARRAY['Boston','Chicago','Denver','Austin','Seattle','Atlanta','Phoenix','Newark'])[1 + (random()*7)::int],
  (ARRAY['HVAC','Plumbing','Fire','Electrical'])[1 + (random()*3)::int],
  (ARRAY['new','reviewing','bidding','submitted','won','lost'])[1 + (random()*5)::int],
  date '2026-01-01' + (random()*540)::int,
  (50000 + random()*5000000)::bigint * 100,
  now()
FROM generate_series(1, 55556) g;  -- ~50k for co_demo, ~5.5k for another tenant

// Runs each variant in a fresh Chrome page against docker compose + the API server.
// Usage: node bench/run.mjs [--variants a,b] [--throttle 1,4] [--reps 3]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i === -1 ? d : process.argv[i + 1]; };
const variants = arg("variants", "query-server,query-client,electric,yrs").split(",");
const throttles = arg("throttle", "1,4").split(",").map(Number);
const reps = Number(arg("reps", "3"));
const latency = Number(arg("latency", "0")); // added round-trip ms, via CDP network emulation

const procs = [
  spawn("npx", ["y-sweet", "serve", "--port", "8090"], { stdio: "ignore", detached: true }),
  spawn("node", ["server/api.mjs"], { stdio: "ignore", detached: true }),
  spawn("npx", ["vite", "preview", "--port", "4174", "--strictPort"], { stdio: "ignore", detached: true }),
];
await new Promise((r) => setTimeout(r, 2000));
const browser = await chromium.launch({ channel: "chrome" });
const runs = [];
try {
  for (const throttle of throttles)
    for (const v of variants)
      for (let rep = 0; rep < reps; rep++) {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await ctx.newPage();
        const cdp = await ctx.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
        // Bytes over the wire for data (API + Electric), excluding the app bundle on :4174.
        let bytes = 0;
        const urls = new Map();
        await cdp.send("Network.enable");
        if (latency) await cdp.send("Network.emulateNetworkConditions", { offline: false, latency, downloadThroughput: -1, uploadThroughput: -1 });
        cdp.on("Network.requestWillBeSent", (e) => urls.set(e.requestId, e.request.url));
        cdp.on("Network.loadingFinished", (e) => { if (!urls.get(e.requestId)?.includes(":4174")) bytes += e.encodedDataLength; });
        cdp.on("Network.webSocketFrameReceived", (e) => { bytes += e.response.payloadData.length; });
        await page.goto(`http://localhost:4174/?v=${v}&run=1`);
        const res = await page.waitForFunction(() => window.__result, null, { timeout: 180_000 }).then((h) => h.jsonValue());
        await ctx.close();
        const row = { ...res, transferKB: Math.round(bytes / 1024), throttle, latency, rep };
        runs.push(row);
        console.log(JSON.stringify(row));
      }
} finally {
  await browser.close();
  for (const p of procs) process.kill(-p.pid); // whole group: npx leaves its child running otherwise
}
mkdirSync("results", { recursive: true });
writeFileSync("results/results.raw.json", JSON.stringify(runs, null, 1));
const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const keys = ["readyMs", "filterP50", "filterP95", "liveP50", "liveMax", "heapMB", "transferKB"];
const rows = [];
for (const throttle of throttles)
  for (const v of variants) {
    const rs = runs.filter((r) => r.variant === v && r.throttle === throttle && !r.error);
    if (rs.length) rows.push({ variant: v, throttle, ...Object.fromEntries(keys.map((k) => [k, med(rs.map((r) => r[k]))])) });
  }
writeFileSync("results/results.json", JSON.stringify(rows, null, 1));
writeFileSync("results/results.md", [
  `Added latency: ${latency} ms per request (CDP emulation; applies to HTTP, not WebSocket frames).`, "",
  "| variant | CPU throttle | first rows ms | filter p50 ms | filter p95 ms | live update p50 ms | live update max ms | heap MB | transfer KB |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((r) => `| ${r.variant} | ${r.throttle}× | ${keys.map((k) => r[k]).join(" | ")} |`),
].join("\n") + "\n");
console.log("wrote results/results.md");

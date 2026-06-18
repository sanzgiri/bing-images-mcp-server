# Hosting notes

A record of what we tried when trying to deploy this app to the cloud, what
worked, what didn't, and how we landed on the **Fly.io + Vercel** combo that
powers the live demo at https://bing-images-mcp-server.vercel.app.

## TL;DR

| Path | Status | Image source | Archive depth | Quiz grounding |
|---|---|---|---|---|
| **Fly.io MCP server + Vercel web app** | ✅ **Current live setup** | Peapix via Fly | Full (years) | Rich |
| Local (laptop) | ✅ Best for dev | Peapix direct | Full (years) | Rich |
| Vercel only (direct Peapix) | ❌ HTTP 403 | — | — | — |
| Vercel + Render MCP | ❌ HTTP 403 from Render too | — | — | — |
| Vercel only (Bing fallback) | ⚠️ Degraded | Bing's `HPImageArchive` | Last 8 days | Title + credit only |

The current deploy uses **all four sources** in a fallback chain (Fly→Bing→Peapix→HTML), so even if Fly is asleep or removed, the app still renders — just with reduced data quality.

---

## What we observed

### 1. Local development → Peapix works fine

From a residential IP, both `https://peapix.com/bing/feed?country=us` and
`https://peapix.com/bing/us` return **HTTP 200** with the full content. The
MCP server scrapes them happily.

```
$ curl -o /dev/null -w "%{http_code}\n" https://peapix.com/bing/us
200
```

### 2. Vercel deployment → Peapix returns 403

After deploying the Next.js web app to Vercel, page loads showed:

```
Failed to fetch https://peapix.com/bing/us: HTTP 403
```

Vercel's serverless functions run on a known pool of egress IPs (their
edge / functions infrastructure). Many sites — Peapix included — block these
IP ranges to prevent scraping. The block is **per-IP**, not per-account or
per-user-agent; we tried multiple realistic browser UAs to no effect.

### 3. Render deployment → also 403

We then deployed the FastMCP server to Render's free tier, hoping Render's
IPs would not be on the same blocklist. They are. From inside the deployed
container:

```
$ curl https://bing-images-mcp-server-1.onrender.com/debug/peapix
{
  "feed": { "url": "https://peapix.com/bing/feed?country=us", "status": 403, ... },
  "html": { "url": "https://peapix.com/bing/us",              "status": 403, ... }
}
```

The 5.5 KB response body is Peapix's "blocked" page, not the data we wanted.

### 4. Bing's own API works from everywhere

Microsoft serves an undocumented-but-stable JSON API at:

```
https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=en-US
```

This returns the last 8 days of images for a given market (`mkt`). It's
served by Microsoft itself, so it never blocks anyone. We wired it in as
the **secondary source** for cloud deployments and it solves the "image
won't load at all" problem — but with two limitations:

- **Only the last ~8 days** are available (vs Peapix's multi-year archive).
- **No long-form story.** Bing only returns the title and photographer
  credit. The quiz then has less material to ground on, and questions
  lean more on the model's general knowledge.

### 5. Fly.io deployment — the winning combo 🎯

Fly.io runs on its own infrastructure (mostly Equinix Metal hardware, ASN
54994), distinct from the AWS/GCP/Azure pool that powers Vercel, Render,
and most other PaaS hosts. We bet that Peapix's blocklist would not
include Fly's range — and we were right:

```
$ curl https://bing-images-mcp.fly.dev/debug/peapix
{
  "feed": { "url": "https://peapix.com/bing/feed?country=us", "status": 200, "ok": true, "bytes": 2906 },
  "html": { "url": "https://peapix.com/bing/us",              "status": 200, "ok": true, "bytes": 90872 }
}
```

Full 200 OK, both the JSON feed and the HTML pages. The MCP server now
lives on Fly and serves the full Peapix archive to the Vercel-hosted web
app. ~500ms latency end-to-end (Vercel → Fly → Peapix → back).

Deploy is dead simple:

```bash
brew install flyctl
fly auth signup            # no card required for the free tier
fly launch --copy-config --no-deploy
fly deploy
```

The bundled `fly.toml` keeps one machine always warm (`min_machines_running = 1`)
so first-request latency is consistently <500ms instead of a 3-10s cold start.
Well within Fly's free allowance (~720h/mo used out of ~2,300h available).

---

## Why not work around the 403?

Several options exist, but none are great for a hobby/personal project:

### A) Use a residential / rotating proxy (ScraperAPI, ScrapingBee, Bright Data)

Works, but adds:

- Another account + API key to manage.
- A monthly request quota (free tiers are 1k-5k req/mo).
- Per-request latency overhead (200-1000ms).
- Eventual cost if the app ever gets real traffic (~$30/mo and up).

The MCP server already has a clean place to wire this in (`server.py` →
`_http_get`). Add a `SCRAPERAPI_KEY` env var, prepend the proxy URL when
set, ship. Worth it if you really need the cloud deploy.

### B) Static cache via GitHub Actions

A daily workflow runs in GitHub's CI environment (their runners aren't on
Peapix's blocklist), fetches that day's image for each country, commits a
JSON snapshot to `data/` in the repo. Vercel reads from the static file at
request time.

Pros: zero runtime dependency on Peapix, zero proxy cost, the cached
archive grows over time so eventually you have multi-year coverage.

Cons: ~30 min of setup, slightly more moving parts, can only quiz on
*cached* images so the catalog is bounded by however long you've been
running the cron.

### C) Self-host the MCP server somewhere with a non-cloud IP

A Raspberry Pi at home, a friend's VPS, anything with a residential or
small-provider IP. Cheap, but defeats the "click deploy" simplicity that
makes cloud hosting appealing.

---

## Why we chose **Fly.io + Vercel**

For this project — a personal app exploring the Bing wallpaper archive — the
Fly+Vercel combo turned out to be:

- **The most capable.** Full Peapix archive, all 9 countries, rich descriptions
  for quiz grounding. Same data as running locally.
- **Free.** Both Fly's free allowance and Vercel's hobby tier cover this
  comfortably; no card required.
- **Fast.** ~500ms end-to-end with the always-warm Fly machine.
- **Resilient.** Three-layer fallback (Fly → Bing → Peapix direct) means the
  site keeps rendering even if Fly goes down or is removed entirely.

If you'd rather not deal with Fly, the **Bing-only fallback path** already works
on Vercel alone — you just lose the long-form descriptions and the ability to
request images older than ~8 days.

---

## If you want to deploy: what's in the repo

The repo ships with everything for the **Fly + Vercel** combo:

- **`Dockerfile`** honors `$PORT` (Fly uses `8080`, Render used `10000`).
- **`fly.toml`** wires `internal_port = 8080`, `healthCheckPath = /healthz`,
  always-warm sizing, and Fly's request-based concurrency controls.
- **`render.yaml`** is kept as a reference for the failed Render attempt.
- The web app's `/api/bing-image` route tries sources in this order:
  1. MCP server (via `MCP_SERVER_URL`) — Fly path, gives full Peapix data.
  2. Bing's `HPImageArchive` feed — last 8 days, no descriptions, always works.
  3. Peapix JSON feed directly — works locally, 403 on Vercel.
  4. Peapix HTML scraper — last resort.
- The MCP server has a **`/debug/peapix` endpoint** for confirming reachability
  from any new host before wasting time wiring it up. Useful when trying
  a different cloud provider.

Step-by-step deploy guide: [`../DEPLOYMENT.md`](../DEPLOYMENT.md).

---

## Date observed

These notes reflect behavior as of **June 2026**. Peapix's bot policy and
Bing's API both change occasionally — re-run `/debug/peapix` against any
new host to verify before assuming the same outcome.

# Hosting notes

A record of what we tried when trying to deploy this app to the cloud, what
worked, what didn't, and why **local-first is the default recommendation**.

## TL;DR

| Path | Status | Image source | Archive depth | Quiz grounding |
|---|---|---|---|---|
| **Local (laptop)** | ✅ Best | Peapix direct | Full (years) | Rich |
| **Vercel only** | ⚠️ Works, degraded | Bing's `HPImageArchive` API | Last 8 days | Title + credit only |
| **Vercel + MCP server on Render** | ❌ Same 403 from Render | — | — | — |
| **Vercel + MCP server on Render + proxy** | 💸 Works, costs money | Peapix via residential proxy | Full | Rich |
| **Static cache to repo via GitHub Actions** | 🛠️ Untried, would work | Peapix once a day from GitHub Actions runner | Grows over time | Rich |

If you don't need cloud access, **stop here and use `./run_local.sh`** — you get
the best experience for free.

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
the **primary source** for cloud deployments and it solves the "image
won't load at all" problem — but with two limitations:

- **Only the last ~8 days** are available (vs Peapix's multi-year archive).
- **No long-form story.** Bing only returns the title and photographer
  credit. The quiz then has less material to ground on, and questions
  lean more on the model's general knowledge.

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

## Why we chose **Path C → run local**

For this project — a personal app exploring the Bing wallpaper archive —
the local experience is:

- **The most fun.** Full archive, instant responses, no quotas.
- **Already complete.** No additional code, accounts, or money required.
- **Privacy-respecting.** Your OpenAI key never leaves your machine.

The `./run_local.sh` script makes it one command. The cloud version still
works for showing off to friends; it just falls back to Bing's smaller feed.

---

## If you do want to deploy: what's already in place

The repo is set up so a future cloud deploy "just works" when you supply
a working data source:

- `Dockerfile` honors `$PORT` (Render uses `10000`).
- `render.yaml` wires `healthCheckPath: /healthz`.
- The web app's `/api/bing-image` tries sources in this order:
  1. MCP server (via `MCP_SERVER_URL`) — if you've hooked it up to a proxy
  2. Bing's `HPImageArchive` feed (always works, last 8 days)
  3. Peapix JSON feed directly (works locally, 403 on Vercel)
  4. Peapix HTML scraper (last resort)
- The MCP server has a `/debug/peapix` endpoint for confirming reachability
  from any new host before wasting time wiring it up.

Drop in a proxy and uncomment the relevant lines in `server.py` (left as
an exercise — start by setting `httpx.Client(proxy=...)`), redeploy, and
it works.

---

## Date observed

These notes reflect behavior as of **June 2026**. Peapix's bot policy and
Bing's API both change occasionally — re-run `/debug/peapix` against any
new host to verify before assuming the same outcome.

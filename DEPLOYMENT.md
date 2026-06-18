# Deployment guide

This project has **two deployable pieces**:

1. **MCP server** (`server.py` + `main.py`) — Python/FastMCP exposed over SSE plus plain HTTP shortcuts. Deployed to **Fly.io**.
2. **Web app** (`web-app/`) — Next.js UI with image viewer, AI chat, and AI quiz. Deployed to **Vercel**.

Why this split? Peapix blocks Vercel's serverless egress IPs (HTTP 403). Fly.io's IPs aren't on the same blocklists, so we use Fly as a proxy that the Vercel web app calls into. See [`docs/HOSTING_NOTES.md`](docs/HOSTING_NOTES.md) for the full story.

---

## Live URLs

| Component | URL |
|---|---|
| Web app | https://bing-images-mcp-server.vercel.app |
| MCP server | https://bing-images-mcp.fly.dev |

Quick health checks:

```bash
curl https://bing-images-mcp.fly.dev/healthz             # → "ok"
curl https://bing-images-mcp.fly.dev/debug/peapix        # → both feed and html: status 200
curl https://bing-images-mcp.fly.dev/image/latest?country=us
```

---

## 1. Deploy the MCP server to Fly.io

### One-time setup

```bash
brew install flyctl                      # macOS; see https://fly.io/docs/hands-on/install-flyctl/
fly auth signup                          # opens browser, GitHub OAuth, no card required
```

### Deploy

From the repo root:

```bash
fly launch --copy-config --no-deploy     # accepts the bundled fly.toml
fly deploy
```

`fly launch` asks a few questions:
- App name → say no to change, or pick a unique name if `bing-images-mcp` is taken.
- Region → defaults to whatever's closest. Override with `--region iad` (Ashburn, VA) etc.
- Postgres / Upstash / Tigris → **no** to all.

`fly deploy` builds the Dockerfile remotely (~3–5 min first time) and rolls out a single machine.

### Verify

```bash
fly status
# Look for a machine with state=started, listening on internal_port 8080.

URL="https://$(fly status --json | jq -r .Hostname)"
curl $URL/healthz
curl $URL/debug/peapix    # critical: both `feed` and `html` should be status 200
curl "$URL/image/latest?country=us"
```

If `/debug/peapix` shows `403` for both, your region's IPs are blocked. Try another region:

```bash
fly regions add fra        # Frankfurt
fly regions remove iad     # if you want to move entirely
fly deploy
```

### Config notes

`fly.toml` keeps **1 machine always running** so the first request has no cold-start delay. This sits comfortably in Fly's free allowance (~720 hours/mo of shared-cpu-1x time, well under the ~2,300 free hours). To scale to zero instead:

```toml
min_machines_running = 0
```

---

## 2. Deploy the web app to Vercel

### Via the dashboard

1. Push the repo to GitHub.
2. In [Vercel](https://vercel.com/new), import the repo.
3. **Set Root Directory** → `web-app/`.
4. Framework preset: **Next.js** (auto-detected).
5. Environment variables (Settings → Environment Variables):
   - `OPENAI_API_KEY` — required (chat + quiz).
   - `MCP_SERVER_URL` — set to your Fly URL (e.g. `https://bing-images-mcp.fly.dev`). Without this, the app falls back to Bing's 8-day feed and loses the long descriptions.
6. Click **Deploy**.

`vercel.json` in `web-app/` pins `maxDuration=30s` for the AI routes.

### Via the CLI

```bash
cd web-app
npx vercel              # first run: links project, asks for settings
# Add env vars in the dashboard, or:
npx vercel env add OPENAI_API_KEY production
npx vercel env add MCP_SERVER_URL production
npx vercel --prod
```

---

## 3. Verify the full chain

```bash
curl -s 'https://<your-vercel-url>/api/bing-image?country=us' | head -c 300
```

You should see:
- `"image_url":"https://img.peapix.com/..."` (note: **peapix.com**, not bing.com — confirms Fly path is winning)
- `"full_description":"..."` with multiple paragraphs of context

If you see `bing.com` URLs or `"full_description":null`, the Fly path failed and the Bing fallback kicked in. Check:
- `MCP_SERVER_URL` env var on Vercel is correct (no trailing slash)
- Fly machine is running: `fly status`
- Fly can still reach Peapix: `curl https://<fly-url>/debug/peapix`

---

## Local development

```bash
# One terminal, both services
./run_local.sh
```

Or two terminals manually:

```bash
# Terminal 1: MCP server
uv run main.py

# Terminal 2: web app
cd web-app
cp .env.local.example .env.local        # if you create one; else add OPENAI_API_KEY manually
npm install
MCP_SERVER_URL=http://localhost:8080 npm run dev
```

---

## ⚠️ Security note

`.gitignore` excludes `.env*` files. If you ever committed a real `OPENAI_API_KEY` to the repo (even in `.env.local`), **rotate it immediately** in your OpenAI dashboard. Treat anything pushed to GitHub as compromised.

---

## Other hosts we considered

| Host | Status | Notes |
|---|---|---|
| **Fly.io** | ✅ Works | Current choice. Free tier comfortable for this workload. |
| Render | ❌ Peapix returns 403 | IPs on the same blocklist as AWS |
| Vercel (direct) | ❌ Peapix returns 403 | Same blocklist |
| Netlify | Untested | Likely same as Vercel (built on AWS) |
| Cloudflare Tunnel from laptop | ✅ Works | Best for "always-on-while-laptop-is" scenarios |
| Static cache via GitHub Actions | ✅ Would work | Most setup, but archive grows over time |
| Cheap VPS (Hetzner, Vultr) | ✅ Would work | ~$5/mo, manual ops |
| Residential proxy (ScraperAPI etc.) | ✅ Would work | Adds account + per-request cost |

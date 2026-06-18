# Bing Image Quiz

A small full-stack app that:

1. Pulls the **Bing Image of the Day** (and the full historical archive) from [Peapix](https://peapix.com).
2. Shows the image full-bleed with title and description.
3. Lets you **chat about the image** with an LLM.
4. Generates an **AI quiz** about the image: 5 multiple-choice questions in 8 different "flavors" (trivia, what-if, sensory, lateral thinking, mystery, ...) with explanations and fun facts.

**🚀 Live demo:** https://bing-images-mcp-server.vercel.app

---

## Architecture

```
                                                            (rich Peapix data)
┌──────────────────┐   HTTP   ┌────────────────────┐   HTTP   ┌─────────────┐
│  Browser         │ ───────▶ │  Next.js (Vercel)  │ ───────▶ │  Fly.io     │
│  vercel.app      │          │  /api/bing-image   │          │  MCP server │ ──▶ peapix.com
└──────────────────┘          │  /api/quiz /chat   │          │  fly.dev    │
                              └────────────────────┘          └─────────────┘
                                       │
                                       ▼
                                  OpenAI API
                            (gpt-4o for chat,
                             gpt-4o-mini for quiz)
```

Three deployable pieces:

| Piece | Stack | Hosted on | Lives in |
|---|---|---|---|
| **Web app** | Next.js 16 · Tailwind 4 · Vercel AI SDK | Vercel | `web-app/` |
| **MCP server** | Python · FastMCP · Starlette · httpx | Fly.io | repo root |
| **LLM** | OpenAI `gpt-4o` / `gpt-4o-mini` | api.openai.com | — |

**Why Fly?** Peapix returns HTTP 403 to traffic from Vercel and Render IP ranges (they're on commercial scraper blocklists). Fly.io runs on its own infrastructure and *isn't* on those lists. We confirmed with a `/debug/peapix` endpoint that Fly's IPs can reach Peapix normally, while Render and direct-from-Vercel both failed the same probe. Full story in [`docs/HOSTING_NOTES.md`](docs/HOSTING_NOTES.md).

The MCP server also exposes plain HTTP shortcuts (`/image/latest`, `/image?date=...`) so the web app can skip the SSE handshake. The same server is still usable from Claude Desktop / MCP Inspector via `/sse`.

---

## Quick start (local)

You need **Python 3.10+** with [`uv`](https://docs.astral.sh/uv/) and **Node 20+**.

```bash
# 1. Clone
git clone https://github.com/sanzgiri/bing-images-mcp-server.git
cd bing-images-mcp-server

# 2. Set your OpenAI key
echo "OPENAI_API_KEY=sk-..." > web-app/.env.local

# 3. Start everything (one terminal)
./run_local.sh
```

Open **http://localhost:3000**.

The script starts the MCP server on `8080` and the web app on `3000`, wired together via `MCP_SERVER_URL`. Press `Ctrl+C` to stop both. It auto-detects busy ports and walks forward to the next free one.

### Manual two-terminal version

```bash
# Terminal 1: MCP server (full Peapix archive)
uv run main.py
# → http://localhost:8080

# Terminal 2: web app
cd web-app
npm install                          # first time only
MCP_SERVER_URL=http://localhost:8080 npm run dev
# → http://localhost:3000
```

---

## Using the app

| What | Where |
|---|---|
| **Today's image** | Loads automatically on page open. |
| **Random image** | Click "Another image" (top-right). Pulls from a random country. |
| **Quiz me** | Pulsing pink button under "Powered by Peapix". 5 MCQs grounded in the image's title + description. |
| **Chat** | Speech-bubble button (bottom-right). Ask anything about the image. |

The quiz uses `gpt-4o-mini` with `generateObject` + a Zod schema, temperature 0.9 for variety. Question flavors include:

- 🧠 Trivia · 🎯 Closest guess · 🔀 Lateral · 💭 What if
- 🎭 Culture · 👁️ Sensory · ⚖️ This or that · 🔍 Mystery

---

## Project layout

```
.
├── server.py              FastMCP server + Peapix scraper
├── main.py                ASGI entrypoint (SSE + HTTP shortcuts + health checks)
├── pyproject.toml / uv.lock
├── Dockerfile             For Fly.io deploy (honors $PORT)
├── fly.toml               Fly.io service config (always-warm, /healthz check)
├── render.yaml            Legacy Render config (kept for reference)
├── run_local.sh           One-command local startup
├── test_server.py         Quick smoke tests
├── docs/
│   └── HOSTING_NOTES.md   What we tried hosting on; why Fly won
└── web-app/               Next.js front-end
    ├── app/
    │   ├── page.tsx                Server component, fetches image
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── api/
    │   │   ├── bing-image/route.ts MCP → Bing → Peapix fallback chain
    │   │   ├── quiz/route.ts       OpenAI structured-object quiz generation
    │   │   └── chat/route.ts       OpenAI streaming chat
    │   └── components/
    │       ├── Quiz.tsx
    │       ├── Chat.tsx
    │       └── ImageInfo.tsx
    ├── lib/mcpClient.ts            Talks to MCP server (HTTP fast path + SSE)
    ├── package.json
    └── README.md
```

---

## Endpoints

### MCP server (`main.py`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Liveness probe (returns `ok`) |
| GET | `/debug/peapix` | Probes Peapix from inside the deployment — confirms IP reachability |
| GET | `/image/latest?country=us` | Latest Bing image for a country (HTTP shortcut) |
| GET | `/image?country=us&date=YYYY-MM-DD` | Specific date (HTTP shortcut) |
| GET | `/sse` | MCP SSE endpoint (for Claude Desktop etc.) |
| POST | `/messages/` | MCP message channel |

Supported `country` codes: `us`, `gb`, `de`, `fr`, `jp`, `au`, `ca`, `cn`, `in`.

### Web app (`web-app/`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | The image + quiz/chat UI |
| GET | `/api/bing-image?country=us[&date=…][&random=true]` | Returns image details JSON |
| POST | `/api/quiz` | Body `{ imageContext }` → 5 MCQs |
| POST | `/api/chat` | Body `{ messages, imageContext }` → streamed chat |

---

## Environment variables

Put these in `web-app/.env.local` for local dev (or in your hosting provider's UI):

| Variable | Required? | Default | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | **Yes** | — | Powers chat + quiz |
| `MCP_SERVER_URL` | Recommended | unset | Route image lookups through the MCP server (full Peapix archive). If unset, falls back to Bing's 8-day feed. |
| `PORT` | No | `3000` (web), `8080` (MCP), `8080` (Docker) | Port to listen on |

---

## Deploying

Full deploy guide: [`DEPLOYMENT.md`](DEPLOYMENT.md). TL;DR:

### MCP server → Fly.io

```bash
brew install flyctl
fly auth signup                          # no card required for the free tier
fly launch --copy-config --no-deploy     # accepts the bundled fly.toml
fly deploy
```

Verify Peapix reachability from your Fly instance:

```bash
curl https://<your-app>.fly.dev/debug/peapix
# expect: {"feed":{"status":200,...},"html":{"status":200,...}}
```

### Web app → Vercel

1. Push the repo to GitHub.
2. Import the repo at https://vercel.com/new.
3. **Root Directory** → `web-app`.
4. Environment variables:
   - `OPENAI_API_KEY` = your key
   - `MCP_SERVER_URL` = `https://<your-app>.fly.dev`
5. Deploy.

---

## Hosting notes — what we learned

| Path | Result | Why |
|---|---|---|
| Web app on Vercel, scraping Peapix directly | ❌ HTTP 403 | Vercel egress IPs on Peapix's bot blocklist |
| MCP server on Render, web app on Vercel | ❌ HTTP 403 | Render IPs also blocked |
| **MCP server on Fly.io**, web app on Vercel | ✅ Works | Fly's own infrastructure isn't on the same blocklists |
| Everything local | ✅ Works | Residential IP, no blocks |

The deployed app also has a **Bing `HPImageArchive` fallback** baked in, so even if the Fly machine is asleep or removed, you still get the last 8 days of images automatically — just without long-form descriptions. Full archive (any date) requires the MCP path.

See [`docs/HOSTING_NOTES.md`](docs/HOSTING_NOTES.md) for the full play-by-play including alternatives we considered (Cloudflare Tunnel, GitHub Actions cache, proxies like ScraperAPI/ScrapingBee).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Failed to fetch https://peapix.com … HTTP 403" | You're on a cloud IP that Peapix blocks. Run locally, or proxy through a Fly.io MCP server (`MCP_SERVER_URL`). |
| "Missing OPENAI_API_KEY" in quiz/chat | Add the key to `web-app/.env.local` (local) or Vercel env vars (deployed) and redeploy. |
| Vercel deploy works but no `full_description` | Fly machine sleeping/unreachable; the Bing fallback kicked in. Check `fly status`, then `fly machines start <id>` if needed. |
| "1 Issue" dev-overlay badge | Usually a stray `package-lock.json` higher up the filesystem. `next.config.ts` pins the Turbopack root. |
| Hydration warning mentioning `data-…-ready` | A browser extension (Scribe, Grammarly, Loom) is injecting an attribute. `<html suppressHydrationWarning>` silences it. |

---

## Credits

- Image data: [Peapix](https://peapix.com) (Bing wallpaper archive).
- Fallback feed: Microsoft's [HPImageArchive](https://www.bing.com/HPImageArchive.aspx) API.
- LLMs: OpenAI `gpt-4o` (chat) and `gpt-4o-mini` (quiz).
- MCP: [Model Context Protocol](https://modelcontextprotocol.io/) + [FastMCP](https://github.com/jlowin/fastmcp).
- Hosting: [Vercel](https://vercel.com) (web) + [Fly.io](https://fly.io) (MCP server).

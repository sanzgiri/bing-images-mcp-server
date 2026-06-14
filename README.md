# Bing Image Quiz

A small full-stack app that:

1. Pulls the **Bing Image of the Day** (and the full historical archive) from [Peapix](https://peapix.com).
2. Shows the image full-bleed with title and description.
3. Lets you **chat about the image** with an LLM.
4. Generates an **AI quiz** about the image: 5 multiple-choice questions in 8 different "flavors" (trivia, what-if, sensory, lateral thinking, mystery, ...) with explanations and fun facts.

> **TL;DR — best experience is local.** See [Quick start](#quick-start). Cloud hosting hits a snag: Peapix blocks most cloud egress IPs (Vercel, Render, etc.) so the deployed app loses access to the full image archive. [Details below.](#hosting-notes--why-local-is-best)

---

## Architecture

```
┌──────────────────────┐        ┌──────────────────────┐        ┌─────────────┐
│  Next.js web app     │        │  FastMCP server      │        │             │
│  (web-app/)          │ HTTP   │  (server.py)         │ HTTPS  │  peapix.com │
│                      │ ─────▶ │                      │ ─────▶ │             │
│  /api/bing-image     │        │  /image/latest       │        │  full       │
│  /api/quiz   /chat   │        │  /image?date=...     │        │  archive    │
└──────────────────────┘        │  /sse  (MCP/SSE)     │        └─────────────┘
                                └──────────────────────┘
        │
        └──── OpenAI API (gpt-4o / gpt-4o-mini for chat + quiz)
```

Two deployable pieces:

| Piece | Stack | Lives in | Default port |
|---|---|---|---|
| **MCP server** | Python · FastMCP · Starlette · httpx | repo root | `8080` |
| **Web app** | Next.js 16 · Tailwind 4 · Vercel AI SDK | `web-app/` | `3000` |

The MCP server **also exposes plain HTTP shortcuts** (`/image/latest`, `/image?date=...`) so the web app can skip the SSE handshake. The same server is still usable from Claude Desktop / MCP Inspector via `/sse`.

---

## Quick start

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

The script starts the MCP server on `8080` and the web app on `3000`, wired together via `MCP_SERVER_URL`. Press `Ctrl+C` to stop both.

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
├── Dockerfile             For optional cloud deploy
├── render.yaml            Render service config (see HOSTING_NOTES.md)
├── run_local.sh           One-command local startup
├── test_server.py         Quick smoke tests
├── docs/
│   └── HOSTING_NOTES.md   Why cloud hosting is hard, what we tried
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
| `PORT` | No | `3000` (web), `8080` (MCP), `10000` (Docker) | Port to listen on |

---

## Hosting notes / why local is best

Short version: **Peapix blocks well-known cloud IP ranges (Vercel, Render, AWS, etc.)**. We confirmed this by deploying to Render and probing `/debug/peapix` — both the JSON feed and HTML pages returned **HTTP 403** to traffic from Render's IPs.

We worked around it in the deployed version by adding **Bing's own `HPImageArchive` API** as a fallback, which works everywhere — but it only exposes the last **~8 days** of images and doesn't include the long-form story used to ground the quiz.

If you want the **full historical archive** (any date, all 9 countries, rich descriptions), **run it locally** from your home IP. Peapix is happy to serve residential traffic.

Full write-up of what we tried and the trade-offs: [`docs/HOSTING_NOTES.md`](docs/HOSTING_NOTES.md).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Failed to fetch https://peapix.com … HTTP 403" | You're on a cloud IP. Run locally, or switch to Bing-only (unset `MCP_SERVER_URL`). |
| "Missing OPENAI_API_KEY" in quiz/chat | Add the key to `web-app/.env.local` and restart `npm run dev`. |
| "1 Issue" badge in dev overlay | Usually a stray `package-lock.json` higher up the filesystem. `next.config.ts` already pins the Turbopack root. |
| Hydration warning mentioning `data-…-ready` | A browser extension (Scribe, Grammarly, Loom) is injecting an attribute. `<html suppressHydrationWarning>` silences it. |
| Quiz button overlaps Next dev badge | Already moved into the header. |

---

## Credits

- Image data: [Peapix](https://peapix.com) (Bing wallpaper archive).
- Fallback feed: Microsoft's [HPImageArchive](https://www.bing.com/HPImageArchive.aspx) API.
- LLMs: OpenAI `gpt-4o` (chat) and `gpt-4o-mini` (quiz).
- MCP: [Model Context Protocol](https://modelcontextprotocol.io/) + [FastMCP](https://github.com/jlowin/fastmcp).

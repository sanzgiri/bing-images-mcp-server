# Bing Image Quiz Web App

A Next.js app that:

- Loads the **Bing Image of the Day** (from Peapix, via an MCP server proxy on Fly.io).
- Offers an **AI chat** to ask questions about the image.
- Generates a **5-question AI quiz** about the image and grades you live.

**Live:** https://bing-images-mcp-server.vercel.app

## Setup

```bash
npm install
```

Create `.env.local`:

```bash
OPENAI_API_KEY=sk-...

# Optional but recommended: route image lookups through the deployed MCP server
# on Fly.io for the full Peapix archive. Without this, the app falls back to
# Bing's HPImageArchive feed (last 8 days, no long descriptions).
MCP_SERVER_URL=https://bing-images-mcp.fly.dev

# Or pointed at your own local MCP server for dev:
# MCP_SERVER_URL=http://localhost:8080
```

```bash
npm run dev
```

## API routes

- `GET /api/bing-image?country=us` — latest image.
- `GET /api/bing-image?country=us&date=2024-06-01` — specific date.
- `GET /api/bing-image?country=us&random=true` — random image from the country's gallery.
- `GET /api/bing-image?randomCountry=true` — random country.
- `POST /api/chat` — streams chat replies grounded on the current image.
- `POST /api/quiz` — body `{ imageContext }`; returns `{ questions: Question[] }` (5 MCQs).

## Fallback chain

`/api/bing-image` tries sources in this order, returning the first one that succeeds:

1. **MCP server** (Fly.io proxy) — full Peapix archive with long-form descriptions.
2. **Bing `HPImageArchive`** — last 8 days, no descriptions, always works.
3. **Peapix JSON feed** directly — works locally, returns 403 on Vercel.
4. **Peapix HTML scraper** — last resort.

This means the site stays up even if the Fly proxy is asleep or removed; it just degrades to the Bing source.

## Deploying

See the project root [`DEPLOYMENT.md`](../DEPLOYMENT.md). TL;DR:
- Front-end → **Vercel** (set root dir to `web-app/`, add `OPENAI_API_KEY` and `MCP_SERVER_URL`).
- MCP server → **Fly.io** (`fly launch && fly deploy` from the repo root).

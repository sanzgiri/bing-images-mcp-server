# Bing Image Quiz Web App

A Next.js app that:

- Loads the **Bing Image of the Day** (from Peapix), optionally through the deployed MCP server.
- Offers an **AI chat** to ask questions about the image.
- Generates a **5-question AI quiz** about the image and grades you live.

## Setup

```bash
npm install
```

Create `.env.local`:

```bash
OPENAI_API_KEY=sk-...
# Optional: route image lookups through the MCP server instead of the bundled scraper.
# MCP_SERVER_URL=https://your-mcp-server.onrender.com
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

## Deploying

See the project root `DEPLOYMENT.md`. TL;DR:
- Front-end → **Vercel** (set root dir to `web-app/`, add `OPENAI_API_KEY`).
- MCP server → **Render** (Dockerfile in repo root).

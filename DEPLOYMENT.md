# Deployment

This project has **two deployable pieces**:

1. **MCP server** (`server.py` + `main.py`) — Python/FastMCP exposed over SSE. Best on **Render** (long-lived HTTP/SSE friendly).
2. **Web app** (`web-app/`) — Next.js UI with image viewer, AI chat, and AI quiz. Best on **Vercel** (zero-config Next.js, serverless functions for the API routes).

---

## 1. Deploy the MCP server to Render

1. Push the repo to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New → Web Service**.
3. Connect the repo, pick the branch.
4. Settings:
   - **Runtime**: Docker
   - **Plan**: Free is fine to start
   - **Environment variable**: `PORT=8080`
5. Deploy. You'll get a URL like `https://bing-images-mcp-server.onrender.com`.

**MCP endpoints**:
- SSE stream: `https://<host>/sse`
- POST messages: `https://<host>/messages`

Test it with any MCP-compatible client (Claude Desktop, MCP Inspector, etc.).

---

## 2. Deploy the web app to Vercel

The web app lives in `web-app/`. The recommended way:

1. Push the repo to GitHub.
2. In [Vercel](https://vercel.com/new), import the repo.
3. **Set the Root Directory** to `web-app/`.
4. Framework preset: **Next.js** (auto-detected).
5. Environment variables (Settings → Environment Variables):
   - `OPENAI_API_KEY` — required (chat + quiz).
   - `MCP_SERVER_URL` — optional. Set to your Render URL (e.g. `https://bing-images-mcp-server.onrender.com`) to route image lookups through the MCP server. If unset, the web app uses its own bundled scraper.
6. Click **Deploy**.

`vercel.json` in `web-app/` pins `maxDuration=30s` for the AI routes.

### Alternative: Netlify
Works too, with the official Next.js plugin. Same env vars. Set the base directory to `web-app`.

### Alternative: Render (web app)
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Same env vars as above.

---

## Local development

```bash
# MCP server
uv run main.py

# Web app
cd web-app
cp .env.local.example .env.local   # if you create one; otherwise add OPENAI_API_KEY manually
npm install
npm run dev
```

To exercise the MCP path locally, also set:
```
MCP_SERVER_URL=http://localhost:8080
```
in `web-app/.env.local` while the Python server is running.

---

## ⚠️ Security note

If you ever committed a real `OPENAI_API_KEY` to the repo (even in `.env.local`),
**rotate it immediately** in your OpenAI dashboard. Treat anything pushed to
GitHub as compromised. `.gitignore` now excludes `.env*` files, but secrets
already in history must be revoked.

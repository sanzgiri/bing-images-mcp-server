# Repository Guidelines

## Project Structure & Module Organization
- `server.py` contains the FastMCP server and core tools (`get_latest_bing_image`, `get_bing_image`).
- `main.py` is the ASGI/SSE entrypoint used by `uvicorn` and Render.
- `test_server.py` holds lightweight, manual smoke checks for the tools.
- `web-app/` contains the Next.js client (`web-app/lib/` for client helpers, `web-app/public/` for assets).
- Deployment/config files live at the root (`Dockerfile`, `render.yaml`, `DEPLOYMENT.md`).

## Build, Test, and Development Commands
- `uv run main.py` starts the MCP server on `PORT` (defaults to 8080). 
- `python main.py` is a direct alternative if you are not using `uv`.
- `python test_server.py` runs basic smoke tests against the tool functions.
- From `web-app/`: `npm install` sets up dependencies, `npm run dev` runs the UI, `npm run build` builds, `npm run start` serves the production build, `npm run lint` runs ESLint.

## Coding Style & Naming Conventions
- Python uses 4-space indentation, `snake_case` functions, and short module names (`server.py`, `main.py`).
- MCP tool names should read as verb + object (e.g., `get_latest_bing_image`).
- Web app code follows Next.js + ESLint defaults; use `PascalCase` for React components and `camelCase` for hooks/variables.

## Testing Guidelines
- There is no formal test framework wired in yet; use `test_server.py` for quick verification.
- Keep tests deterministic; avoid network-heavy checks unless explicitly needed for a change.

## Commit & Pull Request Guidelines
- No Git history exists yet, so no established commit convention is visible.
- Use clear, imperative commit subjects (e.g., "Add SSE error handling") and include context in PR descriptions.

## Security & Configuration Tips
- The web app expects `OPENAI_API_KEY` in `web-app/.env.local`.
- The server reads `PORT` from the environment; avoid hardcoding ports in code or docs.

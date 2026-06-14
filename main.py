"""ASGI entrypoint for the MCP server, plus a couple of HTTP helper routes."""

from __future__ import annotations

import json
import os

import httpx
import uvicorn
from starlette.applications import Starlette
from starlette.responses import JSONResponse, PlainTextResponse
from starlette.routing import Mount, Route

from server import (
    BASE_URL,
    DEFAULT_HEADERS,
    get_bing_image,
    get_latest_bing_image,
    mcp,
)

# The FastMCP server exposed over SSE.
mcp_app = mcp.sse_app()


async def healthz(_request):
    """Simple liveness probe so Render's health check stays green."""
    return PlainTextResponse("ok")


async def debug_peapix(_request):
    """Probe Peapix from inside the deployment.

    Useful to confirm Render's egress IPs are NOT on Peapix's blocklist.
    Returns status codes for both the JSON feed and an HTML page.
    """
    results: dict[str, object] = {}
    async with httpx.AsyncClient(headers=DEFAULT_HEADERS, timeout=10.0) as client:
        for label, url in (
            ("feed", f"{BASE_URL}/bing/feed?country=us"),
            ("html", f"{BASE_URL}/bing/us"),
        ):
            try:
                response = await client.get(url, follow_redirects=True)
                results[label] = {
                    "url": url,
                    "status": response.status_code,
                    "ok": response.is_success,
                    "bytes": len(response.content),
                }
            except Exception as exc:  # pragma: no cover - network failure path
                results[label] = {"url": url, "error": str(exc)}
    return JSONResponse(results)


async def image_latest(request):
    """Plain-HTTP shortcut: GET /image/latest?country=us

    Bypasses the SSE handshake so serverless clients (Vercel) can avoid the
    extra round trip. Returns the same JSON shape the MCP tool returns.
    """
    country = request.query_params.get("country", "us").lower()
    raw = get_latest_bing_image(country)
    return JSONResponse(json.loads(raw))


async def image_by_date(request):
    """GET /image?country=us&date=YYYY-MM-DD"""
    country = request.query_params.get("country", "us").lower()
    date = request.query_params.get("date")
    if not date:
        return JSONResponse({"error": "date is required"}, status_code=400)
    raw = get_bing_image(country, date)
    return JSONResponse(json.loads(raw))


app = Starlette(
    routes=[
        Route("/healthz", healthz),
        Route("/debug/peapix", debug_peapix),
        Route("/image/latest", image_latest),
        Route("/image", image_by_date),
        # The MCP SSE app provides /sse and /messages under its own root.
        Mount("/", app=mcp_app),
    ]
)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)

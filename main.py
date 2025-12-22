import os
from starlette.middleware.trustedhost import TrustedHostMiddleware
from server import mcp
import uvicorn

# Create the SSE app
# This exposes the MCP server as an ASGI application compatible with SSE
app = mcp.sse_app()
allowed_hosts = os.getenv(
    "ALLOWED_HOSTS",
    "localhost,127.0.0.1,*.onrender.com",
).split(",")
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

if __name__ == "__main__":
    # Render expects the server to listen on port 10000 by default, 
    # but we can configure it. Let's use 8080 or the PORT env var.
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)

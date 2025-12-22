import os
from server import mcp
import uvicorn

# Create the SSE app
# This exposes the MCP server as an ASGI application compatible with SSE
app = mcp.sse_app()

if __name__ == "__main__":
    # Render expects the server to listen on port 10000 by default, 
    # but we can configure it. Let's use 8080 or the PORT env var.
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)

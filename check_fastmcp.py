from mcp.server.fastmcp import FastMCP
import inspect

print("FastMCP methods:")
for name, data in inspect.getmembers(FastMCP):
    if not name.startswith('_'):
        print(name)

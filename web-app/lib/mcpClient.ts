/**
 * Client for the deployed FastMCP server.
 *
 * Set `MCP_SERVER_URL` (e.g. https://bing-images-mcp-server.onrender.com)
 * to route image lookups through the MCP server instead of falling back
 * to the bundled scraper / Bing feed.
 *
 * Implementation note: we prefer the plain-HTTP shortcuts exposed by the
 * server (/image/latest, /image?date=...) over the SSE handshake because
 * SSE adds 300-500ms per call on serverless cold starts and risks function
 * timeouts. The MCP/SSE path remains available for non-web clients.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export interface BingImageDetails {
  title: string;
  image_url: string | null;
  description?: string | null;
  full_description?: string | null;
  page_url: string;
}

async function httpFetch(
  path: string,
  params: Record<string, string>
): Promise<BingImageDetails | null> {
  const base = process.env.MCP_SERVER_URL;
  if (!base) return null;
  const url = new URL(path, base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    // Render's free tier can take ~30s to wake up. Give it a long timeout
    // on cold start but not so long that we exhaust the Vercel function.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      console.warn(`MCP HTTP ${path} returned ${response.status}`);
      return null;
    }
    const data = (await response.json()) as BingImageDetails | { error: string };
    if ('error' in data && data.error) {
      console.warn(`MCP HTTP ${path} error:`, data.error);
      return null;
    }
    return data as BingImageDetails;
  } catch (err) {
    console.warn(`MCP HTTP ${path} failed:`, err);
    return null;
  }
}

export async function mcpGetLatestImage(country: string) {
  return httpFetch('/image/latest', { country });
}

export async function mcpGetImage(country: string, date: string) {
  return httpFetch('/image', { country, date });
}

// ---------------------------------------------------------------------------
// Legacy SSE/MCP transport. Not used by the web app's image routes today
// but kept so other clients (Claude Desktop, MCP Inspector) can still use
// the same server, and so we can fall back to it if the HTTP path is ever
// disabled.
// ---------------------------------------------------------------------------
function parseToolResult(result: { content: Array<{ type: string; text?: string }> }):
  | BingImageDetails
  | { error: string } {
  const textPart = result.content.find((part) => part.type === 'text' && part.text);
  if (!textPart?.text) {
    return { error: 'MCP tool returned no text content.' };
  }
  try {
    return JSON.parse(textPart.text);
  } catch (err) {
    return {
      error: `Failed to parse MCP response: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

export async function mcpCallToolOverSse(
  toolName: string,
  args: Record<string, unknown>
): Promise<BingImageDetails | null> {
  const base = process.env.MCP_SERVER_URL;
  if (!base) return null;

  const url = new URL('/sse', base);
  const transport = new SSEClientTransport(url);
  const client = new Client(
    { name: 'bing-image-quiz-web', version: '0.1.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    const result = await client.callTool({ name: toolName, arguments: args });
    const parsed = parseToolResult(
      result as { content: Array<{ type: string; text?: string }> }
    );
    if ('error' in parsed) {
      console.warn('MCP tool error:', parsed.error);
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn('MCP/SSE call failed:', err);
    return null;
  } finally {
    await client.close().catch(() => {});
  }
}

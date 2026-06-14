/**
 * Optional client for talking to the deployed FastMCP server over SSE.
 *
 * Set `MCP_SERVER_URL` (e.g. https://bing-images-mcp-server.onrender.com)
 * to route image lookups through the MCP server instead of the local
 * scraper. If the env var is missing or the call fails, the caller
 * should fall back to the bundled scraper in /api/bing-image.
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

async function callTool(
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
    console.warn('MCP call failed, falling back:', err);
    return null;
  } finally {
    await client.close().catch(() => {});
  }
}

export async function mcpGetLatestImage(country: string) {
  return callTool('get_latest_bing_image', { country });
}

export async function mcpGetImage(country: string, date: string) {
  return callTool('get_bing_image', { country, date });
}

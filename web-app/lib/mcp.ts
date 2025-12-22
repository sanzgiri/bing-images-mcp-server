import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

export async function getBingImage(country: string = "us", date?: string) {
    const transport = new SSEClientTransport(
        new URL("http://127.0.0.1:8080/sse")
    );

    const client = new Client(
        {
            name: "bing-web-app",
            version: "1.0.0",
        },
        {
            capabilities: {},
        }
    );

    try {
        await client.connect(transport);

        let result;
        if (date) {
            result = await client.callTool({
                name: "get_bing_image",
                arguments: { country, date },
            });
        } else {
            result = await client.callTool({
                name: "get_latest_bing_image",
                arguments: { country },
            });
        }

        // Parse the result
        // The result content is usually a list of content objects.
        // We expect a text content containing the JSON string.

        const content = (result as unknown as { content: any[] }).content[0];
        if (content.type === "text") {
            return content.text;
        }

        return null;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            // Ignore AbortError
            return null;
        }
        console.error("Error fetching image:", error);
        return null;
    } finally {
        try {
            await client.close();
        } catch (e) {
            const err = e as Error | undefined;
            if (!err || err.name !== 'AbortError') {
                // Close can throw AbortError during teardown; other errors are unexpected.
                console.warn('Failed to close MCP client cleanly:', e);
            }
        }
    }
}

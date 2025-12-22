# Bing Explorer Web App

A Next.js application that displays the Bing Image of the Day and allows users to chat about it using an LLM.

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Variables**:
    Create a `.env.local` file in the root of the `web-app` directory:
    ```bash
    OPENAI_API_KEY=sk-...
    ```

3.  **Run the MCP Server**:
    Ensure the MCP server is running on port 8080 (default).
    ```bash
    # In the parent directory
    uv run main.py
    ```

4.  **Run the Web App**:
    ```bash
    npm run dev
    ```

## Features

- Fetches the latest Bing Image of the Day from the MCP server.
- Interactive chat interface to ask questions about the image.
- Powered by Vercel AI SDK and OpenAI.

# Deploying Bing Image MCP Server to Render

1.  **Push to GitHub**: Ensure your code is pushed to a GitHub repository.
2.  **Create a New Web Service on Render**:
    - Go to [Render Dashboard](https://dashboard.render.com/).
    - Click "New +" -> "Web Service".
    - Connect your GitHub repository.
3.  **Configure the Service**:
    - **Name**: `bing-images-mcp-server` (or your choice).
    - **Runtime**: `Docker`.
    - **Region**: Choose a region close to you.
    - **Branch**: `main` (or your working branch).
    - **Plan**: Free (or higher).
4.  **Environment Variables**:
    - Add `PORT` = `8080`.
    - Optional: set `ALLOWED_HOSTS` to a comma-separated list of hostnames (e.g., `bing-images-mcp-server.onrender.com`) to restrict host validation.
5.  **Deploy**: Click "Create Web Service".

Render will build the Docker image and deploy it. Once deployed, you will get a URL (e.g., `https://bing-images-mcp-server.onrender.com`).

## Using the Deployed Server

You can connect to the server using an MCP client that supports SSE.
- **SSE Endpoint**: `https://<your-app-url>/sse`
- **POST Endpoint**: `https://<your-app-url>/messages`

## Deploying the Web App (Optional)

Deploy the Next.js app as a separate Render web service with the repo root set to `web-app`.
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- **Environment**: set `MCP_URL` to the deployed MCP server base URL (e.g., `https://bing-images-mcp-server.onrender.com`).

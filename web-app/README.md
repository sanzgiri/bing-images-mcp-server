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

3.  **Run the Web App**:
    ```bash
    npm run dev
    ```

## Features

- Fetches the latest Bing Image of the Day from Peapix (server-side).
- Interactive chat interface to ask questions about the image.
- Powered by Vercel AI SDK and OpenAI.

## API

The app exposes an internal API endpoint at `/api/bing-image`.
- Latest image: `/api/bing-image?country=us`
- Specific date: `/api/bing-image?country=us&date=2023-01-01`
- Random image: `/api/bing-image?country=us&random=true`
- Random country: `/api/bing-image?country=random` or `/api/bing-image?randomCountry=true`

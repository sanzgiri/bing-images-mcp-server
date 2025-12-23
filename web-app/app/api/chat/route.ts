import { openai } from '@ai-sdk/openai';
import { streamText, convertToCoreMessages } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
    console.log("Chat API called");
    const { messages, imageContext } = await req.json();
    console.log("Messages received:", messages.length);
    console.log("API Key present:", !!process.env.OPENAI_API_KEY);
    if (!process.env.OPENAI_API_KEY) {
        return new Response('Missing OPENAI_API_KEY', { status: 401 });
    }


    const systemPrompt = `You are a helpful assistant. The user is looking at a Bing Image of the Day.
Here is the context about the image:
Title: ${imageContext?.title || 'Unknown'}
Image URL: ${imageContext?.image_url || 'Unknown'}
Page URL: ${imageContext?.page_url || 'Unknown'}

Answer the user's questions about this image. If you don't know the answer, you can speculate based on the title or suggest they visit the page URL.`;

    const result = streamText({
        model: openai('gpt-4o'),
        system: systemPrompt,
        messages: convertToCoreMessages(messages),
    });

    return result.toTextStreamResponse();
}

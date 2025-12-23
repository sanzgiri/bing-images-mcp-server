'use client';

import { useChat } from '@ai-sdk/react';
// import { Message } from 'ai'; // Message not exported?
import { Send, MessageSquare } from 'lucide-react';
import { useState } from 'react';

// Helper to get Message type
type Message = ReturnType<typeof useChat>['messages'][number];

interface ImageDetails {
    title: string;
    image_url: string;
    page_url: string;
    [key: string]: any;
}

export default function Chat({ imageContext }: { imageContext: ImageDetails }) {
    const { messages, status, sendMessage, error } = useChat({
        body: { imageContext },
    });
    const [input, setInput] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const isLoading = status === 'submitted' || status === 'streaming';

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInput(event.target.value);
    };

    const handleSubmit = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (!input.trim()) return;
        await sendMessage({
            text: input,
            // Passing imageContext via custom headers or additional body if supported by backend
            // For now, assuming standard text message, will investigate backend expectation in next step if needed.
            // Vercel AI SDK v5 usually sends data via `data` property or customized request body in `fetch` option if needed.
        });
        setInput('');
    };

    return (
        <>
            {/* Chat Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 p-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-white/20 transition-all shadow-lg z-50"
            >
                <MessageSquare className="w-6 h-6" />
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-80 md:w-96 h-[500px] bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-white/10 bg-white/5">
                        <h3 className="text-white font-medium">Ask about this image</h3>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {error && (
                            <div className="text-red-400 text-sm text-center">
                                Chat failed to respond. Check your API key and try again.
                            </div>
                        )}
                        {messages.length === 0 && !error && (
                            <div className="text-white/50 text-sm text-center mt-10">
                                Ask anything about &quot;{imageContext?.title}&quot;!
                            </div>
                        )}
                        {messages.map((m) => (
                            <div
                                key={m.id}
                                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${m.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white/10 text-white/90'
                                        }`}
                                >
                                    {m.parts ? m.parts.map((part, i) => (
                                        part.type === 'text' ? <span key={i}>{part.text}</span> : null
                                    )) : (m as any).content /* Fallback for potential legacy or unknown structure */}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white/10 rounded-2xl px-4 py-2 text-sm text-white/50">
                                    Thinking...
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 bg-white/5">
                        <div className="relative">
                            <input
                                className="w-full bg-white/10 border border-white/10 rounded-full px-4 py-2 pr-10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                value={input}
                                onChange={handleInputChange}
                                placeholder="Type a message..."
                            />
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/70 hover:text-white disabled:opacity-50"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}

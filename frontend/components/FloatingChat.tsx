"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles, AlertCircle } from "lucide-react";

type Message = {
    id: string;
    role: "user" | "assistant";
    content: string;
};

export default function FloatingChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Dragging state
    const [position, setPosition] = useState({ x: 24, y: 24 }); // Bottom right offsets
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initial greeting
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([
                { id: "1", role: "assistant", content: "Hi there! I'm your EcoWatch Guide. How can I help you today?" }
            ]);
        }
    }, [isOpen]);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handlePointerDown = (e: React.PointerEvent) => {
        // Only trigger drag on the header if open, or anywhere if closed
        if (isOpen && !(e.target as HTMLElement).closest('.drag-handle')) {
            return;
        }

        e.preventDefault();
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startPosX: position.x,
            startPosY: position.y,
        };

        const handlePointerMove = (moveEvent: PointerEvent) => {
            if (!dragRef.current) return;
            setIsDragging(true);

            const dx = dragRef.current.startX - moveEvent.clientX;
            const dy = dragRef.current.startY - moveEvent.clientY;

            // Constrain to window bounds
            const newX = Math.max(0, Math.min(window.innerWidth - 60, dragRef.current.startPosX + dx));
            const newY = Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.startPosY + dy));

            setPosition({ x: newX, y: newY });
        };

        const handlePointerUp = () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
            // Slight delay so a drag doesn't register as a click
            setTimeout(() => setIsDragging(false), 50);
            dragRef.current = null;
        };

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
    };

    const toggleChat = () => {
        if (!isDragging) {
            setIsOpen(!isOpen);
            // If opening from the edge, adjust position so window fits
            if (!isOpen) {
                const maxW = window.innerWidth;
                const maxH = window.innerHeight;
                let newX = position.x;
                let newY = position.y;
                if (position.x < 380 && maxW > 400) newX = 24; // Snap right
                if (position.y < 500 && maxH > 520) newY = 24; // Snap bottom
                setPosition({ x: newX, y: newY });
            }
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setError(null);

        const newMessages: Message[] = [
            ...messages,
            { id: Date.now().toString(), role: "user", content: userMessage }
        ];

        setMessages(newMessages);
        setIsLoading(true);

        try {
            // Add a temporary placeholder for the streaming response
            const assistantMessageId = (Date.now() + 1).toString();
            setMessages([...newMessages, { id: assistantMessageId, role: "assistant", content: "" }]);

            // Remove the initial generic greeting from the history sent to the server
            // to avoid confusing the Gemini API which requires alternating user/model turns.
            const historyToSend = messages
                .filter(m => !(m.id === "1" && m.role === "assistant"))
                .map(m => ({ role: m.role, content: m.content }));

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    history: historyToSend,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to send message");
            }

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                accumulatedContent += decoder.decode(value, { stream: true });

                setMessages(prev => prev.map(m =>
                    m.id === assistantMessageId
                        ? { ...m, content: accumulatedContent }
                        : m
                ));
            }
        } catch (err: any) {
            console.error("Chat error:", err);
            setError(err.message || "Something went wrong. Please try again.");
            // Remove the empty assistant message if it failed completely
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last.role === "assistant" && last.content === "") {
                    return prev.slice(0, -1);
                }
                return prev;
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className={`fixed z-[9999] ${isOpen ? "inset-0 sm:inset-auto" : ""}`}
            style={{
                bottom: typeof window !== "undefined" && window.innerWidth < 640 && isOpen ? 0 : `${position.y}px`,
                right: typeof window !== "undefined" && window.innerWidth < 640 && isOpen ? 0 : `${position.x}px`,
            }}
        >
            {/* The Chat Bubble / Button */}
            {!isOpen && (
                <div
                    onPointerDown={handlePointerDown}
                    onClick={toggleChat}
                    className="relative group cursor-pointer"
                >
                    {/* Pulse effect rings */}
                    <div className="absolute -inset-2 rounded-full border border-primary/30 animate-ping opacity-75"></div>
                    
                    <div className="w-14 h-14 rounded-full eco-gradient shadow-xl shadow-primary/30 flex items-center justify-center text-white transform transition-transform group-hover:scale-110 active:scale-95">
                        <MessageCircle size={28} />
                    </div>
                    
                    {/* Tooltip */}
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900 border border-white/10 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none before:content-[''] before:absolute before:-bottom-1 before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-gray-900">
                        Ask EcoWatch Guide
                    </div>
                </div>
            )}

            {/* The Open Chat Window */}
            {isOpen && (
                <div className="glass fixed inset-0 sm:inset-auto sm:relative w-full h-[100dvh] sm:w-[380px] sm:h-[600px] flex flex-col sm:rounded-2xl shadow-2xl shadow-black/50 sm:border border-primary/20 overflow-hidden bg-[#0a0f0a] sm:bg-[#0a0f0a]/95 backdrop-blur-xl animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200" style={{ transformOrigin: 'bottom right' }}>
                    
                    {/* Header (Drag Handle) */}
                    <div 
                        onPointerDown={handlePointerDown}
                        className="drag-handle h-16 sm:h-14 border-b border-primary/20 bg-primary/10 flex items-center justify-between px-4 sm:cursor-grab sm:active:cursor-grabbing shrink-0 pt-safe"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full eco-gradient flex items-center justify-center text-white">
                                <Sparkles size={16} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm text-foreground">EcoWatch Guide</h3>
                                <p className="text-[10px] text-primary flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                                    Online
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); toggleChat(); }}
                            className="p-2 text-foreground/50 hover:text-foreground hover:bg-white/5 rounded-full transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {messages.map((m) => (
                            <div key={m.id} className={`flex w-full ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div 
                                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                        m.role === "user" 
                                            ? "bg-white/10 text-foreground rounded-tr-sm border border-white/5" 
                                            : "eco-gradient text-white rounded-tl-sm shadow-lg shadow-primary/10"
                                    }`}
                                >
                                    {m.content || <span className="animate-pulse">Thinking...</span>}
                                </div>
                            </div>
                        ))}
                        
                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-danger/20 text-danger-200 rounded-lg text-xs border border-danger/30">
                                <AlertCircle size={14} className="shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={sendMessage} className="p-3 border-t border-primary/20 bg-black/20 shrink-0">
                        <div className="relative flex items-center">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask a question..."
                                disabled={isLoading}
                                className="w-full bg-white/5 border border-white/10 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all disabled:opacity-50 text-foreground"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="absolute right-1 text-primary hover:text-white p-2 hover:bg-primary/80 rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-primary"
                            >
                                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            </button>
                        </div>
                        <p className="text-[10px] text-center text-foreground/40 mt-2">
                            AI can make mistakes. Built with Gemini.
                        </p>
                    </form>

                </div>
            )}
        </div>
    );
}

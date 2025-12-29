import Lottie from 'lottie-react';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { UserRole } from '../types';

// Placeholder Lottie JSON (Robotic float) - In a real app, this would be imported from a JSON file
// Since we can't fetch external URLs easily in code without setup, we'll assume a file exists or use a simple fallback SVG if Lottie data isn't provided.
// For now, I'll use a mocked "loading" style generic animation data structure or just a clean SVG fallback if the user hasn't added the file yet, 
// but I will setup the code to USE 'robot-lottie.json' if present.
// To ensure it works immediately, I will use a very simple SVG generic fallback inside the Lottie wrapper if data is missing, 
// or simple CSS animations for the "float".

interface ChatAssistantProps {
    role: UserRole;
    embedded?: boolean;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ role, embedded = false }) => {
    const [isOpen, setIsOpen] = useState(embedded);
    const [isHovered, setIsHovered] = useState(false);
    const [isVisible, setIsVisible] = useState(true); // Control visibility of the trigger button

    // Auto-hide the trigger button after inactivity
    useEffect(() => {
        if (embedded || isOpen) return;

        const hideTimer = setTimeout(() => {
            setIsVisible(false);
        }, 10000); // Hide after 10s of inactivity

        return () => clearTimeout(hideTimer);
    }, [embedded, isOpen, isHovered]);

    // Show when hovered (handled by CSS group-hover usually, but we can force state)
    // Actually, if it's hidden (display:none or opacity:0), we need a "trigger zone".

    const [messages, setMessages] = useState<{ sender: 'user' | 'ai', text: string }[]>([
        { sender: 'ai', text: `Hello! I'm your ${role === UserRole.CUSTOMER ? 'health' : 'pharmacy'} assistant. How can I help you today?` }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Robot State
    const [robotState, setRobotState] = useState<'idle' | 'peek' | 'float'>('float');

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
        setInput('');
        setLoading(true);

        const { data, error } = await supabase.functions.invoke('gemini-proxy', {
            body: { action: 'chat', payload: { message: userMsg, role } },
        });

        if (error) {
            setMessages(prev => [...prev, { sender: 'ai', text: 'Sorry, I am having trouble connecting right now.' }]);
        } else {
            setMessages(prev => [...prev, { sender: 'ai', text: data.response }]);
        }

        setLoading(false);
    };

    // --- ROBOT UI ---
    if (!isOpen && !embedded) {
        return (
            <div
                className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 group"
                onMouseEnter={() => { setIsHovered(true); setIsVisible(true); }}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Speech Bubble Hint - Only show if visible or hovered */}
                <div className={`mr-4 mb-2 bg-white px-4 py-2 rounded-xl rounded-tr-none shadow-lg border border-indigo-100 transition-all duration-500 origin-bottom-right ${isVisible || isHovered ? 'scale-100 opacity-100' : 'scale-0 opacity-0 translate-y-10'}`}>
                    <p className="text-sm font-medium text-slate-700">Need help? Click me!</p>
                </div>

                {/* Flying Robot Container - Collapses to a small pill when hidden */}
                <button
                    onClick={() => setIsOpen(true)}
                    className={`relative focus:outline-none transition-all duration-500 ease-in-out ${isVisible || isHovered ? 'w-24 h-24 hover:scale-110 active:scale-95' : 'w-12 h-12 translate-y-4 opacity-50 hover:opacity-100'}`}
                >
                    {/* CSS Float Animation - Only animate when fully visible */}
                    <div className={`absolute inset-0 ${isVisible || isHovered ? 'animate-[bounce_3s_infinite_ease-in-out]' : ''}`}>
                        {/* Show Full Robot if Visible, else small icon */}
                        {isVisible || isHovered ? (
                            <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl filter" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="100" cy="100" r="90" fill="#6366f1" className="opacity-20 animate-pulse" />
                                <path d="M100 60C70 60 50 85 50 110C50 145 75 160 100 160C125 160 150 145 150 110C150 85 130 60 100 60Z" fill="white" stroke="#4f46e5" strokeWidth="4" />
                                <rect x="75" y="90" width="15" height="10" rx="5" fill="#1e293b" />
                                <rect x="110" y="90" width="15" height="10" rx="5" fill="#1e293b" />
                                <path d="M100 50L100 30" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" />
                                <circle cx="100" cy="25" r="8" fill="#ef4444" className="animate-ping" />
                                <circle cx="100" cy="25" r="8" fill="#ef4444" />
                                <path d="M85 130Q100 140 115 130" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                        ) : (
                            <div className="w-full h-full bg-indigo-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                                <span className="text-xl">🤖</span>
                            </div>
                        )}

                    </div>
                </button>
            </div>
        );
    }

    return (
        <div className={`${embedded ? 'w-full h-full shadow-none border-0' : 'fixed bottom-6 right-6 w-80 sm:w-96 rounded-2xl shadow-2xl border border-gray-200 z-50'} bg-white flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-300`} style={embedded ? {} : { height: '550px' }}>
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center shadow-md">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center border border-indigo-400">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                            <path d="M16.5 7.5h-9v9h9v-9z" opacity="0.5" />
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4-9h8v2H8zm0-4h8v2H8z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-sm">PharmAI Assistant</h3>
                        <p className="text-xs text-indigo-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                            Online
                        </p>
                    </div>
                </div>
                {!embedded && <button onClick={() => setIsOpen(false)} className="text-indigo-200 hover:text-white transition-colors p-1 hover:bg-indigo-500 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                </button>}
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 space-y-4 scroll-smooth">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${m.sender === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-gray-100 text-slate-700 rounded-bl-none'}`}>
                            {m.text}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100"></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-200"></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-gray-100">
                <div className="flex gap-2 items-center bg-gray-50 p-1.5 rounded-xl border border-gray-200 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask anything..."
                        className="flex-1 bg-transparent border-none text-sm px-3 py-2 outline-none text-slate-700 placeholder:text-slate-400"
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-2.5 rounded-lg transition-transform hover:scale-105 active:scale-95 shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                    </button>
                </div>
                <div className='text-center mt-2'>
                    <p className="text-[10px] text-gray-400">Powered by Gemini AI • Medical Info Only</p>
                </div>
            </div>
        </div>
    );
};

export default ChatAssistant;

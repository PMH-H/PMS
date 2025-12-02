import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { UserRole } from '../types';

interface ChatAssistantProps {
    role: UserRole;
    embedded?: boolean;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ role, embedded = false }) => {
    const [isOpen, setIsOpen] = useState(embedded);
    const [messages, setMessages] = useState<{ sender: 'user' | 'ai', text: string }[]>([
        { sender: 'ai', text: `Hello! I'm your ${role === UserRole.CUSTOMER ? 'health' : 'pharmacy'} assistant. How can I help you today?` }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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

    if (!isOpen && !embedded) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 transition-all z-50 flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.159 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <span className="font-medium">AI Assistant</span>
            </button>
        );
    }

    return (
        <div className={`${embedded ? 'w-full h-full shadow-none border-0' : 'fixed bottom-6 right-6 w-80 sm:w-96 rounded-xl shadow-2xl border border-gray-200 z-50'} bg-white flex flex-col overflow-hidden`} style={embedded ? {} : { height: '500px' }}>
            <div className="bg-indigo-700 p-4 text-white flex justify-between items-center">
                <h3 className="font-semibold flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-300">
                        <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM6.97 2.47a.75.75 0 011.06 0l5.228 5.228a.75.75 0 010 1.06l-5.228 5.228a.75.75 0 01-1.06-1.06l4.697-4.697-4.697-4.697a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                    PharmAI Chat
                </h3>
                <button onClick={() => setIsOpen(false)} className="text-indigo-100 hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-lg text-sm ${m.sender === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'}`}>
                            {m.text}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-200 text-gray-500 p-2 rounded-lg text-xs animate-pulse">
                            Thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-3 bg-white border-t border-gray-100">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type your question..."
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white p-2 rounded-md"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatAssistant;

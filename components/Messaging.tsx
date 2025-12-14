import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';

interface Message {
    id: string;
    sender_id: string;
    receiver_id: string | null;
    facility_id: string | null;
    content: string;
    is_read: boolean;
    created_at: string;
    sender?: { full_name: string };
}

interface MessagingProps {
    currentUser: User;
    receiverId?: string; // For direct messages
    facilityId?: string; // For facility-wide messages
}

const Messaging: React.FC<MessagingProps> = ({ currentUser, receiverId, facilityId }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchMessages();
        subscribeToMessages();
    }, [currentUser.id, receiverId, facilityId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('messages')
                .select('*, sender:profiles!messages_sender_id_fkey(full_name)')
                .order('created_at', { ascending: true });

            if (receiverId) {
                // Direct messages between two users
                query = query.or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${currentUser.id})`);
            } else if (facilityId) {
                // Facility-wide messages
                query = query.eq('facility_id', facilityId).is('receiver_id', null);
            }

            const { data, error } = await query;

            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            console.error('Error fetching messages:', err);
        } finally {
            setLoading(false);
        }
    };

    const subscribeToMessages = () => {
        const channel = supabase
            .channel('messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                (payload) => {
                    const newMsg = payload.new as Message;
                    // Only add if it's relevant to this conversation
                    if (
                        (receiverId && ((newMsg.sender_id === currentUser.id && newMsg.receiver_id === receiverId) ||
                            (newMsg.sender_id === receiverId && newMsg.receiver_id === currentUser.id))) ||
                        (facilityId && newMsg.facility_id === facilityId && !newMsg.receiver_id)
                    ) {
                        setMessages(prev => [...prev, newMsg]);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || sending) return;

        setSending(true);
        try {
            const messageData: any = {
                sender_id: currentUser.id,
                content: newMessage.trim(),
            };

            if (receiverId) {
                messageData.receiver_id = receiverId;
            } else if (facilityId) {
                messageData.facility_id = facilityId;
            }

            const { error } = await supabase.from('messages').insert([messageData]);

            if (error) throw error;

            setNewMessage('');
        } catch (err) {
            console.error('Error sending message:', err);
        } finally {
            setSending(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                    {receiverId ? 'Direct Message' : 'Facility Chat'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                    {messages.length} messages
                </p>
            </div>

            {/* Messages - Flexible height */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 min-h-[200px] max-h-[50vh] sm:max-h-[400px]">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
                        <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="text-sm">No messages yet</p>
                        <p className="text-xs mt-1">Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
                        >
                            <div
                                className={`max-w-[85%] sm:max-w-[70%] p-2.5 sm:p-3 rounded-2xl shadow-sm ${msg.sender_id === currentUser.id
                                    ? 'bg-emerald-600 text-white rounded-br-sm'
                                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                                    }`}
                            >
                                {msg.sender_id !== currentUser.id && msg.sender && (
                                    <p className="text-xs font-semibold mb-1 opacity-75">
                                        {msg.sender.full_name}
                                    </p>
                                )}
                                <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                                <p className={`text-[10px] mt-1.5 ${msg.sender_id === currentUser.id ? 'text-emerald-100' : 'text-gray-400'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input - Fixed at bottom */}
            <div className="p-3 sm:p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 px-3 sm:px-4 py-2.5 border border-gray-300 rounded-full bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                        disabled={sending}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || sending}
                        className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-emerald-600 text-white rounded-full hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                        {sending ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Messaging;

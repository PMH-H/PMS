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
        <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-900">
                    {receiverId ? 'Direct Message' : 'Facility Chat'}
                </h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '400px' }}>
                {messages.length === 0 ? (
                    <p className="text-center text-gray-500 text-sm">No messages yet. Start the conversation!</p>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[70%] p-3 rounded-lg ${msg.sender_id === currentUser.id
                                        ? 'bg-emerald-600 text-white rounded-br-none'
                                        : 'bg-gray-100 text-gray-900 rounded-bl-none'
                                    }`}
                            >
                                {msg.sender_id !== currentUser.id && msg.sender && (
                                    <p className="text-xs font-semibold mb-1 opacity-75">
                                        {msg.sender.full_name}
                                    </p>
                                )}
                                <p className="text-sm">{msg.content}</p>
                                <p className={`text-xs mt-1 ${msg.sender_id === currentUser.id ? 'text-emerald-100' : 'text-gray-500'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                        disabled={sending}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || sending}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Messaging;

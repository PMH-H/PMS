
import React, { useState, useEffect, useRef } from 'react';
import { messagingService, MessageAttachment } from '../../services/messagingService';
import { User } from '../../types';
import { Send, Mic, Image as ImageIcon, Paperclip, X, Play, Pause } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface ChatWindowProps {
    currentUser: User;
    partnerId: string;
    partnerName: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ currentUser, partnerId, partnerName }) => {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [attachment, setAttachment] = useState<MessageAttachment | null>(null);
    const [isRecording, setIsRecording] = useState(false); // Placeholder for actual recording logic
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadMessages();
        const subscription = subscribeToMessages();
        messagingService.markAsRead(partnerId, currentUser.id);

        return () => {
            subscription.unsubscribe();
        };
    }, [partnerId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadMessages = async () => {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });

        if (!error && data) setMessages(data);
    };

    const subscribeToMessages = () => {
        return supabase
            .channel(`chat:${partnerId}`)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => {
                    const msg = payload.new;
                    if (
                        (msg.sender_id === currentUser.id && msg.recipient_id === partnerId) ||
                        (msg.sender_id === partnerId && msg.recipient_id === currentUser.id)
                    ) {
                        setMessages(prev => [...prev, msg]);
                        if (msg.sender_id === partnerId) {
                            messagingService.markAsRead(partnerId, currentUser.id);
                        }
                    }
                }
            )
            .subscribe();
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async () => {
        if ((!newMessage.trim() && !attachment) || sending) return;
        setSending(true);
        try {
            await messagingService.sendMessage(
                currentUser.id,
                partnerId,
                null, // Facility ID optional for 1:1
                newMessage,
                attachment || undefined
            );
            setNewMessage('');
            setAttachment(null);
        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const type = file.type.startsWith('image/') ? 'IMAGE' :
                file.type.startsWith('audio/') ? 'AUDIO' : 'FILE';
            setAttachment({ file, type: type as any });
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            <div className="bg-white p-4 border-b border-gray-200 shadow-sm flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-50">
                        {partnerName[0]}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">{partnerName}</h3>
                        <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 block"></span>
                            Online
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(msg => {
                    const isMe = msg.sender_id === currentUser.id;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] rounded-2xl p-3 shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'
                                }`}>
                                {msg.media_url && (
                                    <div className="mb-2 rounded-lg overflow-hidden">
                                        {msg.media_type === 'IMAGE' ? (
                                            <img src={msg.media_url} className="max-w-full h-auto" />
                                        ) : msg.media_type === 'AUDIO' ? (
                                            <audio controls src={msg.media_url} className="w-full h-8" />
                                        ) : (
                                            <a href={msg.media_url} target="_blank" className="flex items-center gap-2 underline text-sm">
                                                <Paperclip size={14} /> Attachment
                                            </a>
                                        )}
                                    </div>
                                )}
                                <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                                <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-white border-t border-gray-200">
                {attachment && (
                    <div className="flex items-center gap-2 bg-gray-100 p-2 rounded-lg mb-2 text-xs">
                        <span className="font-bold">{attachment.type}:</span>
                        <span className="truncate max-w-[200px]">{attachment.file.name}</span>
                        <button onClick={() => setAttachment(null)} className="ml-auto text-gray-500 hover:text-red-500"><X size={14} /></button>
                    </div>
                )}
                <div className="flex items-end gap-2">
                    <label className="p-2 text-gray-400 hover:text-indigo-600 cursor-pointer transition-colors pt-3">
                        <input type="file" className="hidden" accept="image/*,audio/*" onChange={handleFileSelect} />
                        <ImageIcon size={24} />
                    </label>

                    <div className="flex-1 bg-gray-100 rounded-2xl flex items-center px-4 py-2 border border-transparent focus-within:border-indigo-300 focus-within:bg-white transition-all">
                        <textarea
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="w-full bg-transparent outline-none text-sm resize-none max-h-20 py-1"
                            rows={1}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                        />
                    </div>

                    <button
                        onClick={handleSend}
                        disabled={(!newMessage.trim() && !attachment) || sending}
                        className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:scale-95 transition-all shadow-md"
                    >
                        {sending ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Send size={20} className="ml-0.5" />}
                    </button>
                </div>
            </div>
        </div>
    );
};


import React, { useState, useEffect } from 'react';
import { messagingService, ChatUser } from '../../services/messagingService';
import { User } from '../../types';
import { Plus, Search, MessageSquare, User as UserIcon } from 'lucide-react';

interface ConversationListProps {
    currentUser: User;
    onSelectChat: (partnerId: string, partnerName: string) => void;
    activePartnerId?: string;
}

export const ConversationList: React.FC<ConversationListProps> = ({ currentUser, onSelectChat, activePartnerId }) => {
    const [conversations, setConversations] = useState<ChatUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewChatParams, setShowNewChatParams] = useState(false);
    const [availableUsers, setAvailableUsers] = useState<any[]>([]);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        loadConversations();
        // Poll for updates (MVP Realtime)
        const interval = setInterval(loadConversations, 10000);
        return () => clearInterval(interval);
    }, [currentUser.id]);

    const loadConversations = async () => {
        try {
            const data = await messagingService.getConversations(currentUser.id);
            setConversations(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadPotentialContacts = async () => {
        // Patient -> Load Pharmacists
        // Pharmacist/Admin -> Load Patients
        try {
            let contacts;
            if (currentUser.role === 'customer') {
                contacts = await messagingService.getAvailablePharmacists();
            } else {
                // Pharmacist, Admin, etc. see patients
                contacts = await messagingService.getAvailablePatients(currentUser.facility_id);
            }
            setAvailableUsers(contacts || []);
            setShowNewChatParams(true);
        } catch (err) {
            console.error('Error loading contacts:', err);
        }
    };

    const filteredConversations = conversations.filter(c =>
        c.partner_name.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-white border-r border-gray-200 w-full md:w-80">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h2 className="font-bold text-gray-800 text-lg">Messages</h2>
                <button
                    onClick={loadPotentialContacts}
                    className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={18} />
                </button>
            </div>

            <div className="p-3">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-8 space-y-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                        <p className="text-xs text-gray-400">Loading chats...</p>
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400 px-6 text-center">
                        <MessageSquare size={32} className="mb-2 opacity-50" />
                        <p className="text-sm">No conversations yet.</p>
                        <p className="text-xs mt-1">Start a new chat to contact a pharmacist.</p>
                    </div>
                ) : (
                    <div className="space-y-1 p-2">
                        {filteredConversations.map(chat => (
                            <button
                                key={chat.partner_id}
                                onClick={() => onSelectChat(chat.partner_id, chat.partner_name)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activePartnerId === chat.partner_id
                                    ? 'bg-indigo-50 border-indigo-100 shadow-sm'
                                    : 'hover:bg-gray-50 border border-transparent'
                                    }`}
                            >
                                <div className="relative">
                                    {chat.partner_avatar ? (
                                        <img src={chat.partner_avatar} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                            <UserIcon size={20} />
                                        </div>
                                    )}
                                    {chat.unread_count > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold shadow-sm">
                                            {chat.unread_count}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 text-left overflow-hidden">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <span className={`font-semibold text-sm truncate ${chat.unread_count > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                                            {chat.partner_name}
                                        </span>
                                        <span className="text-[10px] text-gray-400 whitespace-nowrap ml-1">
                                            {new Date(chat.last_message_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                    <p className={`text-xs truncate ${chat.unread_count > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                                        {chat.last_message_content || 'Multimedia Message'}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* New Chat Modal */}
            {showNewChatParams && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-sm max-h-[80vh] flex flex-col shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">Start New Conversation</h3>
                            <button onClick={() => setShowNewChatParams(false)} className="text-gray-400 hover:text-gray-600">Close</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {availableUsers.map(u => (
                                <button
                                    key={u.id}
                                    onClick={() => {
                                        onSelectChat(u.id, u.full_name);
                                        setShowNewChatParams(false);
                                    }}
                                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                                >
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                                        {u.full_name[0]}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800">{u.full_name}</p>
                                        <p className="text-xs text-gray-500">{u.facility_name}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

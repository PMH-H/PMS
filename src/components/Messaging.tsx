
import React, { useState } from 'react';
import { User } from '../types';
import { ConversationList } from './messaging/ConversationList';
import { ChatWindow } from './messaging/ChatWindow';

interface MessagingProps {
    currentUser: User;
    receiverId?: string; // Optional init with a user
    facilityId?: string; // Legacy support (can hide if unused)
}

const Messaging: React.FC<MessagingProps> = ({ currentUser, receiverId }) => {
    // If receiverId passed prop, start with that. Else undefined.
    const [activePartnerId, setActivePartnerId] = useState<string | undefined>(receiverId);
    const [activePartnerName, setActivePartnerName] = useState<string>('');

    // On mobile, show list unless active chat selected
    const [showChatOnMobile, setShowChatOnMobile] = useState(!!receiverId);

    const handleSelectChat = (partnerId: string, partnerName: string) => {
        setActivePartnerId(partnerId);
        setActivePartnerName(partnerName);
        setShowChatOnMobile(true);
    };

    const handleBackToMenu = () => {
        setShowChatOnMobile(false);
        setActivePartnerId(undefined);
    };

    return (
        <div className="flex h-full bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Sidebar (List) */}
            <div className={`${showChatOnMobile ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-gray-200 flex-col`}>
                <ConversationList
                    currentUser={currentUser}
                    onSelectChat={handleSelectChat}
                    activePartnerId={activePartnerId}
                />
            </div>

            {/* Main Content (Chat Window) */}
            <div className={`${showChatOnMobile ? 'flex' : 'hidden md:flex'} flex-1 flex-col h-full bg-slate-50 relative`}>
                {activePartnerId ? (
                    <>
                        {/* Mobile Back Button Overlay */}
                        <div className="md:hidden absolute top-4 left-4 z-20">
                            <button
                                onClick={handleBackToMenu}
                                className="bg-white/90 p-2 rounded-full shadow-md text-gray-700 border border-gray-200"
                            >
                                ← Back
                            </button>
                        </div>
                        <ChatWindow
                            currentUser={currentUser}
                            partnerId={activePartnerId}
                            partnerName={activePartnerName}
                        />
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center bg-gray-50/50">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <span className="text-2xl">💬</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-700">Select a Conversation</h3>
                        <p className="text-sm max-w-xs mt-2">Choose an existing chat from the left or start a new one to connect with a pharmacist.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Messaging;

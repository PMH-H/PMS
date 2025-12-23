
import { supabase } from './supabase';
import { User } from '../types';

export interface ChatUser {
    partner_id: string;
    partner_name: string;
    partner_role: string;
    partner_avatar?: string;
    last_message_content: string;
    last_message_at: string;
    unread_count: number;
}

export interface MessageAttachment {
    file: File;
    type: 'IMAGE' | 'AUDIO' | 'VIDEO' | 'FILE';
}

export const messagingService = {
    /**
     * Fetch list of active conversations (threads) for the current user
     */
    getConversations: async (userId: string) => {
        const { data, error } = await supabase.rpc('get_conversations', { p_user_id: userId });
        if (error) throw error;
        return data as ChatUser[];
    },

    /**
     * Fetch available pharmacists to start a new chat with
     */
    getAvailablePharmacists: async () => {
        try {
            const { data, error } = await supabase.rpc('get_available_pharmacists');
            if (error) throw error;
            if (data && data.length > 0) return data;
        } catch (err) {
            console.warn('RPC failed, using fallback query:', err);
        }
        // Fallback: query profiles directly for pharmacists/admins
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, facility_id, facilities:facility_id(name)')
            .in('role', ['pharmacist', 'admin'])
            .limit(50);
        if (error) throw error;
        return (data || []).map((u: any) => ({
            id: u.id,
            full_name: u.full_name,
            facility_name: u.facilities?.name || 'Unknown Pharmacy'
        }));
    },

    /**
     * Fetch available patients for pharmacists to chat with
     */
    getAvailablePatients: async (facilityId?: string) => {
        // Pharmacists can see customers who have interacted with their facility
        // For now: return all customers (MVP)
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, phone')
            .eq('role', 'customer')
            .limit(100);
        if (error) throw error;
        return (data || []).map((u: any) => ({
            id: u.id,
            full_name: u.full_name,
            phone: u.phone || ''
        }));
    },

    /**
     * Send a message, optionally with an attachment
     */
    sendMessage: async (
        senderId: string,
        recipientId: string | null,
        facilityId: string | null,
        content: string,
        attachment?: MessageAttachment
    ) => {
        let mediaUrl = null;
        let mediaType = null;

        if (attachment) {
            const fileExt = attachment.file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = `${senderId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('chat-attachments')
                .upload(filePath, attachment.file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('chat-attachments')
                .getPublicUrl(filePath);

            mediaUrl = publicUrl;
            mediaType = attachment.type;
        }

        // Prepare payload
        const payload: any = {
            sender_id: senderId,
            content: content,
            media_url: mediaUrl,
            media_type: mediaType
        };

        if (recipientId) payload.recipient_id = recipientId;
        if (facilityId) payload.facility_id = facilityId;

        const { data, error } = await supabase
            .from('messages')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;

        // Trigger Push Notification (via Edge Function)
        // We fire and forget to keep UI responsive
        if (recipientId) {
            supabase.functions.invoke('send-push', {
                body: {
                    record: data,
                    type: 'NEW_MESSAGE'
                }
            });
        }

        return data;
    },

    /**
     * Mark messages as read
     */
    markAsRead: async (senderId: string, recipientId: string) => {
        const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('sender_id', senderId)
            .eq('recipient_id', recipientId)
            .eq('is_read', false);

        if (error) throw error;
    }
};

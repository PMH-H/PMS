import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Notification } from '../types';
import { generateUUID } from '../utils/uuid';
import { useAppContext } from './AppContext';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    showToast: (message: string, type?: Notification['type']) => void;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotificationSystem = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotificationSystem must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const { currentUser: user } = useAppContext(); // Access current user
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Derived state for unread count
    const unreadCount = notifications.filter(n => !n.read).length;

    // Initialize audio on mount
    useEffect(() => {
        audioRef.current = new Audio('/sounds/notification.mp3'); // Ensure this file exists or fail silently
        audioRef.current.volume = 0.5;
    }, []);

    const playSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.play().catch(() => {
                // Ignore auto-play errors
            });
        }
    }, []);

    const showToast = useCallback((message: string, type: Notification['type'] = 'GENERAL') => {
        const newNotif: Notification = {
            id: generateUUID(),
            message,
            type,
            read: false,
            timestamp: new Date().toISOString()
        };
        setNotifications(prev => [newNotif, ...prev]);
        playSound();

        // Auto-dismiss local toasts after 5s if they are just general info
        if (type === 'GENERAL') {
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
            }, 5000);
        }
    }, [playSound]);

    // Initial Fetch & Realtime Subscription
    useEffect(() => {
        if (!user) {
            setNotifications([]);
            return;
        }

        // 1. Initial Fetch (Limit to last 20 to save egress)
        const fetchInitial = async () => {
            const { data } = await supabase
                .from('user_notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) {
                // Map DB structure to frontend type if needed, or assume match
                const mapped: Notification[] = data.map((n: any) => ({
                    id: n.id,
                    message: n.message,
                    read: n.is_read,
                    timestamp: n.created_at,
                    type: n.type
                }));
                setNotifications(mapped);
            }
        };

        fetchInitial();

        // 2. Realtime Subscription (INSERT only)
        const channel = supabase
            .channel(`notifs:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'user_notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const newRecord = payload.new as any;
                    const newNotif: Notification = {
                        id: newRecord.id,
                        message: newRecord.message,
                        read: newRecord.is_read,
                        timestamp: newRecord.created_at,
                        type: newRecord.type
                    };

                    setNotifications(prev => [newNotif, ...prev]);
                    playSound();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, playSound]);

    const markAsRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

        // Background sync
        await supabase
            .from('user_notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', id);
    };

    const markAllAsRead = async () => {
        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));

        if (user) {
            await supabase.rpc('mark_notifications_read', { p_user_id: user.id });
        }
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, showToast, markAsRead, markAllAsRead }}>
            {children}
        </NotificationContext.Provider>
    );
};

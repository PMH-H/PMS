import { useState, useEffect, useCallback } from 'react';
import { getNotifications, markNotificationRead } from '../services/apiService';

export interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    created_at: string;
    data?: any;
}

export const useBackendNotifications = (userId?: string) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        if (!userId) return;
        try {
            const res = await getNotifications();
            setNotifications(res.notifications);
            setUnreadCount(res.unreadCount);
            setLoading(false);
        } catch (err) {
            console.error(err);
        }
    }, [userId]);

    const markRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n =>
            n.id === id ? { ...n, read: true } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));

        try {
            await markNotificationRead(id);
        } catch (err) {
            // Revert on failure (omitted for brevity in MVP)
            fetch();
        }
    };

    const markAllRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
        try {
            await markNotificationRead('all');
        } catch (err) { fetch(); }
    };

    // Poll every 30s
    useEffect(() => {
        if (userId) {
            fetch();
            const interval = setInterval(fetch, 30000);
            return () => clearInterval(interval);
        }
    }, [userId, fetch]);

    return { notifications, unreadCount, loading, markRead, markAllRead, refresh: fetch };
};

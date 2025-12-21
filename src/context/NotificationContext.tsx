import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { UserRole, Notification as AppNotification } from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

// Define a unified specific notification type for state management
export interface SystemNotification extends AppNotification {
    isRead: boolean; // Map to 'read' in AppNotification but enforcing boolean
    link?: string; // Optional action link
    severity: 'low' | 'medium' | 'high';
}

interface NotificationContextType {
    notifications: SystemNotification[];
    unreadCount: number;
    addNotification: (notification: Omit<SystemNotification, 'id' | 'timestamp' | 'read' | 'isRead'>) => void;
    markAsRead: (id: string) => void;
    clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

interface NotificationProviderProps {
    children: React.ReactNode;
    currentUser: { id: string; role: UserRole; facility_id?: string } | null;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children, currentUser }) => {
    const [notifications, setNotifications] = useState<SystemNotification[]>([]);
    const [channel, setChannel] = useState<RealtimeChannel | null>(null);

    // Play sound helper
    const playNotificationSound = useCallback((severity: 'low' | 'medium' | 'high' = 'medium') => {
        // Only play sound for medium/high
        if (severity === 'low') return;

        // Simple beep data URI (same as previous system but cleaner impl)
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
        audio.volume = severity === 'high' ? 1.0 : 0.5;
        audio.play().catch(e => console.error('Audio play failed', e)); // User interaction required policy might block
    }, []);

    const addNotification = useCallback((data: Omit<SystemNotification, 'id' | 'timestamp' | 'read' | 'isRead'>) => {
        const newNotification: SystemNotification = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            read: false,
            isRead: false,
            ...data,
        };

        setNotifications(prev => [newNotification, ...prev]);
        playNotificationSound(data.severity);
    }, [playNotificationSound]);

    const markAsRead = useCallback((id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true, isRead: true } : n));
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    // Set up Realtime subscriptions based on Role
    useEffect(() => {
        if (!currentUser) return;

        // Clean up previous channel
        if (channel) {
            supabase.removeChannel(channel);
        }

        const newChannel = supabase.channel('system_notifications');

        // 1. Role-Specific Logic
        switch (currentUser.role) {
            case UserRole.CUSTOMER:
                // Listen for prescription updates
                newChannel.on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'prescriptions', filter: `patient_id=eq.${currentUser.id}` },
                    (payload) => {
                        const status = payload.new.status;
                        if (payload.old.status !== status) {
                            let message = `Your prescription status is now ${status}`;
                            let type: any = 'GENERAL';
                            if (status === 'APPROVED') type = 'PRESCRIPTION_STATUS';

                            addNotification({
                                message,
                                type,
                                title: 'Prescription Update',
                                severity: 'medium'
                            });
                        }
                    }
                );
                break;

            case UserRole.PHARMACIST:
            case UserRole.ADMIN: // Facility Admin
                if (currentUser.facility_id) {
                    // Listen for new prescriptions in this facility (if assigned)
                    // Note: This requires complex filter, usually better to listen to all and filter in client or use Edge Function pushes.
                    // For MVP, we listen to sales/orders in this facility
                    newChannel.on(
                        'postgres_changes',
                        { event: 'INSERT', schema: 'public', table: 'sales', filter: `facility_id=eq.${currentUser.facility_id}` },
                        () => {
                            addNotification({
                                title: 'New Sale',
                                message: 'A new sale has been recorded.',
                                type: 'STOCK_UPDATE',
                                severity: 'low'
                            });
                        }
                    );

                    // Stock alerts? (Usually derived, detecting row changes in batches is noisy)
                }
                break;

            case UserRole.SUPER_ADMIN_BMS:
            case UserRole.SUPER_ADMIN_DEV:
                // Listen for Security Events
                newChannel.on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'security_events' },
                    (payload) => {
                        // High alert for admins
                        addNotification({
                            title: 'Security Alert',
                            message: `New security event: ${payload.new.event_type}`,
                            type: 'GENERAL',
                            severity: 'high'
                        });
                    }
                );
                // Listen for Auth fails? (Maybe too noisy, stick to critical)
                break;

            case UserRole.PRESCRIBER:
                // Listen for Rx status changes of their patients? 
                // Or refils
                break;
        }

        newChannel.subscribe();
        setChannel(newChannel);

        return () => {
            supabase.removeChannel(newChannel);
        };
    }, [currentUser?.id, currentUser?.role, currentUser?.facility_id, addNotification]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAsRead, clearAll }}>
            {children}
        </NotificationContext.Provider>
    );
};

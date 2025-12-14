import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
}

interface NotificationSystemProps {
    userId: string;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({ userId }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        // Subscribe to prescription changes
        const channel = supabase
            .channel('prescription_notifications')
            .on('postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'prescriptions',
                    filter: `patient_id=eq.${userId}`
                },
                (payload) => {
                    const newStatus = payload.new.status;
                    const oldStatus = payload.old.status;

                    if (newStatus !== oldStatus) {
                        playNotificationSound();
                        showNotification(newStatus);
                    }
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [userId]);

    const playNotificationSound = () => {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
        audio.play().catch(e => console.log('Audio play failed:', e));
    };

    const showNotification = (status: string) => {
        const notificationMap: Record<string, { title: string; message: string; type: Notification['type'] }> = {
            'APPROVED': { title: '✅ Prescription Approved', message: 'Your prescription has been approved!', type: 'success' },
            'REJECTED': { title: '❌ Prescription Rejected', message: 'Your prescription was rejected. Please contact the pharmacy.', type: 'error' },
            'PICKED_UP': { title: '📦 Ready for Pickup', message: 'Your prescription is ready for pickup!', type: 'info' }
        };

        const notification = notificationMap[status];
        if (notification) {
            const newNotif: Notification = {
                id: Date.now().toString(),
                ...notification
            };
            setNotifications(prev => [...prev, newNotif]);
            setTimeout(() => removeNotification(newNotif.id), 5000);
        }
    };

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2">
            {notifications.map(notif => (
                <div
                    key={notif.id}
                    className={`p-4 rounded-lg shadow-lg border-l-4 bg-white animate-in slide-in-from-right ${notif.type === 'success' ? 'border-green-500' :
                            notif.type === 'error' ? 'border-red-500' :
                                notif.type === 'warning' ? 'border-yellow-500' :
                                    'border-blue-500'
                        }`}
                >
                    <h4 className="font-bold text-gray-900">{notif.title}</h4>
                    <p className="text-sm text-gray-600">{notif.message}</p>
                </div>
            ))}
        </div>
    );
};

export default NotificationSystem;

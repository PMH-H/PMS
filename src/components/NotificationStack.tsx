import React, { useEffect, useState } from 'react';
import { useNotificationSystem } from '../context/NotificationContext';
import { Notification } from '../types';

const ToastItem: React.FC<{ notification: Notification; onClose: (id: string) => void }> = ({ notification, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        // Wait for exit animation
        setTimeout(() => onClose(notification.id), 300);
    };

    let bgColor = 'bg-slate-800';
    let icon = '🔔';

    switch (notification.type) {
        case 'ORDER_UPDATE':
            bgColor = 'bg-blue-600';
            icon = '📦';
            break;
        case 'PRESCRIPTION_READY':
            bgColor = 'bg-green-600';
            icon = '💊';
            break;
        case 'HEALTH_ALERT':
            bgColor = 'bg-red-600';
            icon = '⚠️';
            break;
        case 'PROMOTION':
            bgColor = 'bg-purple-600';
            icon = '🏷️';
            break;
    }

    return (
        <div
            className={`
                flex items-start gap-3 p-4 rounded-xl shadow-lg border border-white/10 text-white
                transition-all duration-300 transform 
                ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
                ${bgColor}
                max-w-sm w-full pointer-events-auto
            `}
            role="alert"
        >
            <span className="text-xl">{icon}</span>
            <div className="flex-1">
                <p className="font-medium text-sm leading-snug">{notification.message}</p>
                <p className="text-xs opacity-70 mt-1">{new Date(notification.timestamp).toLocaleTimeString()}</p>
            </div>
            <button
                onClick={handleClose}
                className="text-white/60 hover:text-white transition-colors"
                aria-label="Close"
            >
                ✕
            </button>
        </div>
    );
};

export const NotificationStack: React.FC = () => {
    const { notifications, markAsRead } = useNotificationSystem();
    // Only show unread notifications in the toast stack, or limit to recent ones
    // For now, let's show the last 3 visible ones that are recent. 
    // Usually contexts remove them after a timeout, but we can also just show "unread local state"

    // Filter to show only active/unread ones if you want, 
    // or rely on the context's auto-dismiss logic.
    // Let's assume context handles the list of "active toasts"

    const visibleNotifications = notifications.slice(0, 3); // Max 3 at a time

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none p-4">
            {visibleNotifications.map(n => (
                <ToastItem
                    key={n.id}
                    notification={n}
                    onClose={(id) => markAsRead(id)}
                />
            ))}
        </div>
    );
};

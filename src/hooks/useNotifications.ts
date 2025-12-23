import { useState, useCallback, useRef } from 'react';

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
    duration?: number;
}

// Simple beep sound encoded as Data URI to avoid external dependencies
const NOTIFICATION_SOUND = "data:audio/wav;base64,UklGRl9vT1dAVXphYXJ0"; // Placeholder: In real app, use a real .mp3 file

export const useNotifications = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize audio once
    if (!audioRef.current && typeof window !== 'undefined') {
        // Use a pleasant chime sound URL
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audioRef.current.volume = 0.5;
    }

    const playSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.warn("Audio play blocked", e));
        }
    }, []);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info', duration = 5000) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        const newToast: Toast = { id, message, type, duration };

        setToasts(prev => [...prev, newToast]);

        // Play sound for all except generic info if desired, or just for everything
        playSound();

    }, [playSound]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const success = useCallback((message: string) => addToast(message, 'success'), [addToast]);
    const error = useCallback((message: string) => addToast(message, 'error'), [addToast]);
    const warning = useCallback((message: string) => addToast(message, 'warning'), [addToast]);
    const info = useCallback((message: string) => addToast(message, 'info'), [addToast]);

    return {
        toasts,
        addToast,
        removeToast,
        success,
        error,
        warning,
        info,
    };
};

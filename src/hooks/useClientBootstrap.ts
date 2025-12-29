import { useState, useEffect } from 'react';
import { bootstrapClient } from '../services/apiService';
import { Prescription, User } from '../types';

interface BootstrapData {
    profile: User;
    active_rx_summary: Prescription[];
    unread_notifications: number;
    last_activity: string;
    feature_flags: Record<string, boolean>;
}

export const useClientBootstrap = () => {
    const [data, setData] = useState<BootstrapData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const load = async () => {
            try {
                const result = await bootstrapClient();
                if (mounted) {
                    setData(result);
                    setLoading(false);
                }
            } catch (err: any) {
                if (mounted) {
                    console.warn("Bootstrap failed, falling back to legacy flow:", err);
                    setError(err.message || 'Failed to bootstrap');
                    setLoading(false);
                }
            }
        };

        load();

        return () => {
            mounted = false;
        };
    }, []);

    return { data, loading, error };
};

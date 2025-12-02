import React, { useEffect, useState } from 'react';
import MetricCard from './MetricCard';
import { supabase } from '../services/supabase';

interface MetricConfig {
    id: string;
    title: string;
    event_name: string;
    visualization_type: string;
    default_value: string;
    enabled: boolean;
}

interface MetricGridProps {
    facilityId?: string | null;
}

const MetricGrid: React.FC<MetricGridProps> = ({ facilityId }) => {
    const [configs, setConfigs] = useState<MetricConfig[]>([]);
    const [events, setEvents] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadConfigs();
        subscribeToEvents();
    }, [facilityId]);

    const loadConfigs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('metric_configs')
                .select('*')
                .eq('enabled', true)
                .order('priority', { ascending: true });

            if (error) throw error;
            setConfigs(data || []);
        } catch (err) {
            console.error('Error loading metric configs:', err);
        } finally {
            setLoading(false);
        }
    };

    const subscribeToEvents = () => {
        const channel = supabase
            .channel('metric-events')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'metric_events',
                    filter: facilityId ? `facility_id=eq.${facilityId}` : undefined
                },
                (payload) => {
                    const evt = payload.new as any;
                    setEvents(prev => ({
                        ...prev,
                        [evt.name]: evt.payload
                    }));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configs.map(cfg => {
                const eventData = events[cfg.event_name];
                const value = eventData?.value ?? cfg.default_value ?? '—';
                const delta = eventData?.delta;
                const sparkData = eventData?.sparkline;

                return (
                    <MetricCard
                        key={cfg.id}
                        id={cfg.id}
                        title={cfg.title}
                        value={value}
                        delta={delta}
                        sparkData={sparkData}
                        onConfigure={() => {/* TODO: Open config modal */ }}
                    />
                );
            })}
        </div>
    );
};

export default MetricGrid;

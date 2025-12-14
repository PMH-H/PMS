import { useEffect } from 'react';
import { supabase } from '../services/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

type TableName = 'prescriptions' | 'sales' | 'items' | 'item_batches' | 'alerts' | 'messages';

export const useRealtimeSubscription = (
    tables: TableName[],
    onUpdate: (table: TableName, payload: any) => void
) => {
    useEffect(() => {
        const channels: RealtimeChannel[] = [];

        tables.forEach(table => {
            const channel = supabase
                .channel(`public:${table}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: table },
                    (payload) => {
                        onUpdate(table, payload);
                    }
                )
                .subscribe();

            channels.push(channel);
        });

        return () => {
            channels.forEach(channel => supabase.removeChannel(channel));
        };
    }, [tables, onUpdate]);
};

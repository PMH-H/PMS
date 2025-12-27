import { supabaseCore } from './supabaseCore';

// Realtime subscription helper
// Only load this module when you actually need to subscribe
export const subscribeToChanges = (
    channelName: string,
    eventInfo: { event: string, schema: string, table: string, filter?: string },
    callback: (payload: any) => void
) => {
    return supabaseCore
        .channel(channelName)
        .on('postgres_changes', eventInfo as any, callback)
        .subscribe();
};

export const removeChannel = (channel: any) => {
    return supabaseCore.removeChannel(channel);
};

// Storage helper
export const uploadFile = async (bucket: string, path: string, file: File) => {
    return supabaseCore.storage.from(bucket).upload(path, file);
};

export const getPublicUrl = (bucket: string, path: string) => {
    return supabaseCore.storage.from(bucket).getPublicUrl(path);
};

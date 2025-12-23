import { supabase } from './supabase';

export interface PlatformSetting {
    id: string;
    key: string;
    value: any;
    label: string;
    description: string;
}

export const getPlatformSettings = async (): Promise<PlatformSetting[]> => {
    const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .order('key');

    if (error) throw error;
    return data || [];
};

export const updatePlatformSetting = async (key: string, value: any) => {
    const { error } = await supabase
        .from('platform_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);

    if (error) throw error;
};

export const getFeatureFlag = async (key: string): Promise<boolean> => {
    const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', key)
        .single();

    return data?.value === true;
};

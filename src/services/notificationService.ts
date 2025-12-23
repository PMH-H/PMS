import { supabase } from './supabase';

export type NotificationChannel = 'PUSH' | 'EMAIL' | 'SMS';

interface SendNotificationParams {
    userId: string;
    title: string;
    message: string;
    type: 'ORDER_UPDATE' | 'HEALTH_ALERT' | 'NEWS' | 'CHANNEL_MESSAGE' | 'PROMOTION' | 'PRESCRIPTION_READY';
    channels?: NotificationChannel[];
    metadata?: any;
}

/**
 * Centralized service for sending notifications across multiple channels.
 * Checks user preferences before sending.
 */
export const sendNotification = async ({
    userId,
    title,
    message,
    type,
    channels = ['PUSH'], // Default to Push/In-App only
    metadata = {}
}: SendNotificationParams) => {
    try {
        // 1. Fetch User Preferences to respect opt-outs
        const { data: prefs } = await supabase
            .from('notification_preferences')
            .select('*')
            .eq('user_id', userId)
            .single();

        // Default to true if no prefs found
        const emailEnabled = prefs?.email_notifications ?? true;
        const smsEnabled = prefs?.sms_notifications ?? true;

        // TODO: specific type checks (e.g. if prefs.news is false, don't send NEWS)

        // 2. Insert into In-App Notifications (Always unless critical system error)
        if (channels.includes('PUSH')) {
            const { error } = await supabase.from('notifications').insert({
                user_id: userId,
                title,
                message,
                type,
                is_read: false,
                metadata
            });
            if (error) console.error('Failed to save in-app notification', error);
        }

        // 3. Handle External Channels (Email/SMS) via Edge Function
        const externalChannels = [];
        if (channels.includes('EMAIL') && emailEnabled) externalChannels.push('EMAIL');
        if (channels.includes('SMS') && smsEnabled) externalChannels.push('SMS');

        if (externalChannels.length > 0) {
            // Call Edge Function to handle third-party APIs (Resend, Twilio)
            // This prevents exposing API keys on the client
            const { error: edgeError } = await supabase.functions.invoke('send-notification-external', {
                body: {
                    userId,
                    title,
                    message,
                    channels: externalChannels,
                    metadata
                }
            });
            if (edgeError) {
                console.warn('Failed to invoke external notification function', edgeError);
                // Fallback or retry logic here
            }
        }

        return { success: true };
    } catch (err) {
        console.error('Error in sendNotification:', err);
        return { success: false, error: err };
    }
};

/**
 * Schedule a future notification (e.g. for medication reminders)
 */
export const scheduleNotification = async (
    params: SendNotificationParams & { scheduledAt: Date }
) => {
    // Determine the user's preferred timezone offset or handle UTC
    // Logic to insert into a 'scheduled_notifications' table or Cron job
    console.log('Scheduling notification for', params.scheduledAt);
    // Placeholder implementation
    return { success: true, id: 'mock-schedule-id' };
};

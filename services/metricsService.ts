// services/metricsService.ts
// Centralized service for logging metrics to the database

import { supabase } from './supabase';

// Metric categories matching the database enum
type MetricCategory = 'auth' | 'business' | 'performance' | 'security' | 'compliance' | 'system' | 'user' | 'ai';

// Auth event types
type AuthEventType =
    | 'login_success'
    | 'login_failed'
    | 'logout'
    | 'password_reset_request'
    | 'password_reset_complete'
    | 'session_expired'
    | 'token_refresh'
    | 'mfa_enabled'
    | 'mfa_disabled';

// AI metrics tracking
interface AIMetricData {
    action: string;
    success: boolean;
    responseTimeMs: number;
    tokensUsed?: number;
    error?: string;
    metadata?: Record<string, any>;
}

/**
 * Log an AI/ML metric (prescription parsing, chat, etc.)
 */
export const logAIMetric = async (data: AIMetricData): Promise<void> => {
    try {
        const { error } = await supabase
            .from('system_metrics')
            .insert({
                metric_category: 'ai',
                metric_name: data.action,
                metric_value: data.success ? 1 : 0,
                metric_unit: 'success_rate',
                recorded_at: new Date().toISOString(),
            });

        // Also log response time
        if (data.responseTimeMs > 0) {
            await supabase
                .from('system_metrics')
                .insert({
                    metric_category: 'ai',
                    metric_name: `${data.action}_response_time`,
                    metric_value: data.responseTimeMs,
                    metric_unit: 'ms',
                    recorded_at: new Date().toISOString(),
                });
        }

        if (error) {
            console.warn('[metricsService] Failed to log AI metric:', error);
        }
    } catch (err) {
        console.warn('[metricsService] AI metric logging failed:', err);
    }
};

/**
 * Log an authentication event
 */
export const logAuthEvent = async (
    userId: string | null,
    eventType: AuthEventType,
    success: boolean = true,
    metadata?: Record<string, any>,
    failureReason?: string
): Promise<void> => {
    try {
        const { error } = await supabase
            .from('auth_events')
            .insert({
                user_id: userId,
                event_type: eventType,
                success,
                failure_reason: failureReason,
                metadata: metadata || {},
                created_at: new Date().toISOString(),
            });

        if (error) {
            console.warn('[metricsService] Failed to log auth event:', error);
        }
    } catch (err) {
        console.warn('[metricsService] Auth event logging failed:', err);
    }
};

/**
 * Log a security event
 */
export const logSecurityEvent = async (
    eventType: string,
    userId: string | null,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    description?: string,
    metadata?: Record<string, any>
): Promise<void> => {
    try {
        const { error } = await supabase
            .from('security_events')
            .insert({
                event_type: eventType,
                user_id: userId,
                severity,
                description,
                metadata: metadata || {},
                resolved: false,
                created_at: new Date().toISOString(),
            });

        if (error) {
            console.warn('[metricsService] Failed to log security event:', error);
        }
    } catch (err) {
        console.warn('[metricsService] Security event logging failed:', err);
    }
};

/**
 * Log a system metric
 */
export const logSystemMetric = async (
    name: string,
    value: number,
    unit: string = '',
    category: MetricCategory = 'system',
    facilityId?: string
): Promise<void> => {
    try {
        const { error } = await supabase
            .from('system_metrics')
            .insert({
                metric_category: category,
                metric_name: name,
                metric_value: value,
                metric_unit: unit,
                facility_id: facilityId,
                recorded_at: new Date().toISOString(),
            });

        if (error) {
            console.warn('[metricsService] Failed to log system metric:', error);
        }
    } catch (err) {
        console.warn('[metricsService] System metric logging failed:', err);
    }
};

/**
 * Log a business metric
 */
export const logBusinessMetric = async (
    name: string,
    value: number,
    unit: string = '',
    facilityId?: string
): Promise<void> => {
    return logSystemMetric(name, value, unit, 'business', facilityId);
};

/**
 * Log a performance metric
 */
export const logPerformanceMetric = async (
    name: string,
    value: number,
    unit: string = 'ms'
): Promise<void> => {
    return logSystemMetric(name, value, unit, 'performance');
};

/**
 * Utility: Measure and log execution time of an async function
 */
export const measureAndLog = async <T>(
    metricName: string,
    fn: () => Promise<T>,
    category: MetricCategory = 'performance'
): Promise<T> => {
    const start = performance.now();
    try {
        const result = await fn();
        const duration = Math.round(performance.now() - start);
        await logSystemMetric(metricName, duration, 'ms', category);
        return result;
    } catch (err) {
        const duration = Math.round(performance.now() - start);
        await logSystemMetric(`${metricName}_error`, duration, 'ms', category);
        throw err;
    }
};

/**
 * Get AI metrics summary
 */
export const getAIMetricsSummary = async (days: number = 7): Promise<{
    totalCalls: number;
    successRate: number;
    avgResponseTime: number;
    byAction: Record<string, { calls: number; successRate: number }>;
}> => {
    const since = new Date();
    since.setDate(since.getDate() - days);

    try {
        const { data, error } = await supabase
            .from('system_metrics')
            .select('*')
            .eq('metric_category', 'ai')
            .gte('recorded_at', since.toISOString());

        if (error || !data) {
            return { totalCalls: 0, successRate: 0, avgResponseTime: 0, byAction: {} };
        }

        const actionMetrics = data.filter(m => !m.metric_name.endsWith('_response_time'));
        const responseTimeMetrics = data.filter(m => m.metric_name.endsWith('_response_time'));

        const totalCalls = actionMetrics.length;
        const successCount = actionMetrics.filter(m => m.metric_value === 1).length;
        const successRate = totalCalls > 0 ? (successCount / totalCalls) * 100 : 0;

        const avgResponseTime = responseTimeMetrics.length > 0
            ? responseTimeMetrics.reduce((sum, m) => sum + m.metric_value, 0) / responseTimeMetrics.length
            : 0;

        // Group by action
        const byAction: Record<string, { calls: number; successRate: number }> = {};
        const actionGroups: Record<string, { total: number; success: number }> = {};

        for (const m of actionMetrics) {
            const action = m.metric_name;
            if (!actionGroups[action]) actionGroups[action] = { total: 0, success: 0 };
            actionGroups[action].total++;
            if (m.metric_value === 1) actionGroups[action].success++;
        }

        for (const action of Object.keys(actionGroups)) {
            const stats = actionGroups[action];
            byAction[action] = {
                calls: stats.total,
                successRate: stats.total > 0 ? (stats.success / stats.total) * 100 : 0,
            };
        }

        return {
            totalCalls,
            successRate: Math.round(successRate * 10) / 10,
            avgResponseTime: Math.round(avgResponseTime),
            byAction,
        };
    } catch (err) {
        console.error('[metricsService] Failed to get AI metrics summary:', err);
        return { totalCalls: 0, successRate: 0, avgResponseTime: 0, byAction: {} };
    }
};

export default {
    logAIMetric,
    logAuthEvent,
    logSecurityEvent,
    logSystemMetric,
    logBusinessMetric,
    logPerformanceMetric,
    measureAndLog,
    getAIMetricsSummary,
};

import React, { useEffect, useState, useCallback } from 'react';
import { supabase, checkSupabaseConnection } from '../services/supabase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface HealthCheck {
    id: string;
    service: string;
    status: 'healthy' | 'degraded' | 'down';
    latency_ms: number;
    details?: string;
    checked_at: string;
}

interface DatabaseStats {
    totalTables: number;
    totalRows: number;
    connectionStatus: 'connected' | 'disconnected' | 'checking';
    responseTime: number;
}

const SystemMonitor: React.FC = () => {
    const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
    const [dbStats, setDbStats] = useState<DatabaseStats>({
        totalTables: 0,
        totalRows: 0,
        connectionStatus: 'checking',
        responseTime: 0,
    });
    const [loading, setLoading] = useState(true);
    const [lastCheck, setLastCheck] = useState<Date | null>(null);

    const performHealthChecks = useCallback(async () => {
        const checks: HealthCheck[] = [];
        const startTime = performance.now();

        // 1. Database Connection Check
        try {
            const dbStart = performance.now();
            const isConnected = await checkSupabaseConnection();
            const dbLatency = Math.round(performance.now() - dbStart);

            checks.push({
                id: 'db-connection',
                service: 'Database (Supabase)',
                status: isConnected ? 'healthy' : 'down',
                latency_ms: dbLatency,
                details: isConnected ? 'Connected to PostgreSQL' : 'Connection failed',
                checked_at: new Date().toISOString(),
            });

            setDbStats(prev => ({
                ...prev,
                connectionStatus: isConnected ? 'connected' : 'disconnected',
                responseTime: dbLatency,
            }));
        } catch (err) {
            checks.push({
                id: 'db-connection',
                service: 'Database (Supabase)',
                status: 'down',
                latency_ms: 0,
                details: 'Connection check failed',
                checked_at: new Date().toISOString(),
            });
        }

        // 2. Auth Service Check
        try {
            const authStart = performance.now();
            const { data: session } = await supabase.auth.getSession();
            const authLatency = Math.round(performance.now() - authStart);

            checks.push({
                id: 'auth-service',
                service: 'Authentication',
                status: 'healthy',
                latency_ms: authLatency,
                details: session?.session ? 'Session active' : 'No active session',
                checked_at: new Date().toISOString(),
            });
        } catch (err) {
            checks.push({
                id: 'auth-service',
                service: 'Authentication',
                status: 'degraded',
                latency_ms: 0,
                details: 'Auth check failed',
                checked_at: new Date().toISOString(),
            });
        }

        // 3. Profiles Table Check (tests RLS and basic query)
        try {
            const profilesStart = performance.now();
            const { count, error } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true });
            const profilesLatency = Math.round(performance.now() - profilesStart);

            checks.push({
                id: 'profiles-table',
                service: 'Profiles Table',
                status: error ? 'degraded' : 'healthy',
                latency_ms: profilesLatency,
                details: error ? error.message : `${count || 0} profiles`,
                checked_at: new Date().toISOString(),
            });
        } catch (err) {
            checks.push({
                id: 'profiles-table',
                service: 'Profiles Table',
                status: 'down',
                latency_ms: 0,
                details: 'Query failed',
                checked_at: new Date().toISOString(),
            });
        }

        // 4. Prescriptions Table Check
        try {
            const rxStart = performance.now();
            const { count, error } = await supabase
                .from('prescriptions')
                .select('*', { count: 'exact', head: true });
            const rxLatency = Math.round(performance.now() - rxStart);

            checks.push({
                id: 'prescriptions-table',
                service: 'Prescriptions Table',
                status: error ? 'degraded' : 'healthy',
                latency_ms: rxLatency,
                details: error ? error.message : `${count || 0} prescriptions`,
                checked_at: new Date().toISOString(),
            });
        } catch (err) {
            checks.push({
                id: 'prescriptions-table',
                service: 'Prescriptions Table',
                status: 'down',
                latency_ms: 0,
                details: 'Query failed',
                checked_at: new Date().toISOString(),
            });
        }

        // 5. Storage Bucket Check
        try {
            const storageStart = performance.now();
            const { data, error } = await supabase.storage.listBuckets();
            const storageLatency = Math.round(performance.now() - storageStart);

            checks.push({
                id: 'storage',
                service: 'Storage (Buckets)',
                status: error ? 'degraded' : 'healthy',
                latency_ms: storageLatency,
                details: error ? error.message : `${data?.length || 0} buckets`,
                checked_at: new Date().toISOString(),
            });
        } catch (err) {
            checks.push({
                id: 'storage',
                service: 'Storage (Buckets)',
                status: 'degraded',
                latency_ms: 0,
                details: 'Storage check failed',
                checked_at: new Date().toISOString(),
            });
        }

        // 6. Realtime Connection Check
        try {
            const realtimeStart = performance.now();
            const channel = supabase.channel('health-check-' + Date.now());
            await new Promise<void>((resolve) => {
                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        supabase.removeChannel(channel);
                        resolve();
                    }
                });
                // Timeout after 3 seconds
                setTimeout(resolve, 3000);
            });
            const realtimeLatency = Math.round(performance.now() - realtimeStart);

            checks.push({
                id: 'realtime',
                service: 'Realtime',
                status: realtimeLatency < 3000 ? 'healthy' : 'degraded',
                latency_ms: realtimeLatency,
                details: realtimeLatency < 3000 ? 'Connected' : 'Slow connection',
                checked_at: new Date().toISOString(),
            });
        } catch (err) {
            checks.push({
                id: 'realtime',
                service: 'Realtime',
                status: 'down',
                latency_ms: 0,
                details: 'Realtime unavailable',
                checked_at: new Date().toISOString(),
            });
        }

        // Calculate overall latency
        const totalLatency = Math.round(performance.now() - startTime);

        setHealthChecks(checks);
        setLastCheck(new Date());
        setLoading(false);

        // Store in history for chart
        return checks;
    }, []);

    // Fetch database statistics
    const fetchDbStats = useCallback(async () => {
        try {
            // Count key tables
            const [profiles, prescriptions, facilities, items] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('prescriptions').select('*', { count: 'exact', head: true }),
                supabase.from('facilities').select('*', { count: 'exact', head: true }),
                supabase.from('items').select('*', { count: 'exact', head: true }),
            ]);

            const totalRows =
                (profiles.count || 0) +
                (prescriptions.count || 0) +
                (facilities.count || 0) +
                (items.count || 0);

            setDbStats(prev => ({
                ...prev,
                totalTables: 4, // Main tables we track
                totalRows,
            }));
        } catch (err) {
            console.error('Error fetching DB stats:', err);
        }
    }, []);

    useEffect(() => {
        performHealthChecks();
        fetchDbStats();

        // Refresh every 30 seconds
        const interval = setInterval(() => {
            performHealthChecks();
            fetchDbStats();
        }, 30000);

        return () => clearInterval(interval);
    }, [performHealthChecks, fetchDbStats]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'text-green-400';
            case 'degraded': return 'text-yellow-400';
            case 'down': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'healthy': return 'bg-green-500';
            case 'degraded': return 'bg-yellow-500';
            case 'down': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    const avgLatency = healthChecks.length > 0
        ? Math.round(healthChecks.reduce((sum, h) => sum + h.latency_ms, 0) / healthChecks.length)
        : 0;

    const healthyCount = healthChecks.filter(h => h.status === 'healthy').length;
    const overallHealth = healthChecks.length > 0
        ? healthyCount === healthChecks.length ? 'All Systems Operational'
            : healthyCount > healthChecks.length / 2 ? 'Partial Issues'
                : 'System Issues Detected'
        : 'Checking...';

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                <span className="ml-3 text-gray-500">Running health checks...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Overall Status Banner */}
            <div className={`p-4 rounded-xl flex items-center justify-between ${healthyCount === healthChecks.length ? 'bg-green-50 border border-green-200' :
                    healthyCount > healthChecks.length / 2 ? 'bg-yellow-50 border border-yellow-200' :
                        'bg-red-50 border border-red-200'
                }`}>
                <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${healthyCount === healthChecks.length ? 'bg-green-500 animate-pulse' :
                            healthyCount > healthChecks.length / 2 ? 'bg-yellow-500' :
                                'bg-red-500'
                        }`}></span>
                    <div>
                        <p className="font-bold text-gray-900">{overallHealth}</p>
                        <p className="text-xs text-gray-500">
                            {healthyCount}/{healthChecks.length} services healthy •
                            Avg latency: {avgLatency}ms •
                            Last check: {lastCheck?.toLocaleTimeString() || 'N/A'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => { setLoading(true); performHealthChecks(); fetchDbStats(); }}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Database Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 uppercase">DB Status</p>
                            <p className={`text-lg font-bold ${dbStats.connectionStatus === 'connected' ? 'text-green-600' :
                                    dbStats.connectionStatus === 'checking' ? 'text-gray-600' : 'text-red-600'
                                }`}>
                                {dbStats.connectionStatus === 'connected' ? 'Connected' :
                                    dbStats.connectionStatus === 'checking' ? 'Checking...' : 'Disconnected'}
                            </p>
                        </div>
                        <span className="text-2xl">🗄️</span>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 uppercase">Response Time</p>
                            <p className={`text-lg font-bold ${dbStats.responseTime < 100 ? 'text-green-600' :
                                    dbStats.responseTime < 500 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                {dbStats.responseTime}ms
                            </p>
                        </div>
                        <span className="text-2xl">⚡</span>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 uppercase">Total Records</p>
                            <p className="text-lg font-bold text-gray-900">
                                {dbStats.totalRows.toLocaleString()}
                            </p>
                        </div>
                        <span className="text-2xl">📊</span>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 uppercase">Tracked Tables</p>
                            <p className="text-lg font-bold text-gray-900">{dbStats.totalTables}</p>
                        </div>
                        <span className="text-2xl">🗃️</span>
                    </div>
                </div>
            </div>

            {/* Service Health Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-bold text-gray-900">Service Health Checks</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Service</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Latency</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Details</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Checked</th>
                            </tr>
                        </thead>
                        <tbody>
                            {healthChecks.map(check => (
                                <tr key={check.id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${getStatusBg(check.status)}`}></span>
                                            <span className="font-medium text-gray-900">{check.service}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${check.status === 'healthy' ? 'bg-green-100 text-green-800' :
                                                check.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                            }`}>
                                            {check.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <span className={`font-mono ${check.latency_ms < 100 ? 'text-green-600' :
                                                check.latency_ms < 500 ? 'text-yellow-600' :
                                                    'text-red-600'
                                            }`}>
                                            {check.latency_ms}ms
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-gray-500 text-xs">{check.details}</td>
                                    <td className="py-3 px-4 text-gray-400 text-xs">
                                        {new Date(check.checked_at).toLocaleTimeString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SystemMonitor;

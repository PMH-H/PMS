import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface HealthRecord {
    id: string;
    service: string;
    status: string;
    latency_ms: number;
    cpu_percent?: number;
    memory_mb?: number;
    created_at: string;
}

const SystemMonitor: React.FC = () => {
    const [health, setHealth] = useState<HealthRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHealth();
        subscribeToHealth();
    }, []);

    const loadHealth = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('system_health')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            setHealth(data || []);
        } catch (err) {
            console.error('Error loading system health:', err);
        } finally {
            setLoading(false);
        }
    };

    const subscribeToHealth = () => {
        const channel = supabase
            .channel('system-health')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'system_health'
                },
                (payload) => {
                    setHealth(prev => [payload.new as HealthRecord, ...prev].slice(0, 200));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const chartData = health.slice().reverse().map(h => ({
        time: new Date(h.created_at).toLocaleTimeString(),
        latency: h.latency_ms,
        cpu: h.cpu_percent,
        memory: h.memory_mb
    }));

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'text-green-400';
            case 'degraded': return 'text-yellow-400';
            case 'down': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">System Latency</h3>
                <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="time" stroke="#9CA3AF" />
                            <YAxis stroke="#9CA3AF" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                                labelStyle={{ color: '#F3F4F6' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="latency"
                                stroke="#10B981"
                                fill="#10B981"
                                fillOpacity={0.3}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">Recent Health Checks</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="text-left py-2 px-3 text-slate-400 font-medium">Service</th>
                                <th className="text-left py-2 px-3 text-slate-400 font-medium">Status</th>
                                <th className="text-right py-2 px-3 text-slate-400 font-medium">Latency (ms)</th>
                                <th className="text-right py-2 px-3 text-slate-400 font-medium">CPU %</th>
                                <th className="text-right py-2 px-3 text-slate-400 font-medium">Memory (MB)</th>
                                <th className="text-left py-2 px-3 text-slate-400 font-medium">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {health.slice(0, 20).map(h => (
                                <tr key={h.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                    <td className="py-2 px-3 text-white">{h.service}</td>
                                    <td className={`py-2 px-3 font-medium ${getStatusColor(h.status)}`}>
                                        {h.status}
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-300">{h.latency_ms}</td>
                                    <td className="py-2 px-3 text-right text-slate-300">{h.cpu_percent || '—'}</td>
                                    <td className="py-2 px-3 text-right text-slate-300">{h.memory_mb || '—'}</td>
                                    <td className="py-2 px-3 text-slate-400 text-xs">
                                        {new Date(h.created_at).toLocaleTimeString()}
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

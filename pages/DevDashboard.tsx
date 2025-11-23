
import React, { useState, useEffect } from 'react';
import { MetricConfig, SystemHealth } from '../types';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { supabase, checkSupabaseConnection } from '../services/supabase';

// --- MOCK CONSTANTS (Kept for UI structure) ---

const INITIAL_METRICS: MetricConfig[] = [
    // SALES
    { id: 'm1', category: 'SALES', label: 'Sales Velocity', description: 'Rate of sales per hour', isEnabled: true, widgetType: 'CHART' },
    { id: 'm2', category: 'SALES', label: 'Avg Order Value', description: 'Average basket size', isEnabled: false, widgetType: 'CARD' },
    // INVENTORY
    { id: 'm3', category: 'INVENTORY', label: 'Inventory Turnover', description: 'Ratio of sold vs stock', isEnabled: true, widgetType: 'CARD' },
    { id: 'm4', category: 'INVENTORY', label: 'ABC Analysis Class', description: 'Breakdown of inventory by value class', isEnabled: false, widgetType: 'CHART' },
    { id: 'm5', category: 'INVENTORY', label: 'Expiry Risk Heatmap', description: 'Items expiring in < 30 days', isEnabled: true, widgetType: 'LIST' },
    // SYSTEM
    { id: 'm6', category: 'SYSTEM', label: 'API Latency', description: 'Avg response time (ms)', isEnabled: true, widgetType: 'CHART' },
    { id: 'm7', category: 'SYSTEM', label: 'DB Connections', description: 'Active pool connections', isEnabled: true, widgetType: 'CARD' },
    { id: 'm8', category: 'SYSTEM', label: 'Error Rate (5xx)', description: '% of failed requests', isEnabled: false, widgetType: 'CARD' },
    // DEV
    { id: 'm9', category: 'DEV', label: 'AI Token Usage', description: 'Gemini API tokens consumed', isEnabled: true, widgetType: 'CARD' },
    { id: 'm10', category: 'DEV', label: 'Active Webhooks', description: 'Third-party integrations status', isEnabled: false, widgetType: 'LIST' },
];

const DevDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'MONITOR' | 'BUILDER' | 'USERS' | 'DEV_TOOLS'>('MONITOR');
    const [metrics, setMetrics] = useState<MetricConfig[]>(INITIAL_METRICS);
    const [logs, setLogs] = useState<string[]>([]);
    const [systemHealth, setSystemHealth] = useState<SystemHealth[]>([
        { service: 'API Gateway', status: 'OK', latency: 45, uptime: 99.99 },
        { service: 'PostgreSQL DB', status: 'WARN', latency: 0, uptime: 0 }, // Initial state
        { service: 'Gemini AI Integration', status: 'OK', latency: 450, uptime: 98.50 },
        { service: 'Redis Cache', status: 'OK', latency: 2, uptime: 99.99 },
        { service: 'Notification Service', status: 'OK', latency: 12, uptime: 99.9 },
    ]);
    const [users, setUsers] = useState<any[]>([]);

    // Fetch Real Logs & Subscribe
    useEffect(() => {
        const fetchLogs = async () => {
            const { data } = await supabase
                .from('audit_log')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) {
                setLogs(data.map(l => `[${new Date(l.created_at).toLocaleTimeString()}] ${l.action} on ${l.resource_type} (${l.resource_id}) by ${l.performed_by}`));
            }
        };

        fetchLogs();

        const channel = supabase
            .channel('audit_log_changes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'audit_log' },
                (payload) => {
                    const l = payload.new;
                    const logMsg = `[${new Date(l.created_at).toLocaleTimeString()}] ${l.action} on ${l.resource_type} (${l.resource_id}) by ${l.performed_by}`;
                    setLogs(prev => [logMsg, ...prev].slice(0, 100));
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, []);

    // Check System Health
    useEffect(() => {
        const checkHealth = async () => {
            const start = performance.now();
            const isConnected = await checkSupabaseConnection();
            const latency = Math.round(performance.now() - start);

            setSystemHealth(prev => prev.map(s => {
                if (s.service === 'PostgreSQL DB') {
                    return {
                        ...s,
                        status: isConnected ? 'OK' : 'CRIT',
                        latency: isConnected ? latency : 0,
                        uptime: isConnected ? 100 : 0
                    };
                }
                return s;
            }));
        };

        checkHealth();
        const interval = setInterval(checkHealth, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    // Fetch Users
    useEffect(() => {
        const fetchUsers = async () => {
            const { data } = await supabase.from('profiles').select('*');
            if (data) setUsers(data);
        };
        fetchUsers();
    }, []);

    const toggleMetric = (id: string) => {
        setMetrics(prev => prev.map(m => m.id === id ? { ...m, isEnabled: !m.isEnabled } : m));
    };

    // --- RENDERERS ---

    const renderBuilder = () => (
        <div className="animate-in fade-in duration-300">
            <div className="bg-slate-900 text-white p-6 rounded-2xl mb-6">
                <h2 className="text-2xl font-bold mb-2">Dashboard Builder</h2>
                <p className="text-slate-400">Toggle metrics ON/OFF to configure the real-time monitoring dashboard.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {['SALES', 'INVENTORY', 'SYSTEM', 'DEV'].map(category => (
                    <div key={category} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-900 mb-4 border-b pb-2">{category} Metrics</h3>
                        <div className="space-y-3">
                            {metrics.filter(m => m.category === category).map(m => (
                                <div key={m.id} className="flex items-center justify-between">
                                    <div className="text-sm">
                                        <p className="font-medium text-gray-800">{m.label}</p>
                                        <p className="text-xs text-gray-500">{m.description}</p>
                                    </div>
                                    <button
                                        onClick={() => toggleMetric(m.id)}
                                        className={`w-12 h-6 rounded-full relative transition-colors ${m.isEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${m.isEnabled ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderMonitor = () => {
        const enabledMetrics = metrics.filter(m => m.isEnabled);

        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                {/* System Status Ticker */}
                <div className="flex gap-4 overflow-x-auto pb-2">
                    {systemHealth.map((s, i) => (
                        <div key={i} className={`flex-shrink-0 p-3 rounded-lg border flex items-center gap-3 min-w-[200px] ${s.status === 'OK' ? 'bg-green-50 border-green-200' :
                                s.status === 'WARN' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
                            }`}>
                            <div className={`w-3 h-3 rounded-full ${s.status === 'OK' ? 'bg-green-500' :
                                    s.status === 'WARN' ? 'bg-yellow-500' : 'bg-red-500'
                                }`} />
                            <div>
                                <p className="text-xs font-bold text-gray-700">{s.service}</p>
                                <p className="text-xs text-gray-500">{s.latency}ms | {s.uptime}%</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {enabledMetrics.map(m => (
                        <div key={m.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{m.category}</p>
                                    <h3 className="font-bold text-lg text-gray-900">{m.label}</h3>
                                </div>
                                <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded">{m.widgetType}</span>
                            </div>

                            {/* MOCK WIDGET RENDERER */}
                            <div className="h-40 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100 border-dashed relative overflow-hidden">
                                {m.widgetType === 'CHART' ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={[...Array(10)].map((_, i) => ({ val: Math.random() * 100 }))}>
                                            <Area type="monotone" dataKey="val" stroke="#6366f1" fill="#e0e7ff" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : m.widgetType === 'LIST' ? (
                                    <div className="w-full h-full p-2 space-y-2 overflow-hidden">
                                        <div className="h-2 bg-gray-200 rounded w-3/4 animate-pulse" />
                                        <div className="h-2 bg-gray-200 rounded w-full animate-pulse" />
                                        <div className="h-2 bg-gray-200 rounded w-1/2 animate-pulse" />
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <p className="text-4xl font-bold text-indigo-600">{Math.floor(Math.random() * 1000)}</p>
                                        <p className="text-xs text-gray-400 mt-1">Live Count</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {enabledMetrics.length === 0 && (
                        <div className="col-span-full text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
                            <p className="text-gray-400 font-medium">No metrics enabled.</p>
                            <button onClick={() => setActiveTab('BUILDER')} className="text-indigo-600 font-bold mt-2 hover:underline">Go to Builder</button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderUsers = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 text-lg">Platform Users & Roles</h3>
                <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700">Add User</button>
            </div>
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                    <tr>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Facility</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {users.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-bold text-gray-900">{u.full_name || 'Unknown'}</td>
                            <td className="px-6 py-4"><span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">{u.role}</span></td>
                            <td className="px-6 py-4 text-gray-600">{u.facility_id || 'N/A'}</td>
                            <td className="px-6 py-4 text-right">
                                <button className="text-indigo-600 font-bold hover:underline">Edit</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderDevTools = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300 h-[600px]">
            {/* Console Logs */}
            <div className="lg:col-span-2 bg-slate-900 text-green-400 font-mono text-xs p-4 rounded-xl shadow-lg overflow-y-auto flex flex-col">
                <div className="border-b border-slate-700 pb-2 mb-2 flex justify-between">
                    <span className="font-bold text-white">System Logs (Live)</span>
                    <span className="animate-pulse text-red-400">● LIVE</span>
                </div>
                <div className="space-y-1 flex-grow overflow-auto">
                    {logs.map((log, i) => (
                        <div key={i} className="hover:bg-slate-800 p-0.5 rounded px-2">{log}</div>
                    ))}
                </div>
            </div>

            {/* Tools Panel */}
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-900 mb-4">Feature Flags</h3>
                    <div className="space-y-4">
                        {['New_Checkout_Flow', 'Beta_AI_Model', 'Dark_Mode_V2', 'Legacy_Sync'].map(flag => (
                            <div key={flag} className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">{flag}</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" defaultChecked={Math.random() > 0.5} />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-900 mb-4">Maintenance</h3>
                    <button className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg text-sm font-bold mb-2 hover:bg-red-100">
                        Clear Redis Cache
                    </button>
                    <button className="w-full bg-slate-100 text-slate-700 border border-slate-200 py-2 rounded-lg text-sm font-bold hover:bg-slate-200">
                        Restart Background Workers
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="pb-10 min-h-screen">
            <div className="bg-slate-900 text-white -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-8 mb-8 shadow-md">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold mb-1">System Architect Console</h1>
                        <p className="text-slate-400 text-sm">Platform Control & Developer Tools</p>
                    </div>
                    <div className="flex bg-slate-800 p-1 rounded-lg">
                        {['MONITOR', 'BUILDER', 'USERS', 'DEV_TOOLS'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === tab ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {tab.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {activeTab === 'MONITOR' && renderMonitor()}
                {activeTab === 'BUILDER' && renderBuilder()}
                {activeTab === 'USERS' && renderUsers()}
                {activeTab === 'DEV_TOOLS' && renderDevTools()}
            </div>
        </div>
    );
};

export default DevDashboard;

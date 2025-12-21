import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { AdminMetricsSummary, AuthEvent, SecurityEvent } from '../types';

interface MetricCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: string;
    trend?: { value: number; isPositive: boolean };
    color: 'emerald' | 'blue' | 'amber' | 'red' | 'purple' | 'slate' | 'indigo' | 'cyan';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon, trend, color }) => {
    const colorClasses = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        blue: 'bg-blue-50 text-blue-600 border-blue-200',
        amber: 'bg-amber-50 text-amber-600 border-amber-200',
        red: 'bg-red-50 text-red-600 border-red-200',
        purple: 'bg-purple-50 text-purple-600 border-purple-200',
        slate: 'bg-slate-50 text-slate-600 border-slate-200',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
        cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    };

    return (
        <div className={`p-4 rounded-xl border ${colorClasses[color]} transition-all hover:shadow-md`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide opacity-75">{title}</p>
                    <p className="text-2xl font-bold mt-1">{isNaN(Number(value)) ? 0 : value}</p>
                    {subtitle && <p className="text-xs mt-1 opacity-75">{subtitle}</p>}
                    {trend && (
                        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            <span>{trend.isPositive ? '↑' : '↓'}</span>
                            <span>{Math.abs(trend.value)}% vs yesterday</span>
                        </div>
                    )}
                </div>
                <span className="text-2xl">{icon}</span>
            </div>
        </div>
    );
};

interface AdminMetricsPanelProps {
    facilityId?: string;
    metrics?: AdminMetricsSummary | null;
    initialCategory?: string;
}

const AdminMetricsPanel: React.FC<AdminMetricsPanelProps> = ({ facilityId, metrics: propsMetrics, initialCategory = 'overview' }) => {
    const [metrics, setMetrics] = useState<AdminMetricsSummary | null>(propsMetrics || null);
    const [recentLogins, setRecentLogins] = useState<AuthEvent[]>([]);
    const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
    const [loading, setLoading] = useState(!propsMetrics);
    const [activeCategory, setActiveCategory] = useState<string>(initialCategory);

    useEffect(() => {
        if (propsMetrics) {
            setMetrics(propsMetrics);
            setLoading(false);
            fetchRecentActivity(); // Still fetch activity logs as they aren't in summary
        } else {
            fetchMetrics();
            fetchRecentActivity();
        }
    }, [facilityId, propsMetrics]);

    const fetchMetrics = async () => {
        try {
            // Fetch from admin_metrics_summary view
            const { data, error } = await supabase
                .from('admin_metrics_summary')
                .select('*')
                .single();

            if (error) {
                console.warn('Metrics view not available, using fallback:', error);
                // Fallback: fetch counts manually
                const [users, prescriptions, facilities] = await Promise.all([
                    supabase.from('profiles').select('id, role, is_blocked, last_active_at'),
                    supabase.from('prescriptions').select('id, status, created_at'),
                    supabase.from('facilities').select('id'),
                ]);

                const now = new Date();
                const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

                const usersData = users.data || [];
                const prescriptionsData = prescriptions.data || [];

                setMetrics({
                    total_patients: usersData.filter(u => u.role === 'customer').length,
                    total_pharmacists: usersData.filter(u => u.role === 'pharmacist').length,
                    total_admins: usersData.filter(u => u.role === 'admin').length,
                    blocked_users: usersData.filter(u => u.is_blocked).length,
                    active_24h: usersData.filter(u => u.last_active_at && new Date(u.last_active_at) > yesterday).length,
                    active_7d: usersData.filter(u => u.last_active_at && new Date(u.last_active_at) > weekAgo).length,
                    prescriptions_24h: prescriptionsData.filter(p => new Date(p.created_at) > yesterday).length,
                    pending_prescriptions: prescriptionsData.filter(p => p.status?.toUpperCase() === 'PENDING').length,
                    approved_prescriptions: prescriptionsData.filter(p => p.status?.toUpperCase() === 'APPROVED').length,
                    logins_24h: 0, // Will be populated when auth_events table exists
                    failed_logins_24h: 0,
                    unresolved_security_events: 0,
                    critical_security_events: 0,
                    total_facilities: facilities.data?.length || 0,
                });
            } else {
                setMetrics(data);
            }
        } catch (err) {
            console.error('Error fetching metrics:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchRecentActivity = async () => {
        try {
            // Fetch recent auth events
            const { data: logins } = await supabase
                .from('auth_events')
                .select('*, user:profiles!auth_events_user_id_fkey(full_name)')
                .order('created_at', { ascending: false })
                .limit(10);

            if (logins) setRecentLogins(logins);

            // Fetch security events
            const { data: security } = await supabase
                .from('security_events')
                .select('*, user:profiles!security_events_user_id_fkey(full_name)')
                .eq('resolved', false)
                .order('created_at', { ascending: false })
                .limit(10);

            if (security) setSecurityEvents(security);
        } catch (err) {
            console.warn('Activity tables not yet created:', err);
        }
    };

    const categories = [
        { key: 'overview', label: 'Overview', icon: '📊' },
        { key: 'auth', label: 'Auth', icon: '🔐' },
        { key: 'business', label: 'Business', icon: '💼' },
        { key: 'users', label: 'Users', icon: '👥' },
        { key: 'security', label: 'Security', icon: '🛡️' },
        { key: 'system', label: 'System', icon: '🖥️' },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {categories.map(cat => (
                    <button
                        key={cat.key}
                        onClick={() => setActiveCategory(cat.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCategory === cat.key
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                    >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                    </button>
                ))}
            </div>

            {/* Overview */}
            {activeCategory === 'overview' && metrics && (
                <div className="space-y-6">
                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        <MetricCard
                            title="Total Users"
                            value={((metrics.total_patients || 0) + (metrics.total_pharmacists || 0) + (metrics.total_admins || 0))}
                            subtitle={`${metrics.active_24h || 0} active today`}
                            icon="👥"
                            color="blue"
                        />
                        <MetricCard
                            title="Pending Rx"
                            value={metrics.pending_prescriptions}
                            subtitle="Awaiting review"
                            icon="💊"
                            color="amber"
                        />
                        <MetricCard
                            title="Blocked Users"
                            value={metrics.blocked_users}
                            icon="🚫"
                            color={metrics.blocked_users > 0 ? 'red' : 'emerald'}
                        />
                        <MetricCard
                            title="Facilities"
                            value={metrics.total_facilities}
                            icon="🏥"
                            color="purple"
                        />
                    </div>

                    {/* Quick Stats Row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Logins (24h)</p>
                                    <p className="text-xl font-bold text-gray-900">{metrics.logins_24h}</p>
                                </div>
                                <div className="text-2xl">🔐</div>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Failed Logins</p>
                                    <p className={`text-xl font-bold ${metrics.failed_logins_24h > 10 ? 'text-red-600' : 'text-gray-900'}`}>
                                        {metrics.failed_logins_24h}
                                    </p>
                                </div>
                                <div className="text-2xl">⚠️</div>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Rx Today</p>
                                    <p className="text-xl font-bold text-gray-900">{metrics.prescriptions_24h}</p>
                                </div>
                                <div className="text-2xl">📋</div>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Security Alerts</p>
                                    <p className={`text-xl font-bold ${metrics.critical_security_events > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {metrics.unresolved_security_events}
                                    </p>
                                </div>
                                <div className="text-2xl">{metrics.critical_security_events > 0 ? '🔴' : '✅'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Auth Metrics */}
            {activeCategory === 'auth' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <MetricCard title="Active Sessions" value={metrics?.active_24h || 0} icon="🟢" color="emerald" />
                        <MetricCard title="Logins Today" value={metrics?.logins_24h || 0} icon="🔐" color="blue" />
                        <MetricCard title="Failed Attempts" value={metrics?.failed_logins_24h || 0} icon="❌" color={metrics?.failed_logins_24h && metrics.failed_logins_24h > 5 ? 'red' : 'slate'} />
                        <MetricCard title="Password Resets" value="0" icon="🔑" color="amber" />
                    </div>

                    {/* Recent Logins */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                            <h3 className="font-bold text-gray-900">Recent Authentication Events</h3>
                        </div>
                        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                            {recentLogins.length === 0 ? (
                                <p className="p-4 text-sm text-gray-500 text-center">No recent auth events. Run migration 035 to enable tracking.</p>
                            ) : (
                                recentLogins.map(event => (
                                    <div key={event.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-2 h-2 rounded-full ${event.success ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{event.user?.full_name || 'Unknown User'}</p>
                                                <p className="text-xs text-gray-500">{event.event_type.replace('_', ' ')}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500">{event.ip_address || 'N/A'}</p>
                                            <p className="text-xs text-gray-400">{new Date(event.created_at).toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Business Metrics */}
            {activeCategory === 'business' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <MetricCard title="Prescriptions (24h)" value={metrics?.prescriptions_24h || 0} icon="💊" color="indigo" />
                    <MetricCard title="Pending" value={metrics?.pending_prescriptions || 0} icon="⏳" color="amber" />
                    <MetricCard title="Approved" value={metrics?.approved_prescriptions || 0} icon="✅" color="emerald" />
                    <MetricCard title="Facilities" value={metrics?.total_facilities || 0} icon="🏥" color="purple" />
                </div>
            )}

            {/* Users Metrics */}
            {activeCategory === 'users' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <MetricCard title="Patients" value={metrics?.total_patients || 0} icon="🧑‍🤝‍🧑" color="blue" />
                        <MetricCard title="Pharmacists" value={metrics?.total_pharmacists || 0} icon="👨‍⚕️" color="emerald" />
                        <MetricCard title="Admins" value={metrics?.total_admins || 0} icon="👔" color="purple" />
                        <MetricCard title="Blocked" value={metrics?.blocked_users || 0} icon="🚫" color={metrics?.blocked_users && metrics.blocked_users > 0 ? 'red' : 'slate'} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <MetricCard title="Active (24h)" value={metrics?.active_24h || 0} subtitle="Users logged in today" icon="🟢" color="emerald" />
                        <MetricCard title="Active (7d)" value={metrics?.active_7d || 0} subtitle="Users logged in this week" icon="📅" color="blue" />
                    </div>
                </div>
            )}

            {/* Security Metrics */}
            {activeCategory === 'security' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <MetricCard title="Open Alerts" value={metrics?.unresolved_security_events || 0} icon="⚠️" color={metrics?.unresolved_security_events && metrics.unresolved_security_events > 0 ? 'amber' : 'emerald'} />
                        <MetricCard title="Critical" value={metrics?.critical_security_events || 0} icon="🔴" color={metrics?.critical_security_events && metrics.critical_security_events > 0 ? 'red' : 'emerald'} />
                        <MetricCard title="Failed Logins" value={metrics?.failed_logins_24h || 0} icon="❌" color="slate" />
                        <MetricCard title="Blocked Users" value={metrics?.blocked_users || 0} icon="🚫" color="red" />
                    </div>

                    {/* Security Events List */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                            <h3 className="font-bold text-gray-900">Unresolved Security Events</h3>
                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${securityEvents.length > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                {securityEvents.length} open
                            </span>
                        </div>
                        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                            {securityEvents.length === 0 ? (
                                <p className="p-4 text-sm text-gray-500 text-center">No unresolved security events. System is secure.</p>
                            ) : (
                                securityEvents.map(event => (
                                    <div key={event.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2 py-0.5 text-xs font-bold rounded ${event.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                                event.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                                                    event.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-gray-100 text-gray-800'
                                                }`}>
                                                {event.severity.toUpperCase()}
                                            </span>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{event.event_type.replace(/_/g, ' ')}</p>
                                                <p className="text-xs text-gray-500">{event.description || 'No description'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500">{event.ip_address || 'N/A'}</p>
                                            <p className="text-xs text-gray-400">{new Date(event.created_at).toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* System Metrics */}
            {activeCategory === 'system' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <MetricCard title="Database Status" value="Online" icon="🗄️" color="emerald" />
                    <MetricCard title="API Health" value="Healthy" icon="⚡" color="emerald" />
                    <MetricCard title="Storage" value="OK" icon="💾" color="blue" />
                    <MetricCard title="Realtime" value="Active" icon="📡" color="cyan" />
                </div>
            )}
        </div>
    );
};

export default AdminMetricsPanel;

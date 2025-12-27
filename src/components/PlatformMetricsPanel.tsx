import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import {
    getPlatformMetrics,
    PlatformMetrics,
    getPharmacistMetrics,
    getAdminMetrics,
    getUserHierarchy,
    PharmacistMetrics,
    AdminMetrics
} from '../services/userHierarchyService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar } from './RechartsWrapper';

interface PlatformMetricsPanelProps {
    currentUser?: User;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const PlatformMetricsPanel: React.FC<PlatformMetricsPanelProps> = ({ currentUser }) => {
    const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
    const [pharmacistMetrics, setPharmacistMetrics] = useState<PharmacistMetrics[]>([]);
    const [adminMetrics, setAdminMetrics] = useState<AdminMetrics[]>([]);
    const [loading, setLoading] = useState(true);
    const [drilldownView, setDrilldownView] = useState<'overview' | 'users' | 'facilities' | 'hierarchy'>('overview');
    const [selectedRole, setSelectedRole] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [platformData, pharmacistData, adminData] = await Promise.all([
                getPlatformMetrics(),
                getPharmacistMetrics(),
                getAdminMetrics(),
            ]);

            if (platformData.data) setMetrics(platformData.data);
            setPharmacistMetrics(pharmacistData.data);
            setAdminMetrics(adminData.data);
        } catch (err) {
            console.error('Error loading platform metrics:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    // Prepare user distribution data
    const userDistribution = [
        { name: 'Patients', value: metrics?.total_patients || 0, color: '#6366f1' },
        { name: 'Pharmacists', value: metrics?.total_pharmacists || 0, color: '#10b981' },
        { name: 'Admins', value: metrics?.total_admins || 0, color: '#f59e0b' },
        { name: 'Super Admins', value: metrics?.total_super_admins || 0, color: '#ef4444' },
    ];

    // Top performing pharmacists
    const topPharmacists = [...pharmacistMetrics]
        .sort((a, b) => b.prescriptions_week - a.prescriptions_week)
        .slice(0, 5);

    // Facility performance data
    const facilityData = adminMetrics.map(admin => ({
        name: admin.facility_name || 'Unknown',
        prescriptions: admin.total_prescriptions,
        staff: admin.total_pharmacists,
        patients: admin.total_patients,
    }));

    const tabs = [
        { key: 'overview', label: 'Platform Overview', icon: '🌐' },
        { key: 'users', label: 'User Analytics', icon: '👥' },
        { key: 'facilities', label: 'Facilities', icon: '🏥' },
        { key: 'hierarchy', label: 'Drill-Down', icon: '📊' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-xl p-6 text-white">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl">🌐</span>
                            Platform-Wide Metrics
                        </h2>
                        <p className="text-purple-200 text-sm mt-1">Complete visibility across all users, facilities, and operations</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-center px-4 py-2 bg-white/10 rounded-lg">
                            <p className="text-2xl font-bold">{metrics?.total_users || 0}</p>
                            <p className="text-xs text-purple-200">Total Users</p>
                        </div>
                        <div className="text-center px-4 py-2 bg-white/10 rounded-lg">
                            <p className="text-2xl font-bold">{metrics?.active_users_24h || 0}</p>
                            <p className="text-xs text-purple-200">Active Today</p>
                        </div>
                        <div className="text-center px-4 py-2 bg-white/10 rounded-lg">
                            <p className="text-2xl font-bold">{metrics?.total_facilities || 0}</p>
                            <p className="text-xs text-purple-200">Facilities</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setDrilldownView(tab.key as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${drilldownView === tab.key
                            ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Platform Overview */}
            {drilldownView === 'overview' && (
                <div className="space-y-6">
                    {/* Main KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white">
                            <p className="text-xs font-medium text-indigo-100 uppercase">Total Prescriptions</p>
                            <p className="text-3xl font-bold mt-2">{(metrics?.total_prescriptions || 0).toLocaleString()}</p>
                            <p className="text-xs text-indigo-200 mt-1">{metrics?.prescriptions_24h || 0} today</p>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white">
                            <p className="text-xs font-medium text-emerald-100 uppercase">Active Facilities</p>
                            <p className="text-3xl font-bold mt-2">{metrics?.active_facilities}/{metrics?.total_facilities}</p>
                            <p className="text-xs text-emerald-200 mt-1">{Math.round(((metrics?.active_facilities || 0) / Math.max(metrics?.total_facilities || 1, 1)) * 100)}% online</p>
                        </div>
                        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white">
                            <p className="text-xs font-medium text-amber-100 uppercase">Pending Prescriptions</p>
                            <p className="text-3xl font-bold mt-2">{metrics?.pending_prescriptions || 0}</p>
                            <p className="text-xs text-amber-200 mt-1">Awaiting review</p>
                        </div>
                        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-5 text-white">
                            <p className="text-xs font-medium text-red-100 uppercase">Security Alerts</p>
                            <p className="text-3xl font-bold mt-2">{metrics?.unresolved_security_events || 0}</p>
                            <p className="text-xs text-red-200 mt-1">{metrics?.failed_logins_24h || 0} failed logins today</p>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* User Distribution */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="font-bold text-gray-900 mb-4">User Distribution</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={userDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {userDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Activity Stats */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="font-bold text-gray-900 mb-4">User Activity</h3>
                            <div className="space-y-4">
                                <div className="p-4 bg-indigo-50 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="text-sm text-indigo-700 font-medium">Active (24h)</p>
                                        <p className="text-2xl font-bold text-indigo-900">{metrics?.active_users_24h || 0}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-indigo-200 rounded-full flex items-center justify-center">
                                        <span className="text-xl">👤</span>
                                    </div>
                                </div>
                                <div className="p-4 bg-emerald-50 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="text-sm text-emerald-700 font-medium">New This Week</p>
                                        <p className="text-2xl font-bold text-emerald-900">{metrics?.new_users_7d || 0}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-emerald-200 rounded-full flex items-center justify-center">
                                        <span className="text-xl">🆕</span>
                                    </div>
                                </div>
                                <div className="p-4 bg-amber-50 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="text-sm text-amber-700 font-medium">Logins Today</p>
                                        <p className="text-2xl font-bold text-amber-900">{metrics?.logins_24h || 0}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-amber-200 rounded-full flex items-center justify-center">
                                        <span className="text-xl">🔑</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* User Analytics */}
            {drilldownView === 'users' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                            { label: 'Patients', count: metrics?.total_patients, role: 'customer', color: 'indigo' },
                            { label: 'Pharmacists', count: metrics?.total_pharmacists, role: 'pharmacist', color: 'emerald' },
                            { label: 'Shop Owners', count: metrics?.total_admins, role: 'admin', color: 'amber' },
                            { label: 'Super Admins', count: metrics?.total_super_admins, role: 'super_admin', color: 'purple' },
                            { label: 'Blocked', count: metrics?.blocked_users, role: 'blocked', color: 'red' },
                        ].map(item => (
                            <button
                                key={item.role}
                                onClick={() => setSelectedRole(selectedRole === item.role ? null : item.role)}
                                className={`p-4 rounded-xl border transition-all ${selectedRole === item.role
                                    ? `bg-${item.color}-100 border-${item.color}-300`
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <p className="text-2xl font-bold text-gray-900">{item.count || 0}</p>
                                <p className="text-sm text-gray-500">{item.label}</p>
                            </button>
                        ))}
                    </div>

                    {/* Growth Stats */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <h3 className="font-bold text-gray-900 mb-4">Registration Growth</h3>
                        <div className="grid grid-cols-3 gap-6">
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                                <p className="text-3xl font-bold text-indigo-600">{metrics?.new_users_24h || 0}</p>
                                <p className="text-sm text-gray-500">Last 24h</p>
                            </div>
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                                <p className="text-3xl font-bold text-indigo-600">{metrics?.new_users_7d || 0}</p>
                                <p className="text-sm text-gray-500">Last 7 Days</p>
                            </div>
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                                <p className="text-3xl font-bold text-indigo-600">{metrics?.new_users_30d || 0}</p>
                                <p className="text-sm text-gray-500">Last 30 Days</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Facilities Tab */}
            {drilldownView === 'facilities' && (
                <div className="space-y-6">
                    {/* Facility Comparison Chart */}
                    {facilityData.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="font-bold text-gray-900 mb-4">Facility Performance Comparison</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={facilityData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="prescriptions" name="Prescriptions" fill="#6366f1" />
                                        <Bar dataKey="patients" name="Patients" fill="#10b981" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Facility Table */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-200">
                            <h3 className="font-bold text-gray-900">All Facilities ({adminMetrics.length})</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Facility</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Region</th>
                                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Staff</th>
                                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Patients</th>
                                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Prescriptions</th>
                                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Today</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {adminMetrics.map(admin => (
                                        <tr key={admin.admin_id} className="hover:bg-gray-50">
                                            <td className="py-3 px-4 font-medium text-gray-900">{admin.facility_name || 'Unknown'}</td>
                                            <td className="py-3 px-4 text-gray-500">{admin.region || '-'}</td>
                                            <td className="py-3 px-4 text-right">{admin.total_pharmacists}</td>
                                            <td className="py-3 px-4 text-right">{admin.total_patients}</td>
                                            <td className="py-3 px-4 text-right font-medium">{admin.total_prescriptions}</td>
                                            <td className="py-3 px-4 text-right">
                                                <span className={`font-medium ${admin.prescriptions_today > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                    {admin.prescriptions_today}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Hierarchy Drill-Down */}
            {drilldownView === 'hierarchy' && (
                <div className="space-y-6">
                    {/* Top Pharmacists */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <h3 className="font-bold text-gray-900 mb-4">🏆 Top Performing Pharmacists (This Week)</h3>
                        <div className="space-y-3">
                            {topPharmacists.map((pharmacist, index) => (
                                <div key={pharmacist.pharmacist_id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                                    <span className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold">
                                        {index + 1}
                                    </span>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">{pharmacist.pharmacist_name}</p>
                                        <p className="text-xs text-gray-500">{pharmacist.facility_name || 'No facility'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-indigo-600">{pharmacist.prescriptions_week}</p>
                                        <p className="text-xs text-gray-500">prescriptions</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AI Usage */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <h3 className="font-bold text-gray-900 mb-4">🤖 System Statistics</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-purple-50 rounded-lg text-center">
                                <p className="text-2xl font-bold text-purple-600">{metrics?.ai_calls_24h || 0}</p>
                                <p className="text-sm text-purple-700">AI Calls (24h)</p>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-lg text-center">
                                <p className="text-2xl font-bold text-blue-600">{metrics?.active_assignments || 0}</p>
                                <p className="text-sm text-blue-700">Patient Assignments</p>
                            </div>
                            <div className="p-4 bg-green-50 rounded-lg text-center">
                                <p className="text-2xl font-bold text-green-600">{metrics?.approved_prescriptions || 0}</p>
                                <p className="text-sm text-green-700">Approved Rx</p>
                            </div>
                            <div className="p-4 bg-gray-100 rounded-lg text-center">
                                <p className="text-2xl font-bold text-gray-600">{metrics?.blocked_users || 0}</p>
                                <p className="text-sm text-gray-700">Blocked Users</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlatformMetricsPanel;

import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User, UserRole } from '../types';

// Components
import AdminMetricsPanel from '../components/AdminMetricsPanel';
import UserAdminTable from '../components/UserAdminTable';
import FeatureFlagManager from '../components/FeatureFlagManager';
import SystemMonitor from '../components/SystemMonitor';
import DevTools from '../components/DevTools';
import AuditLogViewer from '../components/AuditLogViewer';
import CreateUserForm from '../components/CreateUserForm'; // Updated import
import PlatformMetricsPanel from '../components/PlatformMetricsPanel';

interface DevDashboardProps {
    currentUser: User;
    onUpdateUser?: (user: User) => void;
}

type TabKey = 'DASHBOARD' | 'PLATFORM' | 'METRICS' | 'USERS' | 'SECURITY' | 'SYSTEM' | 'DEV_TOOLS' | 'AUDIT_LOGS';

const DevDashboard: React.FC<DevDashboardProps> = ({ currentUser, onUpdateUser }) => {
    const [activeTab, setActiveTab] = useState<TabKey>('DASHBOARD');
    const [selectedFacilityFilter, setSelectedFacilityFilter] = useState<string | null>(null);

    const tabs: { key: TabKey; label: string; icon: string }[] = [
        { key: 'DASHBOARD', label: 'Dashboard', icon: '📊' },
        { key: 'PLATFORM', label: 'Platform', icon: '🌐' },
        { key: 'METRICS', label: 'Metrics', icon: '📈' },
        { key: 'USERS', label: 'Users', icon: '👥' },
        { key: 'SECURITY', label: 'Security', icon: '🛡️' },
        { key: 'SYSTEM', label: 'System', icon: '⚙️' },
        { key: 'DEV_TOOLS', label: 'Dev Tools', icon: '🔧' },
        { key: 'AUDIT_LOGS', label: 'Audit', icon: '📋' },
    ];

    return (
        <div className="pb-10 min-h-screen">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-6 mb-6 shadow-xl">
                <div className="max-w-7xl mx-auto">
                    {/* Title Row */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold mb-1 flex items-center gap-3">
                                <span className="text-3xl">⚡</span>
                                System Architect Console
                            </h1>
                            <p className="text-slate-400 text-sm">
                                Platform Control • Developer Tools • User Management
                            </p>
                        </div>

                        {/* Status Indicators */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/50 border border-green-700 rounded-full">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                <span className="text-xs font-medium text-green-300">System Online</span>
                            </div>
                            <div className="text-xs text-slate-400">
                                Logged in as <span className="text-white font-medium">{currentUser.full_name}</span>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.key
                                    ? 'bg-white text-slate-900 shadow-lg'
                                    : 'text-slate-300 hover:bg-slate-700/50'
                                    }`}
                            >
                                <span className="text-base">{tab.icon}</span>
                                <span className="hidden sm:inline">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Dashboard Overview */}
                {activeTab === 'DASHBOARD' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <AdminMetricsPanel facilityId={selectedFacilityFilter || undefined} />

                        {/* Quick Actions */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <button
                                    onClick={() => setActiveTab('USERS')}
                                    className="flex flex-col items-center gap-2 p-4 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                                >
                                    <span className="text-2xl">👤</span>
                                    <span className="text-sm font-medium text-indigo-700">Manage Users</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('SECURITY')}
                                    className="flex flex-col items-center gap-2 p-4 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                                >
                                    <span className="text-2xl">🔒</span>
                                    <span className="text-sm font-medium text-red-700">Security Center</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('SYSTEM')}
                                    className="flex flex-col items-center gap-2 p-4 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
                                >
                                    <span className="text-2xl">🚩</span>
                                    <span className="text-sm font-medium text-emerald-700">Feature Flags</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('DEV_TOOLS')}
                                    className="flex flex-col items-center gap-2 p-4 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors"
                                >
                                    <span className="text-2xl">🔧</span>
                                    <span className="text-sm font-medium text-amber-700">Dev Tools</span>
                                </button>
                            </div>
                        </div>

                        {/* System Status */}
                        <SystemMonitor />
                    </div>
                )}

                {/* Platform Metrics */}
                {activeTab === 'PLATFORM' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Platform Overview</h2>
                                <p className="text-sm text-gray-500">Full visibility across all users, facilities, and operations</p>
                            </div>
                        </div>
                        <PlatformMetricsPanel currentUser={currentUser} />
                    </div>
                )}

                {/* Detailed Metrics */}
                {activeTab === 'METRICS' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">System Metrics</h2>
                            <button className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                                Export Report
                            </button>
                        </div>
                        <AdminMetricsPanel facilityId={selectedFacilityFilter || undefined} />
                    </div>
                )}

                {/* User Management */}
                {activeTab === 'USERS' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">User Management</h2>
                                <p className="text-sm text-gray-500">Manage all platform users</p>
                            </div>
                        </div>

                        {/* Create User Card */}
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-bold">Create New User</h3>
                                    <p className="text-sm text-indigo-100">Add a new user with any role</p>
                                </div>
                                <button
                                    onClick={() => {
                                        const modal = document.getElementById('create-user-modal');
                                        if (modal) modal.classList.remove('hidden');
                                    }}
                                    className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-colors"
                                >
                                    + Create User
                                </button>
                            </div>
                        </div>

                        {/* Users Table */}
                        <UserAdminTable />

                        {/* Create User Modal */}
                        <div id="create-user-modal" className="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                e.currentTarget.classList.add('hidden');
                            }
                        }}>
                            <div className="bg-white rounded-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-gray-900">Create User</h3>
                                    <button
                                        onClick={() => document.getElementById('create-user-modal')?.classList.add('hidden')}
                                        className="p-2 hover:bg-gray-100 rounded-full"
                                    >
                                        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <CreateUserForm />
                            </div>
                        </div>
                    </div>
                )}

                {/* Security Center */}
                {activeTab === 'SECURITY' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Security Center</h2>
                            <p className="text-sm text-gray-500">Monitor security events and manage access</p>
                        </div>

                        {/* Security Metrics */}
                        <AdminMetricsPanel facilityId={selectedFacilityFilter || undefined} />

                        {/* Blocked Users */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="p-4 border-b border-gray-200 bg-gray-50">
                                <h3 className="font-bold text-gray-900">Blocked Users</h3>
                            </div>
                            <UserAdminTable />
                        </div>
                    </div>
                )}

                {/* System Controls */}
                {activeTab === 'SYSTEM' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <FeatureFlagManager currentUserId={currentUser.id} />

                        {/* System Actions */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">System Actions</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <button className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 text-left transition-colors">
                                    <div className="text-2xl mb-2">🗑️</div>
                                    <div className="font-semibold text-gray-900">Clear Cache</div>
                                    <div className="text-xs text-gray-500 mt-1">Purge all cached data</div>
                                </button>
                                <button className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 text-left transition-colors">
                                    <div className="text-2xl mb-2">🔄</div>
                                    <div className="font-semibold text-gray-900">Refresh Tokens</div>
                                    <div className="text-xs text-gray-500 mt-1">Regenerate auth tokens</div>
                                </button>
                                <button className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 text-left transition-colors">
                                    <div className="text-2xl mb-2">💾</div>
                                    <div className="font-semibold text-gray-900">Backup Database</div>
                                    <div className="text-xs text-gray-500 mt-1">Create database snapshot</div>
                                </button>
                                <button className="p-4 border border-red-200 rounded-xl hover:bg-red-50 text-left transition-colors">
                                    <div className="text-2xl mb-2">🚨</div>
                                    <div className="font-semibold text-red-700">Maintenance Mode</div>
                                    <div className="text-xs text-red-500 mt-1">Take system offline</div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Dev Tools */}
                {activeTab === 'DEV_TOOLS' && (
                    <div className="animate-in fade-in duration-300">
                        <DevTools />
                    </div>
                )}

                {/* Audit Logs */}
                {activeTab === 'AUDIT_LOGS' && (
                    <div className="animate-in fade-in duration-300">
                        <AuditLogViewer facilityId={selectedFacilityFilter || undefined} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default DevDashboard;


import React, { useState, useEffect } from 'react';
import { MetricConfig, SystemHealth } from '../types';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { supabase, checkSupabaseConnection } from '../services/supabase';
import UserManagement from '../components/UserManagement';

const DevDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'MONITOR' | 'BUILDER' | 'USERS' | 'DEV_TOOLS' | 'USER_MANAGEMENT'>('MONITOR');
    const [metrics, setMetrics] = useState<MetricConfig[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [systemHealth, setSystemHealth] = useState<SystemHealth[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
    const [selectedFacilityFilter, setSelectedFacilityFilter] = useState<string | null>(null);

    const impersonatedUser = users.find(u => u.id === impersonatedUserId);

    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: metricsData } = await supabase.from('metric_configs').select('*');
            if (metricsData) setMetrics(metricsData);

            const { data: usersData } = await supabase.from('profiles').select('*');
            if (usersData) setUsers(usersData);

            const { data: healthData } = await supabase.from('system_health').select('*');
            if (healthData) setSystemHealth(healthData);
        };
        fetchInitialData();
    }, []);

    const handleImpersonate = (userId: string | null) => {
        setImpersonatedUserId(userId);
        if (userId) {
            const user = users.find(u => u.id === userId);
            setSelectedFacilityFilter(user?.facility_id || null);
        } else {
            setSelectedFacilityFilter(null);
        }
    };

    const renderUserManagement = () => (
        <div className="animate-in fade-in duration-300">
            <UserManagement />
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
                        {['MONITOR', 'BUILDER', 'USERS', 'DEV_TOOLS', 'USER_MANAGEMENT'].map(tab => (
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
                {activeTab === 'USER_MANAGEMENT' && renderUserManagement()}
                {/* Other tabs */}
            </div>
        </div>
    );
};

export default DevDashboard;

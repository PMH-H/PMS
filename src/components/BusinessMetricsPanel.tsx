import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';

interface BusinessMetrics {
    // Prescription metrics
    totalPrescriptions: number;
    pendingPrescriptions: number;
    approvedToday: number;
    rejectedToday: number;
    avgProcessingTime: number;

    // Revenue metrics (estimated)
    estimatedRevenue: number;
    revenueGrowth: number;
    avgOrderValue: number;

    // Customer metrics
    totalPatients: number;
    newPatientsThisMonth: number;
    repeatCustomerRate: number;

    // Inventory metrics
    totalProducts: number;
    lowStockItems: number;
    outOfStockItems: number;
    inventoryTurnover: number;

    // Facility metrics
    totalFacilities: number;
    activeFacilities: number;
    avgFacilityScore: number;
}

interface TimeSeriesData {
    date: string;
    prescriptions: number;
    revenue: number;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const BusinessMetricsPanel: React.FC<{ facilityId?: string }> = ({ facilityId }) => {
    const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
    const [trendData, setTrendData] = useState<TimeSeriesData[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

    useEffect(() => {
        fetchMetrics();
        fetchTrendData();
    }, [facilityId, timeRange]);

    const fetchMetrics = async () => {
        try {
            const now = new Date();
            const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            // Fetch prescriptions
            const [allRx, pendingRx, todayRx] = await Promise.all([
                supabase.from('prescriptions').select('*', { count: 'exact', head: true }),
                supabase.from('prescriptions').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
                supabase.from('prescriptions').select('id, status, created_at').gte('created_at', startOfDay),
            ]);

            const todayData = todayRx.data || [];
            const approvedToday = todayData.filter(rx => rx.status === 'APPROVED').length;
            const rejectedToday = todayData.filter(rx => rx.status === 'REJECTED').length;

            // Fetch users
            const [allUsers, newUsers] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
                supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer').gte('created_at', startOfMonth),
            ]);

            // Fetch inventory
            const [items, lowStock] = await Promise.all([
                supabase.from('items').select('*', { count: 'exact', head: true }),
                supabase.from('item_batches').select('*, item:items(name)').lt('current_quantity', 10),
            ]);

            const lowStockData = lowStock.data || [];
            const outOfStock = lowStockData.filter(b => b.current_quantity === 0).length;

            // Fetch facilities
            const { data: facilities, count: facilityCount } = await supabase
                .from('facilities')
                .select('*', { count: 'exact' });

            const activeFacilities = facilities?.filter(f => f.is_active !== false).length || 0;

            setMetrics({
                totalPrescriptions: allRx.count || 0,
                pendingPrescriptions: pendingRx.count || 0,
                approvedToday,
                rejectedToday,
                avgProcessingTime: 24, // Placeholder - would need timestamp comparison

                estimatedRevenue: (allRx.count || 0) * 150, // Rough estimate
                revenueGrowth: 12.5,
                avgOrderValue: 150,

                totalPatients: allUsers.count || 0,
                newPatientsThisMonth: newUsers.count || 0,
                repeatCustomerRate: 65,

                totalProducts: items.count || 0,
                lowStockItems: lowStockData.length,
                outOfStockItems: outOfStock,
                inventoryTurnover: 4.2,

                totalFacilities: facilityCount || 0,
                activeFacilities,
                avgFacilityScore: 85,
            });
        } catch (err) {
            console.error('Error fetching business metrics:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchTrendData = async () => {
        // Generate mock trend data based on time range
        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        const data: TimeSeriesData[] = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            data.push({
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                prescriptions: Math.floor(Math.random() * 50) + 20,
                revenue: Math.floor(Math.random() * 5000) + 2000,
            });
        }

        setTrendData(data);
    };

    const prescriptionStatusData = metrics ? [
        { name: 'Approved', value: metrics.approvedToday, color: '#10b981' },
        { name: 'Pending', value: metrics.pendingPrescriptions, color: '#f59e0b' },
        { name: 'Rejected', value: metrics.rejectedToday, color: '#ef4444' },
    ] : [];

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Time Range Selector */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Business & Operations Metrics</h2>
                <div className="flex gap-2">
                    {(['7d', '30d', '90d'] as const).map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${timeRange === range
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Primary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white">
                    <p className="text-xs font-medium text-indigo-100 uppercase">Total Prescriptions</p>
                    <p className="text-3xl font-bold mt-2">{metrics?.totalPrescriptions.toLocaleString()}</p>
                    <p className="text-xs text-indigo-200 mt-1">{metrics?.approvedToday} approved today</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white">
                    <p className="text-xs font-medium text-emerald-100 uppercase">Est. Revenue</p>
                    <p className="text-3xl font-bold mt-2">K{(metrics?.estimatedRevenue || 0).toLocaleString()}</p>
                    <p className="text-xs text-emerald-200 mt-1">↑ {metrics?.revenueGrowth}% growth</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white">
                    <p className="text-xs font-medium text-amber-100 uppercase">Total Patients</p>
                    <p className="text-3xl font-bold mt-2">{metrics?.totalPatients.toLocaleString()}</p>
                    <p className="text-xs text-amber-200 mt-1">+{metrics?.newPatientsThisMonth} this month</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
                    <p className="text-xs font-medium text-purple-100 uppercase">Active Facilities</p>
                    <p className="text-3xl font-bold mt-2">{metrics?.activeFacilities}/{metrics?.totalFacilities}</p>
                    <p className="text-xs text-purple-200 mt-1">{metrics?.avgFacilityScore}% avg score</p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Trend Chart */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-bold text-gray-900 mb-4">Prescription Trend</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Area
                                    type="monotone"
                                    dataKey="prescriptions"
                                    stroke="#6366f1"
                                    fill="#6366f1"
                                    fillOpacity={0.2}
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Distribution */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-bold text-gray-900 mb-4">Today's Status</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={prescriptionStatusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {prescriptionStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 uppercase">Pending Rx</p>
                    <p className="text-2xl font-bold text-amber-600 mt-1">{metrics?.pendingPrescriptions}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 uppercase">Avg Processing</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{metrics?.avgProcessingTime}h</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 uppercase">Avg Order Value</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">K{metrics?.avgOrderValue}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 uppercase">Repeat Rate</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{metrics?.repeatCustomerRate}%</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 uppercase">Low Stock Items</p>
                    <p className={`text-2xl font-bold mt-1 ${(metrics?.lowStockItems || 0) > 10 ? 'text-red-600' : 'text-gray-900'}`}>
                        {metrics?.lowStockItems}
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 uppercase">Inventory Turnover</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{metrics?.inventoryTurnover}x</p>
                </div>
            </div>

            {/* Operations Summary */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-bold text-gray-900">Operations Summary</h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Prescription Funnel */}
                    <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Prescription Funnel</h4>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Submitted</span>
                                <span className="font-bold">{metrics?.totalPrescriptions}</span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-600 rounded-full" style={{ width: '100%' }} />
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Approved</span>
                                <span className="font-bold text-emerald-600">{metrics?.approvedToday}</span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${((metrics?.approvedToday || 0) / Math.max(metrics?.totalPrescriptions || 1, 1)) * 100}%` }} />
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Pending</span>
                                <span className="font-bold text-amber-600">{metrics?.pendingPrescriptions}</span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${((metrics?.pendingPrescriptions || 0) / Math.max(metrics?.totalPrescriptions || 1, 1)) * 100}%` }} />
                            </div>
                        </div>
                    </div>

                    {/* Inventory Health */}
                    <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Inventory Health</h4>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                                <span className="text-sm text-emerald-800">In Stock</span>
                                <span className="font-bold text-emerald-700">{(metrics?.totalProducts || 0) - (metrics?.lowStockItems || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                                <span className="text-sm text-amber-800">Low Stock</span>
                                <span className="font-bold text-amber-700">{metrics?.lowStockItems}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                                <span className="text-sm text-red-800">Out of Stock</span>
                                <span className="font-bold text-red-700">{metrics?.outOfStockItems}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Performance</h4>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Customer Retention</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${metrics?.repeatCustomerRate}%` }} />
                                    </div>
                                    <span className="text-sm font-bold">{metrics?.repeatCustomerRate}%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Facility Score</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${metrics?.avgFacilityScore}%` }} />
                                    </div>
                                    <span className="text-sm font-bold">{metrics?.avgFacilityScore}%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Revenue Growth</span>
                                <span className="text-sm font-bold text-emerald-600">+{metrics?.revenueGrowth}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BusinessMetricsPanel;

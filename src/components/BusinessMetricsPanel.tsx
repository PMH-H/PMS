import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from './RechartsWrapper';

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
    inventoryValue: number;
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
    const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('24h');

    useEffect(() => {
        fetchMetrics();
        fetchTrendData();
    }, [facilityId, timeRange]);

    // ...

    const fetchTrendData = async () => {
        try {
            const isHourly = timeRange === '24h';
            const days = isHourly ? 1 : (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90);

            const endDate = new Date();
            const startDate = new Date();
            if (isHourly) {
                startDate.setHours(startDate.getHours() - 24);
            } else {
                startDate.setDate(startDate.getDate() - days);
            }

            const { data: sales } = await supabase
                .from('sales')
                .select('created_at, total_amount')
                .gte('created_at', startDate.toISOString())
                .order('created_at');

            // Group by Date or Hour
            const grouped: Record<string, { revenue: number, count: number }> = {};

            if (isHourly) {
                // Initialize last 24 hours
                for (let i = 0; i < 24; i++) {
                    const d = new Date();
                    d.setHours(d.getHours() - i);
                    const k = d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
                    grouped[k] = { revenue: 0, count: 0 };
                }
            } else {
                // Init empty days
                for (let i = 0; i < days; i++) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const k = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    grouped[k] = { revenue: 0, count: 0 };
                }
            }

            sales?.forEach(sale => {
                let k;
                if (isHourly) {
                    k = new Date(sale.created_at).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
                } else {
                    k = new Date(sale.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }

                if (grouped[k]) {
                    grouped[k].revenue += Number(sale.total_amount);
                    grouped[k].count += 1;
                }
            });

            const data = [];
            if (isHourly) {
                for (let i = 23; i >= 0; i--) {
                    const d = new Date();
                    d.setHours(d.getHours() - i);
                    const k = d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
                    data.push({
                        date: k,
                        prescriptions: grouped[k]?.count || 0,
                        revenue: grouped[k]?.revenue || 0
                    });
                }
            } else {
                for (let i = days - 1; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const k = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    data.push({
                        date: k,
                        prescriptions: grouped[k]?.count || 0,
                        revenue: grouped[k]?.revenue || 0
                    });
                }
            }

            setTrendData(data);
        } catch (e) {
            console.error("Error fetching trends", e);
        }
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
                    {(['24h', '7d', '30d', '90d'] as const).map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${timeRange === range
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Primary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white">
                    <p className="text-xs font-medium text-indigo-100 uppercase">Total Prescriptions</p>
                    <p className="text-3xl font-bold mt-2">{(metrics?.totalPrescriptions || 0).toLocaleString()}</p>
                    <p className="text-xs text-indigo-200 mt-1">{metrics?.approvedToday || 0} approved today</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white">
                    <p className="text-xs font-medium text-emerald-100 uppercase">Inventory Value</p>
                    <p className="text-3xl font-bold mt-2">K{(metrics?.inventoryValue || 0).toLocaleString()}</p>
                    <p className="text-xs text-emerald-200 mt-1">{metrics?.totalProducts || 0} unique items</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white">
                    <p className="text-xs font-medium text-amber-100 uppercase">Total Patients</p>
                    <p className="text-3xl font-bold mt-2">{(metrics?.totalPatients || 0).toLocaleString()}</p>
                    <p className="text-xs text-amber-200 mt-1">+{(metrics?.newPatientsThisMonth || 0)} this month</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
                    <p className="text-xs font-medium text-purple-100 uppercase">Active Facilities</p>
                    <p className="text-3xl font-bold mt-2">{metrics?.activeFacilities || 0}/{metrics?.totalFacilities || 0}</p>
                    <p className="text-xs text-purple-200 mt-1">{metrics?.avgFacilityScore || 0}% avg score</p>
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

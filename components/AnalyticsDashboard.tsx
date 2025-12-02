import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface AnalyticsDashboardProps {
    facilityId?: string;
}

interface DailyRevenue {
    date: string;
    revenue: number;
    transactions: number;
}

interface TopProduct {
    id: string;
    name: string;
    quantity_sold: number;
    revenue: number;
}

interface StaffPerformance {
    user_id: string;
    user_name: string;
    sales_count: number;
    total_revenue: number;
    avg_transaction: number;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ facilityId }) => {
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'7days' | '30days' | '90days'>('30days');

    // Metrics
    const [todayRevenue, setTodayRevenue] = useState(0);
    const [weekRevenue, setWeekRevenue] = useState(0);
    const [monthRevenue, setMonthRevenue] = useState(0);
    const [transactionCount, setTransactionCount] = useState(0);
    const [avgTransaction, setAvgTransaction] = useState(0);
    const [lowStockCount, setLowStockCount] = useState(0);

    // Charts data
    const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);

    useEffect(() => {
        fetchAnalytics();
    }, [facilityId, dateRange]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const daysAgo = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 90;
            const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

            // Fetch sales data
            let salesQuery = supabase
                .from('sales')
                .select('*')
                .gte('created_at', startDate.toISOString());

            if (facilityId) {
                salesQuery = salesQuery.eq('facility_id', facilityId);
            }

            const { data: sales, error: salesError } = await salesQuery;
            if (salesError) throw salesError;

            // Calculate metrics
            const today = new Date().toISOString().split('T')[0];
            const todaySales = sales?.filter(s => s.created_at.startsWith(today)) || [];
            const todayRev = todaySales.reduce((sum, s) => sum + (s.total_price || 0), 0);
            setTodayRevenue(todayRev);

            // Week revenue
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const weekSales = sales?.filter(s => new Date(s.created_at) >= weekAgo) || [];
            const weekRev = weekSales.reduce((sum, s) => sum + (s.total_price || 0), 0);
            setWeekRevenue(weekRev);

            // Month revenue
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const monthSales = sales?.filter(s => new Date(s.created_at) >= monthAgo) || [];
            const monthRev = monthSales.reduce((sum, s) => sum + (s.total_price || 0), 0);
            setMonthRevenue(monthRev);

            setTransactionCount(sales?.length || 0);
            setAvgTransaction(sales?.length ? (sales.reduce((sum, s) => sum + (s.total_price || 0), 0) / sales.length) : 0);

            // Daily revenue trend
            const dailyMap = new Map<string, { revenue: number; count: number }>();
            sales?.forEach(sale => {
                const date = sale.created_at.split('T')[0];
                const existing = dailyMap.get(date) || { revenue: 0, count: 0 };
                dailyMap.set(date, {
                    revenue: existing.revenue + (sale.total_price || 0),
                    count: existing.count + 1
                });
            });

            const dailyData: DailyRevenue[] = Array.from(dailyMap.entries())
                .map(([date, data]) => ({
                    date,
                    revenue: data.revenue,
                    transactions: data.count
                }))
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(-30); // Last 30 days

            setDailyRevenue(dailyData);

            // Top products
            const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
            sales?.forEach(sale => {
                const items = Array.isArray(sale.items) ? sale.items : [];
                items.forEach((item: any) => {
                    const existing = productMap.get(item.item_id) || { name: item.name || 'Unknown', quantity: 0, revenue: 0 };
                    productMap.set(item.item_id, {
                        name: existing.name,
                        quantity: existing.quantity + (item.quantity || 0),
                        revenue: existing.revenue + ((item.quantity || 0) * (item.unit_price || 0))
                    });
                });
            });

            const topProds: TopProduct[] = Array.from(productMap.entries())
                .map(([id, data]) => ({
                    id,
                    name: data.name,
                    quantity_sold: data.quantity,
                    revenue: data.revenue
                }))
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10);

            setTopProducts(topProds);

            // Staff performance
            const staffMap = new Map<string, { name: string; count: number; revenue: number }>();
            sales?.forEach(sale => {
                if (sale.sold_by_user_id) {
                    const existing = staffMap.get(sale.sold_by_user_id) || { name: 'Unknown', count: 0, revenue: 0 };
                    staffMap.set(sale.sold_by_user_id, {
                        name: existing.name,
                        count: existing.count + 1,
                        revenue: existing.revenue + (sale.total_price || 0)
                    });
                }
            });

            const staffPerf: StaffPerformance[] = Array.from(staffMap.entries())
                .map(([id, data]) => ({
                    user_id: id,
                    user_name: data.name,
                    sales_count: data.count,
                    total_revenue: data.revenue,
                    avg_transaction: data.count > 0 ? data.revenue / data.count : 0
                }))
                .sort((a, b) => b.total_revenue - a.total_revenue);

            setStaffPerformance(staffPerf);

            // Low stock count
            let itemsQuery = supabase
                .from('items')
                .select('*, item_batches!inner(current_quantity)');

            if (facilityId) {
                itemsQuery = itemsQuery.eq('item_batches.facility_id', facilityId);
            }

            const { data: items } = await itemsQuery;
            const lowStock = items?.filter(item => {
                const totalStock = (item.item_batches || []).reduce((sum: number, batch: any) => sum + (batch.current_quantity || 0), 0);
                return totalStock <= item.min_level;
            }).length || 0;

            setLowStockCount(lowStock);

        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Analytics & Insights</h2>
                    <p className="text-sm text-gray-500">Business intelligence and performance metrics</p>
                </div>
                <div className="flex gap-2">
                    {(['7days', '30days', '90days'] as const).map(range => (
                        <button
                            key={range}
                            onClick={() => setDateRange(range)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${dateRange === range
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {range === '7days' ? '7 Days' : range === '30days' ? '30 Days' : '90 Days'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Today's Revenue */}
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-xl text-white shadow-lg">
                    <p className="text-sm opacity-90 mb-1">Today's Revenue</p>
                    <p className="text-3xl font-bold">ZMW {todayRevenue.toFixed(2)}</p>
                    <p className="text-xs opacity-75 mt-2">Last 24 hours</p>
                </div>

                {/* This Week */}
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl text-white shadow-lg">
                    <p className="text-sm opacity-90 mb-1">This Week</p>
                    <p className="text-3xl font-bold">ZMW {weekRevenue.toFixed(2)}</p>
                    <p className="text-xs opacity-75 mt-2">Last 7 days</p>
                </div>

                {/* This Month */}
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl text-white shadow-lg">
                    <p className="text-sm opacity-90 mb-1">This Month</p>
                    <p className="text-3xl font-bold">ZMW {monthRevenue.toFixed(2)}</p>
                    <p className="text-xs opacity-75 mt-2">Last 30 days</p>
                </div>

                {/* Avg Transaction */}
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-xl text-white shadow-lg">
                    <p className="text-sm opacity-90 mb-1">Avg Transaction</p>
                    <p className="text-3xl font-bold">ZMW {avgTransaction.toFixed(2)}</p>
                    <p className="text-xs opacity-75 mt-2">{transactionCount} transactions</p>
                </div>
            </div>

            {/* Revenue Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Revenue Trend</h3>
                <div className="h-64">
                    {dailyRevenue.length > 0 ? (
                        <div className="relative h-full">
                            {/* Simple bar chart */}
                            <div className="flex items-end justify-between h-full gap-1">
                                {dailyRevenue.slice(-30).map((day, index) => {
                                    const maxRevenue = Math.max(...dailyRevenue.map(d => d.revenue));
                                    const height = (day.revenue / maxRevenue) * 100;
                                    return (
                                        <div key={index} className="flex-1 flex flex-col items-center group">
                                            <div
                                                className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors cursor-pointer relative"
                                                style={{ height: `${height}%` }}
                                                title={`${day.date}: ZMW ${day.revenue.toFixed(2)}`}
                                            >
                                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                    {day.date}<br />ZMW {day.revenue.toFixed(2)}
                                                </div>
                                            </div>
                                            {index % 5 === 0 && (
                                                <span className="text-xs text-gray-400 mt-1">{new Date(day.date).getDate()}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            No revenue data available
                        </div>
                    )}
                </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Products */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Top Products</h3>
                    <div className="space-y-3">
                        {topProducts.slice(0, 5).map((product, index) => (
                            <div key={product.id} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-sm">
                                    {index + 1}
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">{product.name}</p>
                                    <p className="text-xs text-gray-500">{product.quantity_sold} units sold</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gray-900">ZMW {product.revenue.toFixed(2)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Staff Performance */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Staff Performance</h3>
                    <div className="space-y-3">
                        {staffPerformance.slice(0, 5).map((staff, index) => (
                            <div key={staff.user_id} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-sm">
                                    {index + 1}
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">{staff.user_name}</p>
                                    <p className="text-xs text-gray-500">{staff.sales_count} sales</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gray-900">ZMW {staff.total_revenue.toFixed(2)}</p>
                                    <p className="text-xs text-gray-500">Avg: ZMW {staff.avg_transaction.toFixed(2)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-gray-500">Total Transactions</h4>
                        <span className="text-2xl">📊</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{transactionCount}</p>
                    <p className="text-xs text-gray-500 mt-1">In selected period</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-gray-500">Low Stock Items</h4>
                        <span className="text-2xl">⚠️</span>
                    </div>
                    <p className="text-3xl font-bold text-orange-600">{lowStockCount}</p>
                    <p className="text-xs text-gray-500 mt-1">Below minimum level</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-gray-500">Products Sold</h4>
                        <span className="text-2xl">📦</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{topProducts.reduce((sum, p) => sum + p.quantity_sold, 0)}</p>
                    <p className="text-xs text-gray-500 mt-1">Total units</p>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;

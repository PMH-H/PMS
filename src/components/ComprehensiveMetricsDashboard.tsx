/**
 * ComprehensiveMetricsDashboard Component
 * System-wide analytics and KPI tracking
 * Features: Store metrics, channel engagement, system health, trends
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp, Users, ShoppingCart, MessageSquare, Activity,
  BarChart3, LineChart, PieChart, AlertCircle, Calendar
} from 'lucide-react';
import { LineChart as RechartsLineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as dbService from '../services/database';
import { useAppContext } from '../context/AppContext';

import { PlatformMetrics } from '../types';

interface MetricsSummary {
  storeMetrics: any[];
  channelMetrics: any[];
  systemMetrics: PlatformMetrics[];
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export const ComprehensiveMetricsDashboard: React.FC = () => {
  const { facility } = useAppContext();
  const [metrics, setMetrics] = useState<MetricsSummary>({
    storeMetrics: [],
    channelMetrics: [],
    systemMetrics: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  // Load metrics
  useEffect(() => {
    if (facility?.id) {
      loadMetrics();
    }
  }, [facility?.id, dateRange]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const [storeData, systemData] = await Promise.all([
        dbService.getStoreMetrics(facility!.id, { from: dateRange.from, to: dateRange.to }),
        dbService.getSystemMetrics(facility!.id, { from: dateRange.from, to: dateRange.to })
      ]);

      setMetrics({
        storeMetrics: storeData,
        channelMetrics: [], // Will be populated per channel
        systemMetrics: systemData
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
      console.error('Error loading metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const storeTotal = metrics.storeMetrics.reduce((sum, m) => sum + (m.total_revenue_cents || 0), 0);
    const totalOrders = metrics.storeMetrics.reduce((sum, m) => sum + (m.total_orders || 0), 0);
    const avgOrderValue = totalOrders > 0 ? Math.round(storeTotal / totalOrders) : 0;

    return {
      revenue: storeTotal / 100,
      orders: totalOrders,
      avgOrderValue: avgOrderValue / 100,
      activeUsers: metrics.systemMetrics[0]?.active_users || 0
    };
  };

  const calculateTrends = () => {
    if (metrics.storeMetrics.length < 2) return { revenueChange: 0, orderChange: 0 };

    const current = metrics.storeMetrics[0]?.total_revenue_cents || 0;
    const previous = metrics.storeMetrics[1]?.total_revenue_cents || 0;
    const revenueChange = previous > 0 ? ((current - previous) / previous * 100).toFixed(1) : 0;

    const currentOrders = metrics.storeMetrics[0]?.total_orders || 0;
    const previousOrders = metrics.storeMetrics[1]?.total_orders || 0;
    const orderChange = previousOrders > 0 ? ((currentOrders - previousOrders) / previousOrders * 100).toFixed(1) : 0;

    return { revenueChange, orderChange };
  };

  const getHealthStatus = () => {
    const latest = metrics.systemMetrics[0];
    if (!latest) return 'UNKNOWN';

    if (latest.system_uptime_percent >= 99.5) return 'EXCELLENT';
    if (latest.system_uptime_percent >= 99) return 'GOOD';
    if (latest.system_uptime_percent >= 98) return 'WARNING';
    return 'CRITICAL';
  };

  const totals = calculateTotals();
  const trends = calculateTrends();
  const healthStatus = getHealthStatus();


  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const aggregatedData = React.useMemo(() => {
    if (viewMode === 'daily') return metrics.storeMetrics;

    const grouped = metrics.storeMetrics.reduce((acc: any, curr) => {
      const date = new Date(curr.date);
      let key = '';
      if (viewMode === 'weekly') {
        const startOfWeek = new Date(date.setDate(date.getDate() - date.getDay()));
        key = startOfWeek.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      }

      if (!acc[key]) {
        acc[key] = { ...curr, date: key, count: 1 };
      } else {
        acc[key].total_revenue_cents += curr.total_revenue_cents;
        acc[key].total_orders += curr.total_orders;
        acc[key].count += 1;
        // Merge category breakdowns if needed, simplified here
      }
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [metrics.storeMetrics, viewMode]);

  const handleExport = () => {
    const headers = ['Date', 'Revenue', 'Orders', 'Active Users'];
    const rows = aggregatedData.map((m: any) => [
      m.date,
      (m.total_revenue_cents / 100).toFixed(2),
      m.total_orders,
      metrics.systemMetrics.find(s => s.date === m.date)?.active_users || 0
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any[]) => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `metrics_report_${viewMode}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8" />
            <div>
              <h1 className="text-3xl font-bold">Metrics Dashboard</h1>
              <p className="text-indigo-100">System-wide analytics and KPI tracking</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-indigo-100 text-sm">System Health</p>
            <p className={`text-2xl font-bold ${healthStatus === 'EXCELLENT' ? 'text-green-300' :
              healthStatus === 'GOOD' ? 'text-green-300' :
                healthStatus === 'WARNING' ? 'text-yellow-300' :
                  'text-red-300'
              }`}>
              {healthStatus}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 text-sm mt-4 pt-4 border-t border-indigo-500/30">
          <div className="flex items-center gap-2 bg-black/20 rounded-lg p-1">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1 rounded-md transition-all ${viewMode === 'daily' ? 'bg-white text-indigo-600 shadow' : 'text-indigo-100 hover:bg-white/10'}`}
            >Daily</button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1 rounded-md transition-all ${viewMode === 'weekly' ? 'bg-white text-indigo-600 shadow' : 'text-indigo-100 hover:bg-white/10'}`}
            >Weekly</button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 rounded-md transition-all ${viewMode === 'monthly' ? 'bg-white text-indigo-600 shadow' : 'text-indigo-100 hover:bg-white/10'}`}
            >Monthly</button>
          </div>

          <div className="h-6 w-px bg-indigo-400/50 hidden md:block"></div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="px-2 py-1 bg-white bg-opacity-20 border border-white border-opacity-30 rounded text-white placeholder-indigo-200 outline-none focus:ring-1 focus:ring-white"
            />
            <span className="text-indigo-200">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="px-2 py-1 bg-white bg-opacity-20 border border-white border-opacity-30 rounded text-white placeholder-indigo-200 outline-none focus:ring-1 focus:ring-white"
            />
          </div>

          <div className="flex-grow"></div>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-lg font-bold shadow hover:bg-indigo-50 transition-colors"
          >
            <TrendingUp className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* ... rest of the component using aggregatedData instead of metrics.storeMetrics for charts ... */}


      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading metrics...</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Revenue Card */}
            <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-600">Total Revenue</h3>
                <ShoppingCart className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">${totals.revenue.toFixed(2)}</p>
              <p className={`text-xs mt-2 flex items-center gap-1 ${trends.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                <TrendingUp className="w-3 h-3" />
                {trends.revenueChange > 0 ? '+' : ''}{trends.revenueChange}% vs previous
              </p>
            </div>

            {/* Orders Card */}
            <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-600">Total Orders</h3>
                <BarChart3 className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{totals.orders}</p>
              <p className={`text-xs mt-2 flex items-center gap-1 ${trends.orderChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                <TrendingUp className="w-3 h-3" />
                {trends.orderChange > 0 ? '+' : ''}{trends.orderChange}% vs previous
              </p>
            </div>

            {/* Avg Order Value Card */}
            <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-600">Avg Order Value</h3>
                <LineChart className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">${totals.avgOrderValue.toFixed(2)}</p>
              <p className="text-xs mt-2 text-gray-500">Per transaction</p>
            </div>

            {/* Active Users Card */}
            <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-orange-500">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-600">Active Users</h3>
                <Users className="w-5 h-5 text-orange-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{totals.activeUsers}</p>
              <p className="text-xs mt-2 text-gray-500">Today</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend */}
            {aggregatedData.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <LineChart className="w-5 h-5 text-indigo-600" />
                  Revenue Trend ({viewMode})
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={aggregatedData.slice().reverse()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(date) => new Date(date).toLocaleDateString()}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: any) => `$${(value / 100).toFixed(2)}`}
                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="total_revenue_cents"
                        stroke="#3b82f6"
                        name="Revenue"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', r: 4 }}
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Orders Trend */}
            {aggregatedData.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Orders Trend ({viewMode})
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={aggregatedData.slice().reverse()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(date) => new Date(date).toLocaleDateString()}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                      />
                      <Legend />
                      <Bar
                        dataKey="total_orders"
                        fill="#10b981"
                        name="Orders"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Product Categories Distribution */}
            {metrics.storeMetrics.length > 0 && metrics.storeMetrics[0]?.category_breakdown && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-indigo-600" />
                  Category Distribution
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={Object.entries(metrics.storeMetrics[0].category_breakdown || {}).map(([name, value]) => ({
                          name,
                          value
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {Object.entries(metrics.storeMetrics[0].category_breakdown || {}).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* System Uptime */}
            {metrics.systemMetrics.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  System Health
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={metrics.systemMetrics.slice().reverse()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(date) => new Date(date).toLocaleDateString()}
                      />
                      <YAxis domain={[97, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: any) => `${value.toFixed(2)}%`}
                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="system_uptime_percent"
                        stroke="#f59e0b"
                        name="Uptime %"
                        strokeWidth={2}
                        dot={{ fill: '#f59e0b', r: 4 }}
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
              <h4 className="font-semibold text-green-900 mb-2">Best Performing {viewMode === 'daily' ? 'Day' : viewMode === 'weekly' ? 'Week' : 'Month'}</h4>
              {aggregatedData.length > 0 && (
                <>
                  <p className="text-lg text-green-700">
                    {new Date(aggregatedData.sort((a: any, b: any) => b.total_revenue_cents - a.total_revenue_cents)[0]?.date || '').toLocaleDateString()}
                  </p>
                  <p className="text-sm text-green-600">
                    ${(aggregatedData.sort((a: any, b: any) => b.total_revenue_cents - a.total_revenue_cents)[0]?.total_revenue_cents / 100).toFixed(2)} in revenue
                  </p>
                </>
              )}
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2">Avg {viewMode === 'daily' ? 'Daily' : viewMode === 'weekly' ? 'Weekly' : 'Monthly'} Revenue</h4>
              {aggregatedData.length > 0 && (
                <p className="text-lg text-blue-700">
                  ${(aggregatedData.reduce((sum: number, m: any) => sum + m.total_revenue_cents, 0) / 100 / aggregatedData.length).toFixed(2)}
                </p>
              )}
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
              <h4 className="font-semibold text-purple-900 mb-2">Total {viewMode === 'daily' ? 'Days' : viewMode === 'weekly' ? 'Weeks' : 'Months'} Tracked</h4>
              <p className="text-lg text-purple-700">{aggregatedData.length} {viewMode === 'daily' ? 'days' : viewMode === 'weekly' ? 'weeks' : 'months'}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ComprehensiveMetricsDashboard;

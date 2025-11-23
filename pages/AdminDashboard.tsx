
import React, { useMemo, useState } from 'react';
import { AILog, User, Sale, AuditLog, Drug, DrugBatch, SearchLog } from '../types';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, 
    AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';

interface AdminDashboardProps {
    logs: AILog[];
    users: User[];
    sales: Sale[];
    auditLogs: AuditLog[];
    inventory: Drug[];
    batches: DrugBatch[];
    searchLogs: SearchLog[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
    logs, users, sales, auditLogs, inventory, batches, searchLogs 
}) => {
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SALES' | 'INVENTORY' | 'INSIGHTS'>('OVERVIEW');

    // --- Computed Metrics ---
    
    // Overview
    const today = new Date().toISOString().split('T')[0];
    const todaySales = sales.filter(s => s.created_at.startsWith(today));
    const todayRevenue = todaySales.reduce((sum, s) => sum + s.total_price, 0);
    const totalInventoryValue = batches.reduce((sum, b) => sum + (b.current_units * b.cost_per_unit), 0);
    const lowStockCount = inventory.filter(d => {
        const total = batches.filter(b => b.drug_id === d.id).reduce((a,b) => a+b.current_units, 0);
        return total <= d.min_level;
    }).length;

    // Sales Chart Data (Hourly for Today - Mockish)
    const hourlySalesData = useMemo(() => {
        const hours = Array.from({length: 12}, (_, i) => i + 8); // 8 AM to 8 PM
        return hours.map(h => {
            const hourStr = h.toString().padStart(2, '0');
            const revenue = todaySales
                .filter(s => new Date(s.created_at).getHours() === h)
                .reduce((acc, s) => acc + s.total_price, 0);
            return { time: `${hourStr}:00`, revenue };
        });
    }, [todaySales]);

    // Employee Performance
    const employeeStats = useMemo(() => {
        const stats: {[id: string]: {name: string, sales: number, count: number}} = {};
        sales.forEach(s => {
            const uid = s.sold_by_user_id;
            if(!stats[uid]) stats[uid] = { name: users.find(u => u.id === uid)?.name || 'Unknown', sales: 0, count: 0 };
            stats[uid].sales += s.total_price;
            stats[uid].count += 1;
        });
        return Object.values(stats);
    }, [sales, users]);

    // Top Products
    const topProducts = useMemo(() => {
        const counts: {[name: string]: number} = {};
        sales.forEach(s => {
            s.items.forEach(i => {
                const dName = inventory.find(d => d.id === i.drug_id)?.name || 'Unknown';
                counts[dName] = (counts[dName] || 0) + i.units;
            });
        });
        return Object.entries(counts)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, value]) => ({ name, value }));
    }, [sales, inventory]);

    // Search Insights
    const topSearches = useMemo(() => {
        const counts: {[term: string]: number} = {};
        searchLogs.forEach(l => {
            const term = l.term.toLowerCase();
            counts[term] = (counts[term] || 0) + 1;
        });
        return Object.entries(counts)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 10);
    }, [searchLogs]);

    const expiringBatches = useMemo(() => {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() + 90);
        return batches
            .filter(b => new Date(b.expiry_date) <= threshold && b.current_units > 0)
            .map(b => ({
                ...b,
                drugName: inventory.find(d => d.id === b.drug_id)?.name || 'Unknown'
            }));
    }, [batches, inventory]);

    // Scan vs Manual Analysis
    const entryMethodStats = useMemo(() => {
        let scan = 0;
        let manual = 0;
        let search = 0;
        sales.forEach(s => {
            s.items.forEach(i => {
                if (i.entry_method === 'SCAN') scan++;
                else if (i.entry_method === 'MANUAL') manual++;
                else search++;
            });
        });
        return [
            { name: 'Scanned', value: scan, color: '#10B981' }, // Green
            { name: 'Manual', value: manual, color: '#F59E0B' }, // Yellow
            { name: 'Search', value: search, color: '#6366F1' }  // Indigo
        ].filter(d => d.value > 0);
    }, [sales]);


    // --- UI RENDERERS ---

    const renderOverview = () => (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
                    <p className="text-slate-400 text-sm font-bold uppercase">Today's Revenue</p>
                    <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-3xl font-bold">ZMW {todayRevenue.toFixed(2)}</span>
                        <span className="text-emerald-400 text-sm font-bold">+{todaySales.length} tx</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-bold uppercase">Inventory Value</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">ZMW {totalInventoryValue.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-bold uppercase">Low Stock Alerts</p>
                    <p className={`text-3xl font-bold mt-2 ${lowStockCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {lowStockCount}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-bold uppercase">Customer Searches</p>
                    <p className="text-3xl font-bold text-indigo-600 mt-2">{searchLogs.length}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-900 mb-6">Hourly Sales Performance</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={hourlySalesData}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
                                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                                <ReTooltip 
                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Products */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-900 mb-4">Best Sellers</h3>
                    <div className="space-y-4">
                        {topProducts.map((p, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold">{i+1}</span>
                                    <span className="text-sm font-medium text-gray-700">{p.name}</span>
                                </div>
                                <span className="text-sm font-bold text-gray-900">{p.value} units</span>
                            </div>
                        ))}
                        {topProducts.length === 0 && <p className="text-gray-400 text-sm">No sales data yet.</p>}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderSales = () => (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Employee Performance */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
                    <h3 className="font-bold text-gray-900 mb-6">Employee Performance (Sales by Cashier)</h3>
                    <div className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={employeeStats} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6"/>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tickLine={false} axisLine={false} tick={{fontSize: 12}} />
                                <ReTooltip cursor={{fill: 'transparent'}} />
                                <Bar dataKey="sales" fill="#10B981" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Entry Method Analysis */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-900 mb-2">Checkout Method Analysis</h3>
                    <p className="text-xs text-gray-500 mb-4">Manual vs Scanned Entries</p>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={entryMethodStats} 
                                    cx="50%" cy="50%" 
                                    innerRadius={60} outerRadius={80} 
                                    paddingAngle={5} 
                                    dataKey="value"
                                >
                                    {entryMethodStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <ReTooltip />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                
                {/* Audit Logs */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:col-span-3">
                    <h3 className="font-bold text-gray-900 mb-4">Audit Log (Voids & Manual Entries)</h3>
                    <div className="overflow-y-auto h-64 space-y-3">
                        {auditLogs.slice().reverse().filter(l => ['VOID', 'ADJUSTMENT', 'SALE'].includes(l.action)).map(log => (
                            <div key={log.id} className="text-sm p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="flex justify-between mb-1">
                                    <span className={`font-bold text-xs px-2 py-0.5 rounded ${
                                        log.action === 'VOID' ? 'bg-red-100 text-red-700' : 
                                        log.action === 'SALE' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                    }`}>{log.action}</span>
                                    <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-gray-600 truncate">{JSON.stringify(log.payload).slice(0, 100)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderInventory = () => (
        <div className="space-y-6 animate-in fade-in duration-300">
             <div className="bg-orange-50 border border-orange-200 p-6 rounded-2xl">
                <h3 className="font-bold text-orange-800 text-lg mb-2">Expiry Risk Management</h3>
                <p className="text-sm text-orange-700 mb-4">The following batches are expiring within 90 days. AI suggests applying discounts to clear stock.</p>
                
                <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-orange-100">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-orange-100 text-orange-800 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3">Product</th>
                                <th className="px-6 py-3">Batch</th>
                                <th className="px-6 py-3">Expiry</th>
                                <th className="px-6 py-3">Stock</th>
                                <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expiringBatches.map(b => (
                                <tr key={b.id} className="border-b last:border-0 hover:bg-orange-50/50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{b.drugName}</td>
                                    <td className="px-6 py-4 font-mono text-xs">{b.batch_no}</td>
                                    <td className="px-6 py-4 text-red-600 font-bold">{b.expiry_date}</td>
                                    <td className="px-6 py-4">{b.current_units} units</td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 shadow-sm">
                                            Auto-Discount 20%
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {expiringBatches.length === 0 && (
                                <tr><td colSpan={5} className="text-center py-6 text-gray-500">No items expiring soon.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderInsights = () => (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-indigo-900 text-white p-8 rounded-2xl shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-2xl font-bold mb-2">Customer Demand Insights</h2>
                    <p className="text-indigo-200">Real-time analysis of what customers are searching for and their symptom queries.</p>
                </div>
                <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-indigo-500/20 to-transparent pointer-events-none" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        Top Search Terms
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {topSearches.filter(t => !['headache', 'fever'].includes(t[0])).map(([term, count], i) => ( // naive filter for demo
                            <div key={i} className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center gap-3 w-full sm:w-auto">
                                <span className="font-medium text-gray-700 capitalize">{term}</span>
                                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
                            </div>
                        ))}
                         {topSearches.length === 0 && <p className="text-gray-400 text-sm">No search data available.</p>}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        Symptom Trends (AI Detected)
                    </h3>
                     {/* Mock Word Cloud / List */}
                     <div className="space-y-3">
                        {['Headache', 'Flu', 'Cough', 'Stomach Pain'].map((s, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="flex-grow bg-gray-100 h-2 rounded-full overflow-hidden">
                                    <div className="bg-red-400 h-full rounded-full" style={{width: `${80 - (i*15)}%`}} />
                                </div>
                                <span className="text-sm font-medium text-gray-600 w-24 text-right">{s}</span>
                            </div>
                        ))}
                        <p className="text-xs text-gray-400 mt-2">* Based on anonymous symptom checker usage.</p>
                     </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="pb-10">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Business Dashboard</h1>
                    <p className="text-slate-500">Shop Owner View</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                    {(['OVERVIEW', 'SALES', 'INVENTORY', 'INSIGHTS'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
                                activeTab === tab ? 'bg-slate-900 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'OVERVIEW' && renderOverview()}
            {activeTab === 'SALES' && renderSales()}
            {activeTab === 'INVENTORY' && renderInventory()}
            {activeTab === 'INSIGHTS' && renderInsights()}
        </div>
    );
};

export default AdminDashboard;

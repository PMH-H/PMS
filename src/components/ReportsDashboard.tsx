
import React, { useState, useEffect } from 'react';
import {
    FileText, TrendingUp, AlertTriangle, Download,
    Calendar, DollarSign, Package, Shield
} from 'lucide-react';
import * as dbService from '../services/database';
import {
    InventoryValuationReport, ExpiryRiskReport, PeriodSalesReport
} from '../types';
import { useAppContext } from '../context/AppContext';

type ReportTab = 'inventory' | 'sales' | 'compliance';

const ReportsDashboard: React.FC = () => {
    const { facility, user } = useAppContext();
    const [activeTab, setActiveTab] = useState<ReportTab>('inventory');
    const [loading, setLoading] = useState(false);

    // Data State
    const [valuation, setValuation] = useState<InventoryValuationReport | null>(null);
    const [expiryRisk, setExpiryRisk] = useState<ExpiryRiskReport[]>([]);
    const [salesReport, setSalesReport] = useState<PeriodSalesReport[]>([]);

    // Filter State
    const [salesDateRange, setSalesDateRange] = useState({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        if (facility?.id) {
            loadData();
        }
    }, [facility?.id, activeTab, salesDateRange]);

    const loadData = async () => {
        if (!facility?.id) return;
        setLoading(true);
        try {
            if (activeTab === 'inventory') {
                const valData = await dbService.getInventoryValuation(facility.id);
                setValuation(valData[0] || null);

                const riskData = await dbService.getExpiryRiskReport(facility.id, 90);
                setExpiryRisk(riskData);
            } else if (activeTab === 'sales') {
                const salesData = await dbService.getPeriodSalesReport(
                    facility.id,
                    salesDateRange.start,
                    salesDateRange.end
                );
                setSalesReport(salesData);
            }
        } catch (error) {
            console.error("Error loading report data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = (data: any[], filename: string) => {
        if (!data || data.length === 0) return;

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => JSON.stringify(row[header] || '')).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 rounded-lg">
                        <FileText className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
                        <p className="text-gray-500">Business intelligence and compliance exports</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('inventory')}
                    className={`px-4 py-2 border-b-2 font-medium transition-colors ${activeTab === 'inventory'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Inventory Health
                </button>
                <button
                    onClick={() => setActiveTab('sales')}
                    className={`px-4 py-2 border-b-2 font-medium transition-colors ${activeTab === 'sales'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Sales Performance
                </button>
                {/* Future: Compliance Tab */}
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* INVENTORY TAB */}
                    {activeTab === 'inventory' && (
                        <div className="space-y-6">
                            {/* Valuation Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <DollarSign className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <h3 className="font-semibold text-gray-700">Cost Value</h3>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">
                                        ${(valuation?.total_cost_value || 0).toLocaleString()}
                                    </p>
                                    <p className="text-sm text-gray-500">Total investment in stock</p>
                                </div>

                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-green-50 rounded-lg">
                                            <TrendingUp className="w-5 h-5 text-green-600" />
                                        </div>
                                        <h3 className="font-semibold text-gray-700">Retail Value</h3>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">
                                        ${(valuation?.total_retail_value || 0).toLocaleString()}
                                    </p>
                                    <p className="text-sm text-gray-500">Potential revenue</p>
                                </div>

                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-amber-50 rounded-lg">
                                            <Package className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <h3 className="font-semibold text-gray-700">Stock Count</h3>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {valuation?.batch_count || 0} <span className="text-sm font-normal text-gray-500">batches</span>
                                    </p>
                                    <p className="text-sm text-gray-500">{valuation?.item_count || 0} unique items</p>
                                </div>
                            </div>

                            {/* Expiry Risk Table */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-lg flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                                            Expiry Risk (Next 90 Days)
                                        </h3>
                                        <p className="text-gray-500 text-sm">Batches expiring soon</p>
                                    </div>
                                    <button
                                        onClick={() => handleExportCSV(expiryRisk, 'expiry_risk')}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                                    >
                                        <Download className="w-4 h-4" /> Export CSV
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 text-gray-500 font-medium">
                                            <tr>
                                                <th className="px-6 py-3">Drug Name</th>
                                                <th className="px-6 py-3">Batch #</th>
                                                <th className="px-6 py-3">Expiry</th>
                                                <th className="px-6 py-3">Days Left</th>
                                                <th className="px-6 py-3 text-right">Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {expiryRisk.length > 0 ? (
                                                expiryRisk.map((Item, i) => (
                                                    <tr key={i} className="hover:bg-gray-50/50">
                                                        <td className="px-6 py-3 font-medium text-gray-900">{Item.drug_name}</td>
                                                        <td className="px-6 py-3 text-gray-600">{Item.batch_number}</td>
                                                        <td className="px-6 py-3 text-gray-600">{Item.expiry_date}</td>
                                                        <td className={`px-6 py-3 font-medium ${Item.days_until_expiry < 30 ? 'text-red-600' : 'text-amber-600'
                                                            }`}>
                                                            {Item.days_until_expiry} days
                                                        </td>
                                                        <td className="px-6 py-3 text-right font-mono">{Item.quantity}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                                        No batches expiring within 90 days. Great job!
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SALES TAB */}
                    {activeTab === 'sales' && (
                        <div className="space-y-6">
                            {/* Controls */}
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-gray-400" />
                                    <span className="text-sm font-medium text-gray-700">Date Range:</span>
                                </div>
                                <input
                                    type="date"
                                    value={salesDateRange.start}
                                    onChange={(e) => setSalesDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <span className="text-gray-400">to</span>
                                <input
                                    type="date"
                                    value={salesDateRange.end}
                                    onChange={(e) => setSalesDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <div className="flex-grow"></div>
                                <button
                                    onClick={() => handleExportCSV(salesReport, 'sales_report')}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm"
                                >
                                    <Download className="w-4 h-4" /> Download Report
                                </button>
                            </div>

                            {/* Sales Table */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 text-gray-500 font-medium">
                                            <tr>
                                                <th className="px-6 py-3">Date</th>
                                                <th className="px-6 py-3 text-right">Transactions</th>
                                                <th className="px-6 py-3 text-right">Revenue</th>
                                                <th className="px-6 py-3 text-right">Avg Ticket</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {salesReport.length > 0 ? (
                                                salesReport.map((row, i) => (
                                                    <tr key={i} className="hover:bg-gray-50/50">
                                                        <td className="px-6 py-3 font-medium text-gray-900">
                                                            {new Date(row.sale_date).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-3 text-right">{row.transaction_count}</td>
                                                        <td className="px-6 py-3 text-right font-medium text-green-600">
                                                            ${(row.total_revenue / 100).toFixed(2)}
                                                        </td>
                                                        <td className="px-6 py-3 text-right text-gray-500">
                                                            ${row.transaction_count > 0 ? ((row.total_revenue / row.transaction_count) / 100).toFixed(2) : '0.00'}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                                        No sales found in this period.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        {salesReport.length > 0 && (
                                            <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
                                                <tr>
                                                    <td className="px-6 py-3">Total</td>
                                                    <td className="px-6 py-3 text-right">
                                                        {salesReport.reduce((sum, r) => sum + r.transaction_count, 0)}
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-green-700">
                                                        ${(salesReport.reduce((sum, r) => sum + r.total_revenue, 0) / 100).toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-3"></td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ReportsDashboard;

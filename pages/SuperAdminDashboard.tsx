
import React, { useState, useEffect } from 'react';
import { PharmacyNode, MarketTrend, Prediction } from '../types';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend, ComposedChart, Area
} from 'recharts';
import { generateMarketReport } from '../services/geminiService';
import { getAllFacilities, getRegionalAggregates, getCategoryTrends, FacilityMetrics } from '../services/bmsService';

// --- MOCK DATA FOR PREDICTIONS (AI-generated, not facility-specific) ---
const MOCK_PREDICTIONS: Prediction[] = [
    { id: 'pr1', type: 'DISEASE', title: 'Cholera Outbreak Risk', probability: 78, description: 'Increased rainfall in Lusaka compounds suggests high risk of waterborne diseases.', impactLevel: 'HIGH', targetDate: 'Nov 2023' },
    { id: 'pr2', type: 'DRUG_DEMAND', title: 'Antihistamine Shortage', probability: 65, description: 'Pollen season starting early in Southern province will spike demand by 40%.', impactLevel: 'MEDIUM', targetDate: 'Sep 2023' },
    { id: 'pr3', type: 'PRICE_SPIKE', title: 'Insulin Cost Increase', probability: 90, description: 'Global supply chain disruption predicted to raise import costs by 15%.', impactLevel: 'HIGH', targetDate: 'Dec 2023' },
];

const SuperAdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MARKET' | 'FORECAST' | 'GOVERNANCE'>('OVERVIEW');
    const [aiSummary, setAiSummary] = useState<string>('Loading executive summary...');
    const [facilities, setFacilities] = useState<FacilityMetrics[]>([]);
    const [marketTrends, setMarketTrends] = useState<MarketTrend[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch real data on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch facilities
                const facilitiesData = await getAllFacilities();
                setFacilities(facilitiesData);

                // Fetch category trends and convert to MarketTrend format
                const trends = await getCategoryTrends(6);
                const formattedTrends: MarketTrend[] = trends.map((t, i) => ({
                    id: `t${i}`,
                    category: t.category,
                    region: 'National', // Aggregated nationally
                    demandIndex: Math.min(100, t.totalSold), // Simplified
                    supplyIndex: 100 - Math.min(100, t.totalSold), // Inverse for demo
                    avgPrice: t.avgPrice,
                    month: t.month
                }));
                setMarketTrends(formattedTrends);

                // Generate AI summary
                const report = await generateMarketReport(formattedTrends, MOCK_PREDICTIONS);
                setAiSummary(report);

            } catch (error) {
                console.error('Error fetching BMS data:', error);
                setAiSummary('Error loading data. Please refresh.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const toggleDataSharing = (id: string) => {
        setFacilities(prev => prev.map(f =>
            f.id === id ? { ...f, dataSharingEnabled: !f.dataSharingEnabled } : f
        ));
        // TODO: Call updateFacilityDataSharing from bmsService
    };

    const antibioticsData = marketTrends.filter(t => t.category === 'Antibiotics' || t.category === 'A');

    const renderOverview = () => (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* AI Executive Summary */}
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-white/10 rounded-lg">
                            <svg className="w-6 h-6 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <h2 className="text-xl font-bold">Executive AI Summary</h2>
                    </div>
                    <div className="prose prose-invert max-w-none">
                        <p className="text-purple-100 text-sm leading-relaxed whitespace-pre-line">{aiSummary}</p>
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-xs font-bold text-gray-500 uppercase">Active Nodes</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{facilities.filter(f => f.isActive).length}/{facilities.length}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-xs font-bold text-gray-500 uppercase">Data Stream Vol</p>
                    <p className="text-3xl font-bold text-indigo-600 mt-2">1.2TB</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-xs font-bold text-gray-500 uppercase">Avg Compliance</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-2">
                        {facilities.length > 0 ? Math.round(facilities.reduce((a, b) => a + b.complianceScore, 0) / facilities.length) : 0}%
                    </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-xs font-bold text-gray-500 uppercase">Risk Index</p>
                    <p className="text-3xl font-bold text-red-500 mt-2">High</p>
                </div>
            </div>
        </div>
    );

    const renderMarket = () => (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-slate-900 mb-6">Supply vs Demand (Antibiotics)</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={antibioticsData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="supplyIndex" name="Supply" fill="#82ca9d" barSize={20} />
                                <Line type="monotone" dataKey="demandIndex" name="Demand" stroke="#ff7300" strokeWidth={3} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-slate-900 mb-6">Price Trend Analysis (ZMW)</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={antibioticsData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="avgPrice" name="Avg Price" stroke="#8884d8" strokeWidth={3} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-slate-900 mb-4">Regional Shortage Heatmap (Text Mode)</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {['Lusaka', 'Copperbelt', 'Southern', 'Eastern', 'Northern'].map(region => (
                        <div key={region} className={`p-4 rounded-lg border ${region === 'Southern' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                            <p className="font-bold text-gray-700">{region}</p>
                            <p className={`text-sm ${region === 'Southern' ? 'text-red-600' : 'text-green-600'}`}>
                                {region === 'Southern' ? 'Critical Shortage' : 'Stable Supply'}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderForecast = () => (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {MOCK_PREDICTIONS.map(pred => (
                    <div key={pred.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className={`h-2 w-full ${pred.impactLevel === 'HIGH' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-bold">{pred.type}</span>
                                <span className="font-bold text-slate-900">{pred.probability}% Prob.</span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">{pred.title}</h3>
                            <p className="text-sm text-gray-600 mb-4">{pred.description}</p>
                            <div className="flex justify-between items-center text-xs text-gray-500">
                                <span>Impact: {pred.impactLevel}</span>
                                <span>Target: {pred.targetDate}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-slate-900 text-white p-8 rounded-2xl flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1">
                    <h3 className="text-2xl font-bold mb-2">Monetize These Insights</h3>
                    <p className="text-slate-300">
                        PharmAI allows you to package anonymized data reports for pharmaceutical suppliers and distributors.
                        Generate a new brokerage report for Q4 2023.
                    </p>
                </div>
                <button className="bg-white text-slate-900 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors">
                    Generate Data Report
                </button>
            </div>
        </div>
    );

    const renderGovernance = () => (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 text-lg">Pharmacy Network Governance</h3>
                    <button className="text-sm text-indigo-600 font-bold hover:underline">Download Audit Log</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Node Name</th>
                                <th className="px-6 py-4">Region</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Compliance</th>
                                <th className="px-6 py-4">Data Stream</th>
                                <th className="px-6 py-4">Last Audit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {facilities.map(facility => (
                                <tr key={facility.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-slate-900">{facility.name}</td>
                                    <td className="px-6 py-4 text-gray-500">{facility.region}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${facility.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {facility.isActive ? 'ACTIVE' : 'INACTIVE'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${facility.complianceScore > 90 ? 'bg-green-500' : facility.complianceScore > 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                    style={{ width: `${facility.complianceScore}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold">{facility.complianceScore}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => toggleDataSharing(facility.id)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-gray-200`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1`} />
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">{facility.lastAuditDate || 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    return (
        <div className="pb-10">
            <div className="bg-slate-900 text-white -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-8 mb-8">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-3xl font-bold mb-2">BMS Command Center</h1>
                    <p className="text-slate-400">National Health Strategy & Supply Chain Analytics</p>

                    <div className="flex gap-4 mt-6 overflow-x-auto pb-2 scrollbar-hide">
                        {['OVERVIEW', 'MARKET', 'FORECAST', 'GOVERNANCE'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === tab ? 'bg-indigo-500 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto">
                {activeTab === 'OVERVIEW' && renderOverview()}
                {activeTab === 'MARKET' && renderMarket()}
                {activeTab === 'FORECAST' && renderForecast()}
                {activeTab === 'GOVERNANCE' && renderGovernance()}
            </div>
        </div>
    );
};

export default SuperAdminDashboard;

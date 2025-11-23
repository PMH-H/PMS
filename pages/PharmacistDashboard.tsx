import React, { useState, useMemo } from 'react';
import { Prescription, InventoryItem, PrescriptionStatus } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, PieChart, Pie } from 'recharts';
import { optimizeInventoryLevels } from '../services/geminiService';

interface PharmacistDashboardProps {
    prescriptions: Prescription[];
    inventory: InventoryItem[];
    onUpdateStatus: (id: string, status: PrescriptionStatus) => void;
    onAddInventory: (item: Omit<InventoryItem, 'id'>) => void;
    onUpdateInventory: (id: string, updates: Partial<InventoryItem>) => void;
    onDeleteInventory: (id: string) => void;
    onReconcileInventory: (id: string, physicalCount: number) => void;
}

// Helper for status badges
const getStockStatus = (item: InventoryItem) => {
    if (item.currentStock <= 0) return { label: 'STOCKOUT', color: 'bg-red-800 text-white' };
    if (item.currentStock <= item.minLevel) return { label: 'CRITICAL', color: 'bg-red-100 text-red-800 border-red-200' };
    if (item.currentStock <= item.minLevel * 1.2) return { label: 'LOW', color: 'bg-orange-100 text-orange-800 border-orange-200' };
    if (item.currentStock >= item.maxLevel) return { label: 'OVERSTOCK', color: 'bg-purple-100 text-purple-800 border-purple-200' };
    return { label: 'GOOD', color: 'bg-green-100 text-green-800 border-green-200' };
};

const PharmacistDashboard: React.FC<PharmacistDashboardProps> = ({ 
    prescriptions, 
    inventory, 
    onUpdateStatus,
    onAddInventory,
    onUpdateInventory,
    onDeleteInventory,
    onReconcileInventory
}) => {
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'STOCK' | 'PROCUREMENT' | 'COUNTING'>('OVERVIEW');
    const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    
    // Cyclic Counting State
    const [countingItem, setCountingItem] = useState<string | null>(null);
    const [physicalCountInput, setPhysicalCountInput] = useState<number>(0);

    const [formData, setFormData] = useState<Omit<InventoryItem, 'id'>>({
        name: '',
        currentStock: 0,
        minLevel: 0,
        maxLevel: 0,
        unit: 'units',
        expirationDate: new Date().toISOString().split('T')[0],
        category: 'B',
        leadTime: 3,
        costPerUnit: 0.00
    });

    const pendingPrescriptions = useMemo(() => 
        prescriptions.filter(p => p.status === PrescriptionStatus.PENDING), 
    [prescriptions]);

    // Analytics Data
    const abcData = useMemo(() => {
        const counts = { A: 0, B: 0, C: 0 };
        inventory.forEach(i => counts[i.category]++);
        return Object.entries(counts).map(([name, value]) => ({ name: `Class ${name}`, value }));
    }, [inventory]);

    const procurementList = inventory.filter(i => i.currentStock <= i.minLevel);

    const handleRunAIOptimization = async () => {
        setIsOptimizing(true);
        const updates = await optimizeInventoryLevels(inventory);
        updates.forEach(u => {
            if (u.id) onUpdateInventory(u.id, u);
        });
        setIsOptimizing(false);
    };

    const handleOpenAdd = () => {
        setEditingItem(null);
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        setFormData({ 
            name: '', currentStock: 0, minLevel: 50, maxLevel: 200, unit: 'units',
            expirationDate: nextYear.toISOString().split('T')[0], category: 'C', leadTime: 3, costPerUnit: 0
        });
        setIsInventoryModalOpen(true);
    };

    const handleOpenEdit = (item: InventoryItem) => {
        setEditingItem(item);
        setFormData({
            name: item.name, currentStock: item.currentStock, minLevel: item.minLevel, maxLevel: item.maxLevel,
            unit: item.unit, expirationDate: item.expirationDate, category: item.category, leadTime: item.leadTime, costPerUnit: item.costPerUnit
        });
        setIsInventoryModalOpen(true);
    };

    const handleInventorySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingItem) {
            onUpdateInventory(editingItem.id, formData);
        } else {
            onAddInventory(formData);
        }
        setIsInventoryModalOpen(false);
    };

    const handleReconcileSubmit = () => {
        if (countingItem) {
            onReconcileInventory(countingItem, physicalCountInput);
            setCountingItem(null);
        }
    };

    // --- Render Functions ---

    const renderOverview = () => (
        <div className="space-y-6 animate-in fade-in duration-300">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm font-medium text-gray-500">Pending Rx</p>
                    <p className="text-3xl font-bold text-indigo-600 mt-2">{pendingPrescriptions.length}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm font-medium text-gray-500">Critical Stock</p>
                    <p className="text-3xl font-bold text-red-600 mt-2">{procurementList.length}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm font-medium text-gray-500">Total Value</p>
                    <p className="text-3xl font-bold text-green-700 mt-2">
                        ZMW {inventory.reduce((acc, i) => acc + (i.currentStock * i.costPerUnit), 0).toFixed(2)}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm font-medium text-gray-500">Inventory Accuracy</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">98.5%</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ABC Analysis Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-900">ABC Analysis (Inventory Value)</h3>
                        <button 
                            onClick={handleRunAIOptimization}
                            disabled={isOptimizing}
                            className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded hover:bg-indigo-100 flex items-center gap-1"
                        >
                            {isOptimizing ? 'Optimizing...' : 'AI Optimize Categories'}
                        </button>
                    </div>
                    <div className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={abcData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
                                    {abcData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={['#DC2626', '#FBBF24', '#9CA3AF'][index % 3]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="text-xs text-gray-500 text-center mt-2">
                        A: High Value (Strict Control) | B: Moderate | C: Low Value (Bulk)
                    </div>
                </div>

                {/* Queue Preview */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <h3 className="font-bold text-gray-900 mb-4">Urgent Rx Verification</h3>
                    {pendingPrescriptions.length === 0 ? (
                        <p className="text-gray-500 text-sm">No pending prescriptions.</p>
                    ) : (
                        <div className="space-y-3">
                            {pendingPrescriptions.slice(0, 3).map(p => (
                                <div key={p.id} className="p-3 border rounded-lg flex justify-between items-center bg-indigo-50/50">
                                    <div>
                                        <div className="font-medium text-sm">{p.patientName}</div>
                                        <div className="text-xs text-gray-500">{p.medications.length} items • {p.date}</div>
                                    </div>
                                    <button onClick={() => onUpdateStatus(p.id, PrescriptionStatus.APPROVED)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700">
                                        Approve
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderStockTable = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="p-5 border-b border-gray-200 flex flex-wrap gap-4 justify-between items-center">
                <h3 className="font-bold text-gray-900 text-lg">Inventory Records</h3>
                <button onClick={handleOpenAdd} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
                    + Add New Item
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th className="px-6 py-3">Category</th>
                            <th className="px-6 py-3">Item Name</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Stock / Min-Max</th>
                            <th className="px-6 py-3">Expiry</th>
                            <th className="px-6 py-3">Cost/Unit</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inventory.map(item => {
                            const status = getStockStatus(item);
                            return (
                                <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white text-xs ${
                                            item.category === 'A' ? 'bg-red-600' : item.category === 'B' ? 'bg-yellow-500' : 'bg-gray-400'
                                        }`}>
                                            {item.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {item.name}
                                        <div className="text-xs text-gray-400">Lead Time: {item.leadTime} days</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                                            {status.label}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-gray-900">{item.currentStock} {item.unit}</div>
                                        <div className="text-xs text-gray-400">Range: {item.minLevel} - {item.maxLevel}</div>
                                    </td>
                                    <td className="px-6 py-4">{item.expirationDate}</td>
                                    <td className="px-6 py-4">ZMW {item.costPerUnit.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => handleOpenEdit(item)} className="text-indigo-600 hover:text-indigo-900 font-medium">Edit</button>
                                        <button onClick={() => onDeleteInventory(item.id)} className="text-red-600 hover:text-red-900 font-medium">Del</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderProcurement = () => (
        <div className="space-y-6 animate-in fade-in duration-300">
             <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                            Automation Alert: {procurementList.length} items are below their Reorder Point (Min Level).
                            Emergency orders recommended for 'A' class items.
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-200">
                    <h3 className="font-bold text-gray-900 text-lg">Purchase Order Suggestions</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th className="px-6 py-3">Item</th>
                                <th className="px-6 py-3">Category</th>
                                <th className="px-6 py-3">Available</th>
                                <th className="px-6 py-3">Reorder Point</th>
                                <th className="px-6 py-3">Order Qty (to Max)</th>
                                <th className="px-6 py-3">Est. Cost</th>
                                <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {procurementList.map(item => {
                                const orderQty = item.maxLevel - item.currentStock;
                                const cost = orderQty * item.costPerUnit;
                                return (
                                    <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                                        <td className="px-6 py-4"><span className="font-bold">{item.category}</span></td>
                                        <td className="px-6 py-4 text-red-600 font-bold">{item.currentStock}</td>
                                        <td className="px-6 py-4">{item.minLevel}</td>
                                        <td className="px-6 py-4 font-bold text-indigo-700">{orderQty}</td>
                                        <td className="px-6 py-4">ZMW {cost.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-indigo-700">
                                                Create PO
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                             {procurementList.length === 0 && (
                                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No items need reordering.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderCounting = () => (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                <p className="text-sm text-blue-700">
                    <strong>Cyclic Counting:</strong> 'A' items should be counted weekly. 'B' monthly. 'C' quarterly.
                    Select an item to reconcile physical stock against system records.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 font-semibold text-gray-800">Count Queue (Due Items)</div>
                    <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                        {inventory.sort((a,b) => (a.lastCountDate || '') > (b.lastCountDate || '') ? 1 : -1).map(item => (
                            <li key={item.id} className="p-4 hover:bg-gray-50 flex justify-between items-center transition-colors">
                                <div>
                                    <div className="font-medium text-gray-900">{item.name}</div>
                                    <div className="text-xs text-gray-500">Last Counted: {item.lastCountDate || 'Never'} • Class {item.category}</div>
                                </div>
                                <button 
                                    onClick={() => { setCountingItem(item.id); setPhysicalCountInput(item.currentStock); }}
                                    className="border border-indigo-200 text-indigo-700 px-3 py-1 rounded text-sm hover:bg-indigo-50"
                                >
                                    Count
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-bold text-gray-900 mb-4 text-lg">Reconciliation</h3>
                    {countingItem ? (
                        <div className="space-y-4">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <span className="text-xs text-gray-500 uppercase">Selected Item</span>
                                <div className="font-bold text-xl text-gray-800">
                                    {inventory.find(i => i.id === countingItem)?.name}
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                    System Quantity: <span className="font-mono font-bold">{inventory.find(i => i.id === countingItem)?.currentStock}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Physical Count Qty</label>
                                <input 
                                    type="number" 
                                    className="w-full text-2xl font-bold p-3 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={physicalCountInput}
                                    onChange={(e) => setPhysicalCountInput(parseInt(e.target.value) || 0)}
                                />
                            </div>

                            <div className="pt-4">
                                <button 
                                    onClick={handleReconcileSubmit}
                                    className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-indigo-700 shadow-md transition-colors"
                                >
                                    Confirm Reconciliation
                                </button>
                                <button 
                                    onClick={() => setCountingItem(null)}
                                    className="w-full mt-2 text-gray-500 py-2 hover:text-gray-700"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                            <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                            <p>Select an item from the queue to start counting.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            
            {/* Header / Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 flex overflow-x-auto">
                {(['OVERVIEW', 'STOCK', 'PROCUREMENT', 'COUNTING'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
                            activeTab === tab 
                            ? 'bg-indigo-100 text-indigo-700 shadow-sm' 
                            : 'text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                        {tab === 'STOCK' ? 'STOCK CONTROL' : tab}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'OVERVIEW' && renderOverview()}
                {activeTab === 'STOCK' && renderStockTable()}
                {activeTab === 'PROCUREMENT' && renderProcurement()}
                {activeTab === 'COUNTING' && renderCounting()}
            </div>

            {/* Inventory Modal (Add/Edit) */}
            {isInventoryModalOpen && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 text-lg">{editingItem ? 'Edit Inventory Item' : 'New Stock Item'}</h3>
                            <button onClick={() => setIsInventoryModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleInventorySubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Medication Name</label>
                                    <input 
                                        required
                                        type="text" 
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="e.g. Amoxicillin 500mg"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">ABC Category</label>
                                    <select 
                                        value={formData.category}
                                        onChange={(e) => setFormData({...formData, category: e.target.value as any})}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="A">Class A (High Value)</option>
                                        <option value="B">Class B (Moderate)</option>
                                        <option value="C">Class C (Low Value)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Cost Per Unit (ZMW)</label>
                                    <input 
                                        type="number" step="0.01" min="0"
                                        value={formData.costPerUnit}
                                        onChange={(e) => setFormData({...formData, costPerUnit: parseFloat(e.target.value)})}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 col-span-2 grid grid-cols-3 gap-4">
                                    <div className="col-span-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Stock Parameters</div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Current</label>
                                        <input 
                                            required type="number" min="0"
                                            value={formData.currentStock}
                                            onChange={(e) => setFormData({...formData, currentStock: parseInt(e.target.value)})}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 text-red-600">Min (Reorder)</label>
                                        <input 
                                            required type="number" min="0"
                                            value={formData.minLevel}
                                            onChange={(e) => setFormData({...formData, minLevel: parseInt(e.target.value)})}
                                            className="w-full border border-red-200 bg-red-50 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Level</label>
                                        <input 
                                            required type="number" min="0"
                                            value={formData.maxLevel}
                                            onChange={(e) => setFormData({...formData, maxLevel: parseInt(e.target.value)})}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Lead Time (Days)</label>
                                    <input 
                                        type="number" min="0"
                                        value={formData.leadTime}
                                        onChange={(e) => setFormData({...formData, leadTime: parseInt(e.target.value)})}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Expiration Date</label>
                                    <input 
                                        required type="date" 
                                        value={formData.expirationDate}
                                        onChange={(e) => setFormData({...formData, expirationDate: e.target.value})}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                                <button type="button" onClick={() => setIsInventoryModalOpen(false)} className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                                <button type="submit" className="px-6 py-2.5 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 font-medium shadow-md">
                                    {editingItem ? 'Save Changes' : 'Create Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PharmacistDashboard;
import React, { useState, useMemo, useRef } from 'react';
import { Prescription, PrescriptionStatus, InventoryItem, Medication, User } from '../types';
import ProfileSettings from './ProfileSettings';
import NewsFeed from '../components/NewsFeed';
import Messaging from '../components/Messaging';
import PurchaseOrderManager from '../components/PurchaseOrderManager';
import OrderManagement from '../components/OrderManagement';
import PrescriptionManager from '../components/PrescriptionManager';
import PharmacistMetricsPanel from '../components/PharmacistMetricsPanel';
import StoreProductManager from '../components/StoreProductManager';
import ReportsDashboard from '../components/ReportsDashboard';
import DrugNameInput from '../components/DrugNameInput';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, PieChart, Pie } from 'recharts';
import { analyzePrescriptionImage, checkDrugInteractions, optimizeInventoryLevels, runABCOptimization } from '../services/geminiService';
import { generateUUID } from '../utils/uuid';
import ClinicalDrugDirectory from '../components/ClinicalDrugDirectory';
import PharmacyRegistrationForm from '../components/PharmacyRegistrationForm';
import { createJoinRequest, leaveFacility } from '../services/userHierarchyService';
import { supabase } from '../services/supabase';
import { toast } from 'sonner';

interface PharmacistDashboardProps {
    currentUser?: User;
    onUpdateUser?: (user: User) => void;
    prescriptions: Prescription[];
    inventory: InventoryItem[];
    onUpdateStatus: (id: string, status: PrescriptionStatus) => void;
    onAddInventory: (item: Omit<InventoryItem, 'id'>) => void;
    onUpdateInventory: (id: string, updates: Partial<InventoryItem>) => void;
    onDeleteInventory: (id: string) => void;
    onReconcileInventory: (id: string, physicalCount: number) => void;
    onAddPrescription: (p: Prescription) => void;
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
    currentUser,
    onUpdateUser,
    prescriptions,
    inventory,
    onUpdateStatus,
    onAddInventory,
    onUpdateInventory,
    onDeleteInventory,
    onReconcileInventory,
    onAddPrescription
}) => {
    // --- JOIN FACILITY STATE ---
    const [joinFacilityId, setJoinFacilityId] = useState('');
    const [joinStatus, setJoinStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [joinMessage, setJoinMessage] = useState('');

    // --- FACILITY INFO & LEAVE STATE ---
    const [facilityName, setFacilityName] = useState<string>('');
    const [isLeaving, setIsLeaving] = useState(false);

    React.useEffect(() => {
        if (currentUser?.facility_id) {
            supabase.from('facilities').select('name').eq('id', currentUser.facility_id).maybeSingle()
                .then(({ data }) => {
                    if (data) setFacilityName(data.name);
                    else setFacilityName('Unknown Facility');
                })
                .catch(err => console.error("Error fetching facility", err));
        }
    }, [currentUser?.facility_id]);

    const handleLeaveFacility = async () => {
        if (!window.confirm("Are you sure you want to disconnect from this pharmacy? You will lose access to its data.")) return;
        setIsLeaving(true);
        try {
            await leaveFacility();
            toast.success("Disconnected successfully!");
            window.location.reload();
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to disconnect: " + err.message);
            setIsLeaving(false);
        }
    };

    // --- Tab Grouping ---
    type TabGroup = 'OVERVIEW' | 'SHOP' | 'CLINICAL' | 'PERFORMANCE' | 'COMMUNICATION';

    const TAB_GROUPS: Record<TabGroup, { key: string, label: string, icon: string }[]> = {
        OVERVIEW: [
            { key: 'OVERVIEW', label: 'Dashboard', icon: '📊' },
            { key: 'NEWS', label: 'News Feed', icon: '📰' }
        ],
        SHOP: [
            { key: 'STOCK', label: 'Inventory', icon: '📦' },
            { key: 'STORE', label: 'Store Manager', icon: '🏪' },
            { key: 'PROCUREMENT', label: 'Procurement', icon: '🛒' },
            { key: 'COUNTING', label: 'Stock Count', icon: '🔢' }
        ],
        CLINICAL: [
            { key: 'PRESCRIPTIONS', label: 'Prescriptions', icon: '💊' },
            { key: 'ORDERS', label: 'Orders', icon: '📋' },
            { key: 'FORMULARY', label: 'Drug Directory', icon: '📚' }
        ],
        COMMUNICATION: [
            { key: 'MESSAGES', label: 'Messages', icon: '💬' },
            { key: 'CONSULTATIONS', label: 'Telehealth', icon: '📹' },
            { key: 'COMMUNITY', label: 'Community', icon: '👥' }
        ],
        PERFORMANCE: [
            { key: 'METRICS', label: 'My Metrics', icon: '📈' },
            { key: 'REPORTS', label: 'Reports', icon: '📈' }
        ]
    };

    const [activeGroup, setActiveGroup] = useState<TabGroup>('OVERVIEW');
    const [activeTab, setActiveTab] = useState<string>('OVERVIEW');

    // Auto-select first subtab when group changes
    const handleGroupChange = (group: TabGroup) => {
        setActiveGroup(group);
        setActiveTab(TAB_GROUPS[group][0].key);
    };

    // --- INVENTORY STATE ---
    const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [filterCategory, setFilterCategory] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isCatalogSearch, setIsCatalogSearch] = useState(true); // Toggle between searching master vs creating new

    // Form State
    const [formData, setFormData] = useState<Omit<InventoryItem, 'id'> & { sellingPrice?: number }>({
        name: '',
        currentStock: 0,
        minLevel: 10,
        maxLevel: 100,
        costPerUnit: 0,
        sellingPrice: 0,
        category: 'C',
        expirationDate: new Date().toISOString().split('T')[0],
        leadTime: 1,
        abcCategory: 'C'
    });

    const handleInventorySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingItem) {
                // Update item metadata in items table
                const { error: itemError } = await supabase
                    .from('items')
                    .update({
                        name: formData.name,
                        category: formData.abcCategory,
                        min_level: formData.minLevel,
                        max_level: formData.maxLevel,
                    })
                    .eq('id', editingItem.id);

                if (itemError) throw itemError;

                // Update batch cost & quantity (most recent batch for this facility)
                const { error: batchError } = await supabase
                    .from('item_batches')
                    .update({
                        cost_per_unit: formData.costPerUnit,
                        current_quantity: formData.currentStock,
                        expiry_date: formData.expirationDate || null,
                    })
                    .eq('item_id', editingItem.id)
                    .eq('facility_id', currentUser?.facility_id);

                if (batchError) console.warn('Batch update warning:', batchError);

                // Also call the legacy handler for any local state updates
                onUpdateInventory(editingItem.id, formData);
                toast.success("Item updated successfully!");
                // No reload - data will refresh on next poll cycle
            } else {
                // creating new inventory
                let itemId = '';

                // 1. Check if item exists in Master Catalog (Global or Local)
                const { data: existingItem } = await supabase
                    .from('items')
                    .select('id')
                    .ilike('name', formData.name)
                    .maybeSingle();

                if (existingItem) {
                    itemId = existingItem.id;
                    // Update price on existing item if provided
                    if (formData.sellingPrice && formData.sellingPrice > 0) {
                        await supabase.from('items').update({ price_cents: formData.sellingPrice }).eq('id', itemId);
                    }
                } else {
                    // 2. Create New Local Item with price_cents
                    const { data: newItem, error: createError } = await supabase
                        .from('items')
                        .insert({
                            name: formData.name,
                            category: formData.abcCategory,
                            min_level: formData.minLevel,
                            max_level: formData.maxLevel,
                            unit: 'units',
                            sku: `SKU-${Date.now()}`,
                            is_global: false,
                            facility_id: currentUser?.facility_id,
                            price_cents: formData.sellingPrice || formData.costPerUnit || 0
                        })
                        .select()
                        .single();

                    if (createError) throw createError;
                    itemId = newItem.id;
                }

                // 3. Add Batch
                const { error: batchError } = await supabase
                    .from('item_batches')
                    .insert({
                        item_id: itemId,
                        facility_id: currentUser?.facility_id,
                        batch_no: `BATCH-${Date.now()}`,
                        expiry_date: formData.expirationDate || new Date(Date.now() + 31536000000).toISOString(),
                        current_quantity: formData.currentStock,
                        received_quantity: formData.currentStock,
                        cost_per_unit: formData.costPerUnit
                    });

                if (batchError) throw batchError;

                toast.success("Inventory added successfully!");
                // No reload - data will refresh on next poll cycle
            }
            setIsInventoryModalOpen(false);
            setEditingItem(null);
            // Reset form
            setFormData({
                name: '', currentStock: 0, minLevel: 10, maxLevel: 100,
                costPerUnit: 0, category: 'C',
                expirationDate: new Date().toISOString().split('T')[0],
                leadTime: 1, abcCategory: 'C'
            });
        } catch (err: any) {
            console.error("Inventory Error:", err);
            toast.error("Failed to save inventory: " + err.message);
        }
    };

    // --- RENDER HELPERS ---

    const renderOverview = () => {
        const lowStockCount = inventory.filter(i => i.currentStock <= i.minLevel).length;
        const pendingRxCount = prescriptions.filter(p => p.status === 'PENDING').length;
        // Calculate dynamic ABC stats if available, else static
        const abcStats = [
            { name: 'Class A', value: inventory.filter(i => i.abcCategory === 'A').length, color: '#FF8042' },
            { name: 'Class B', value: inventory.filter(i => i.abcCategory === 'B').length, color: '#00C49F' },
            { name: 'Class C', value: inventory.filter(i => i.abcCategory === 'C').length, color: '#FFBB28' },
        ].filter(s => s.value > 0);

        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-md">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-indigo-100 font-medium text-xs uppercase tracking-wider">Pending Rxs</p>
                                <h3 className="text-3xl font-bold mt-1">{pendingRxCount}</h3>
                            </div>
                            <div className="bg-white/20 p-2 rounded-lg">💊</div>
                        </div>
                        <p className="text-xs text-indigo-100 mt-4 bg-white/10 inline-block px-2 py-1 rounded">
                            {prescriptions.filter(p => p.status === 'APPROVED').length} Approved today
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl p-5 text-white shadow-md">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-rose-100 font-medium text-xs uppercase tracking-wider">Critical Stock</p>
                                <h3 className="text-3xl font-bold mt-1">{lowStockCount}</h3>
                            </div>
                            <div className="bg-white/20 p-2 rounded-lg">📉</div>
                        </div>
                        <p className="text-xs text-rose-100 mt-4 bg-white/10 inline-block px-2 py-1 rounded">
                            Action required
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-md">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-emerald-100 font-medium text-xs uppercase tracking-wider">Total Items</p>
                                <h3 className="text-3xl font-bold mt-1">{inventory.length}</h3>
                            </div>
                            <div className="bg-white/20 p-2 rounded-lg">📦</div>
                        </div>
                        <p className="text-xs text-emerald-100 mt-4 bg-white/10 inline-block px-2 py-1 rounded">
                            Value: ZMW {inventory.reduce((acc, i) => acc + (i.currentStock * i.costPerUnit), 0).toLocaleString()}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Activity Feed */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span>📋</span> Recent Prescriptions
                        </h3>
                        {prescriptions.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-8">No prescriptions yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {prescriptions.slice(0, 5).map(rx => (
                                    <div key={rx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => { setActiveTab('PRESCRIPTIONS') }}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${rx.status === 'PENDING' ? 'bg-amber-400' : rx.status === 'APPROVED' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                            <div>
                                                <p className="font-bold text-sm text-gray-900">
                                                    {rx.medications && rx.medications.length > 0 ? rx.medications[0].name : (rx.manual_entry || 'Unspecified Med')}
                                                    {rx.medications && rx.medications.length > 1 ? ` +${rx.medications.length - 1}` : ''}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {rx.patientName || 'Unknown Patient'} • {new Date(rx.created_at || Date.now()).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded border ${rx.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' : rx.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                            {rx.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ABC Analysis Chart */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <span>📊</span> Inventory Composition (ABC)
                            </h3>
                            <button
                                onClick={async () => {
                                    if (!window.confirm("Run AI Optimization analysis?")) return;
                                    try {
                                        await runABCOptimization(currentUser?.facility_id || '');
                                        toast.success("Analysis complete. Refreshing...");
                                        window.location.reload();
                                    } catch (e: any) { toast.error(e.message) }
                                }}
                                className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
                            >
                                ✨ Run AI Optimize
                            </button>
                        </div>
                        {abcStats.length > 0 ? (
                            <div className="flex-1 min-h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={abcStats}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {abcStats.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                                Not enough data for analysis
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderStockTable = () => {
        const filteredInventory = inventory.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === 'ALL' || item.abcCategory === filterCategory;
            return matchesSearch && matchesCategory;
        });

        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in duration-300">
                <div className="p-4 border-b border-gray-100 gap-4 flex flex-col md:flex-row justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <span>📦</span> Current Inventory ({filteredInventory.length})
                    </h3>
                    <div className="flex gap-2 w-full md:w-auto">
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="ALL">All Categories</option>
                            <option value="A">Class A (High Value)</option>
                            <option value="B">Class B (Moderate)</option>
                            <option value="C">Class C (Low Value)</option>
                        </select>
                        <button
                            onClick={() => { setEditingItem(null); setFormData({ name: '', currentStock: 0, minLevel: 10, maxLevel: 100, costPerUnit: 0, category: 'C', expirationDate: '', leadTime: 1, abcCategory: 'C' }); setIsInventoryModalOpen(true); }}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-sm transition-all active:scale-95"
                        >
                            <span>+</span> Add Item
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Item Name</th>
                                <th className="px-4 py-3 font-semibold text-center">ABC Class</th>
                                <th className="px-4 py-3 font-semibold text-right">Stock Level</th>
                                <th className="px-4 py-3 font-semibold text-right">Unit Cost</th>
                                <th className="px-4 py-3 font-semibold text-center">Status</th>
                                <th className="px-4 py-3 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredInventory.map((item) => {
                                const status = getStockStatus(item);
                                return (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-block w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${item.abcCategory === 'A' ? 'bg-orange-100 text-orange-700' : item.abcCategory === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {item.abcCategory}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-gray-700">
                                            {item.currentStock} <span className="text-gray-400 text-xs">/ {item.maxLevel}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600">
                                            ZMW {item.costPerUnit.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold border ${status.color}`}>
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingItem(item);
                                                        // Safe date parsing to prevent toISOString error
                                                        const safeExpiry = item.expirationDate && !isNaN(new Date(item.expirationDate).getTime())
                                                            ? new Date(item.expirationDate).toISOString().split('T')[0]
                                                            : '';
                                                        setFormData({ ...item, expirationDate: safeExpiry, sellingPrice: 0 });
                                                        setIsInventoryModalOpen(true);
                                                    }}
                                                    className="text-indigo-600 hover:bg-indigo-100 p-2 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => onDeleteInventory(item.id)}
                                                    className="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredInventory.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                                        No items found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderProcurement = () => {
        const lowStockItems = inventory.filter(item => item.currentStock <= item.minLevel);
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in duration-300">
                <div className="p-4 border-b border-gray-100 bg-red-50 flex justify-between items-center">
                    <h3 className="font-bold text-red-900 flex items-center gap-2">
                        <span>🛒</span> Reorder Suggested ({lowStockItems.length})
                    </h3>
                    <button className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 shadow-sm transition-transform active:scale-95">
                        Create Purchase Order
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Item</th>
                                <th className="px-4 py-3 font-semibold text-right">Current</th>
                                <th className="px-4 py-3 font-semibold text-right">Min Level</th>
                                <th className="px-4 py-3 font-semibold text-right">To Order</th>
                                <th className="px-4 py-3 font-semibold text-right">Est. Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {lowStockItems.map(item => {
                                const toOrder = item.maxLevel - item.currentStock;
                                const cost = toOrder * item.costPerUnit;
                                return (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                                        <td className="px-4 py-3 text-right text-red-600 font-bold">{item.currentStock}</td>
                                        <td className="px-4 py-3 text-right text-gray-500">{item.minLevel}</td>
                                        <td className="px-4 py-3 text-right font-bold text-indigo-600">+{toOrder}</td>
                                        <td className="px-4 py-3 text-right text-gray-700">ZMW {cost.toFixed(2)}</td>
                                    </tr>
                                )
                            })}
                            {lowStockItems.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500 bg-green-50/50">
                                        <p className="font-medium text-green-700">All stock levels are healthy!</p>
                                        <p className="text-xs text-green-600 mt-1">No procurement needed right now.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderCounting = () => {
        // Cyclic counting simulation: Random 3 items per day
        // Stable-ish random for demo (using day of month)
        const today = new Date().getDate();
        const itemsToCount = inventory.filter((_, idx) => (idx + today) % 5 === 0);

        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in duration-300">
                <div className="p-4 border-b border-gray-100 bg-indigo-50 flex justify-between items-center">
                    <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                        <span>🔢</span> Cyclic Counting Queue (Today)
                    </h3>
                    <div className="text-xs text-indigo-600 font-medium bg-white px-2 py-1 rounded border border-indigo-200">
                        {new Date().toLocaleDateString()}
                    </div>
                </div>
                <div className="p-4 grid gap-4">
                    {itemsToCount.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No items scheduled for counting today.</div>
                    ) : (
                        itemsToCount.map(item => (
                            <div key={item.id} className="flex justify-between items-center p-3 border rounded-lg hover:border-indigo-300 transition-colors bg-gray-50">
                                <div>
                                    <p className="font-bold text-gray-800">{item.name}</p>
                                    <p className="text-xs text-gray-500">System Record: {item.currentStock}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onReconcileInventory(item.id, item.currentStock)}
                                        className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded font-bold hover:bg-green-200"
                                    >
                                        Confirm
                                    </button>
                                    <button
                                        onClick={() => {
                                            const actual = parseInt(prompt(`Enter actual count for ${item.name}:`) || '0');
                                            if (!isNaN(actual)) onReconcileInventory(item.id, actual);
                                        }}
                                        className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded font-bold hover:bg-gray-50"
                                    >
                                        Adjust
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    const renderCommunication = () => (
        <div className="space-y-6">
            {activeTab === 'MESSAGES' && (
                <div className="h-[600px] bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <Messaging currentUser={currentUser!} facilityId={currentUser?.facility_id} />
                </div>
            )}

            {activeTab === 'CONSULTATIONS' && (
                <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
                    <div className="max-w-md mx-auto text-center">
                        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">📹</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Telehealth Consultations</h3>
                        <p className="text-gray-500 mb-6">Schedule and manage audio/video consultations with patients and other providers.</p>
                        <button className="bg-indigo-600 text-white px-6 py-3 rounded-full font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                            Schedule New Consultation
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'COMMUNITY' && (
                <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
                    <div className="text-6xl mb-4">🏗️</div>
                    <h3 className="text-lg font-bold text-gray-900">Community Hub Under Construction</h3>
                    <p className="text-gray-500 mt-2">Connect with other pharmacists and providers soon.</p>
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-4 md:space-y-6 p-2 md:p-0">

            {/* Facility Header */}
            <div className="bg-gradient-to-r from-indigo-50 to-white p-4 rounded-xl shadow-sm border border-indigo-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700">🏥</div>
                    <div>
                        <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider">Connected Pharmacy</p>
                        <h2 className="text-sm md:text-base font-bold text-indigo-900">{facilityName || 'Loading...'}</h2>
                    </div>
                </div>
                <button
                    onClick={handleLeaveFacility}
                    disabled={isLeaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-xs font-bold shadow-sm transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    {isLeaving ? 'Disconnecting...' : 'Disconnect'}
                </button>
            </div>

            {/* Navigation Groups */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
                {/* Main Groups */}
                <div className="flex overflow-x-auto scrollbar-hide gap-2 mb-3 border-b border-gray-100 pb-2">
                    {(Object.keys(TAB_GROUPS) as TabGroup[]).map(group => (
                        <button
                            key={group}
                            onClick={() => handleGroupChange(group)}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeGroup === group
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            {group.charAt(0) + group.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>

                {/* Sub Tabs */}
                <div className="flex overflow-x-auto scrollbar-hide gap-1">
                    {TAB_GROUPS[activeGroup].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${activeTab === tab.key
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <span className="text-base">{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'OVERVIEW' && renderOverview()}
                {activeTab === 'METRICS' && currentUser && (
                    <PharmacistMetricsPanel currentUser={currentUser} />
                )}
                {activeTab === 'REPORTS' && <ReportsDashboard />}
                {activeTab === 'STOCK' && renderStockTable()}
                {activeTab === 'PROCUREMENT' && currentUser && (
                    <PurchaseOrderManager currentUser={currentUser} facilityId={currentUser.facility_id || ''} />
                )}
                {activeTab === 'STORE' && <StoreProductManager />}
                {activeTab === 'ORDERS' && currentUser && (
                    <OrderManagement currentUser={currentUser} facilityId={currentUser.facility_id} />
                )}
                {activeTab === 'PRESCRIPTIONS' && currentUser && (
                    <PrescriptionManager currentUser={currentUser} facilityId={currentUser.facility_id} />
                )}
                {activeTab === 'COUNTING' && renderCounting()}
                {activeTab === 'NEWS' && <NewsFeed />}
                {activeTab === 'FORMULARY' && (
                    <div className="h-[600px]">
                        <ClinicalDrugDirectory />
                    </div>
                )}
                {activeGroup === 'COMMUNICATION' && renderCommunication()}
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
                                    <DrugNameInput
                                        value={formData.name}
                                        onChange={(name) => setFormData({ ...formData, name })}
                                        required
                                        placeholder="Start typing to search formulary..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">ABC Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
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
                                        onChange={(e) => setFormData({ ...formData, costPerUnit: parseFloat(e.target.value) || 0 })}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Purchase cost"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Your purchase cost</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-emerald-700 mb-1">💰 Selling Price (ZMW)</label>
                                    <input
                                        type="number" step="0.01" min="0"
                                        value={formData.sellingPrice || 0}
                                        onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                                        className="w-full border border-emerald-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none bg-emerald-50"
                                        placeholder="Price for customers"
                                    />
                                    <p className="text-xs text-emerald-600 mt-1">Price shown in shop</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 col-span-2 grid grid-cols-3 gap-4">
                                    <div className="col-span-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Stock Parameters</div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock</label>
                                        <input
                                            placeholder="e.g., 100"
                                            required type="number" min="0"
                                            value={formData.currentStock || 0}
                                            onChange={(e) => setFormData({ ...formData, currentStock: parseInt(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Min Level</label>
                                        <input
                                            required type="number" min="0"
                                            value={formData.minLevel || 0}
                                            onChange={(e) => setFormData({ ...formData, minLevel: parseInt(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Level</label>
                                        <input
                                            required type="number" min="0"
                                            value={formData.maxLevel || 0}
                                            onChange={(e) => setFormData({ ...formData, maxLevel: parseInt(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Lead Time (days)</label>
                                        <input
                                            type="number" min="0"
                                            value={formData.leadTime || 0}
                                            onChange={(e) => setFormData({ ...formData, leadTime: parseInt(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Expiration Date</label>
                                    <input
                                        required type="date"
                                        value={formData.expirationDate}
                                        onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
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

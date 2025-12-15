import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Prescription, PrescriptionStatus, InventoryItem, Medication, User } from '../types';
import ProfileSettings from './ProfileSettings';
import NewsFeed from '../components/NewsFeed';
import PurchaseOrderManager from '../components/PurchaseOrderManager';
import OrderManagement from '../components/OrderManagement';
import PrescriptionManager from '../components/PrescriptionManager';
import PharmacistMetricsPanel from '../components/PharmacistMetricsPanel';
import ClinicalDrugDirectory from '../components/ClinicalDrugDirectory';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, PieChart, Pie } from 'recharts';
import { analyzePrescriptionImage, checkDrugInteractions, optimizeInventoryLevels } from '../services/geminiService';
import { getItems, addItem, updateItem, deleteItem } from '../services/database'; // Updated imports
import { generateUUID } from '../utils/uuid';

interface PharmacistDashboardProps {
    currentUser: User;
    onUpdateUser: (user: User) => void;
    prescriptions: Prescription[]; // Assuming prescriptions are still passed as props for now
    onUpdateStatus: (id: string, status: PrescriptionStatus) => void;
    onAddPrescription: (p: Prescription) => void;
}

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
    onUpdateStatus,
    onAddPrescription
}) => {
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'METRICS' | 'STOCK' | 'PROCUREMENT' | 'ORDERS' | 'PRESCRIPTIONS' | 'COUNTING' | 'NEWS' | 'FORMULARY'>('OVERVIEW');
    const [inventory, setInventory] = useState<InventoryItem[]>([]); // Internal state for inventory
    const [loadingInventory, setLoadingInventory] = useState(true);
    const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [countingItem, setCountingItem] = useState<string | null>(null);
    const [physicalCountInput, setPhysicalCountInput] = useState<number>(0);

    const [formData, setFormData] = useState<Omit<InventoryItem, 'id'>>({
        name: '', currentStock: 0, minLevel: 0, maxLevel: 0, unit: 'units',
        expirationDate: new Date().toISOString().split('T')[0], category: 'B', leadTime: 3, costPerUnit: 0.00
    });

    const fetchInventory = async () => {
        setLoadingInventory(true);
        try {
            const items = await getItems(currentUser.facility_id);
            setInventory(items as InventoryItem[]);
        } catch (error) {
            console.error("Error fetching inventory:", error);
            // Handle error display to user
        } finally {
            setLoadingInventory(false);
        }
    };

    useEffect(() => {
        if (currentUser.facility_id) {
            fetchInventory();
        }
    }, [currentUser.facility_id]);

    const pendingPrescriptions = useMemo(() =>
        prescriptions.filter(p => p.status?.toUpperCase() === 'PENDING'),
        [prescriptions]);

    const abcData = useMemo(() => {
        const counts = { A: 0, B: 0, C: 0 };
        inventory.forEach(i => counts[i.category]++);
        return Object.entries(counts).map(([name, value]) => ({ name: `Class ${name}`, value }));
    }, [inventory]);

    const procurementList = inventory.filter(i => i.currentStock <= i.minLevel);

    const handleRunAIOptimization = async () => {
        setIsOptimizing(true);
        const updates = await optimizeInventoryLevels(inventory);
        try {
            await Promise.all(updates.map(u => u.id && updateItem(u.id, u)));
            fetchInventory(); // Re-fetch to update the view
        } catch (error) {
            console.error("Error optimizing inventory:", error);
        }
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
        setFormData(item);
        setIsInventoryModalOpen(true);
    };
    
    const handleInventorySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await updateItem(editingItem.id, formData);
            } else {
                await addItem(formData);
            }
            setIsInventoryModalOpen(false);
            fetchInventory(); // Refresh data
        } catch (error) {
            console.error("Error submitting inventory form:", error);
        }
    };

    const handleDeleteItem = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
            try {
                await deleteItem(id);
                fetchInventory(); // Refresh data
            } catch (error) {
                console.error("Error deleting item:", error);
                alert('Failed to delete item.');
            }
        }
    };

    const handleReconcileSubmit = async () => {
        if (countingItem) {
            try {
                await updateItem(countingItem, { currentStock: physicalCountInput });
                setCountingItem(null);
                fetchInventory();
            } catch (error) {
                console.error("Error reconciling stock:", error)
            }
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = async () => {
                const base64 = (reader.result as string).split(',')[1];
                const meds = await analyzePrescriptionImage(base64);
                if (meds.length > 0) {
                    const interactions = await checkDrugInteractions(meds);
                    const newRx: Prescription = {
                        id: generateUUID(),
                        patient_id: currentUser?.id || '',
                        patientName: "Walk-in Patient",
                        medications: meds,
                        status: PrescriptionStatus.PENDING,
                        image_url: reader.result as string,
                        interactions,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                    onAddPrescription(newRx);
                    alert("Prescription uploaded successfully!");
                } else {
                    alert("Could not detect medications. Try a clearer photo.");
                }
                setIsUploading(false);
            };
        } catch (e) {
            setIsUploading(false);
            alert("Error uploading image");
        }
    };

    const renderStockTable = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="p-5 border-b border-gray-200 flex flex-wrap gap-4 justify-between items-center">
                 <h3 className="font-bold text-gray-900 text-lg">Inventory Records</h3>
                 <button onClick={handleOpenAdd} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ Add New Item</button>
             </div>
             <div className="overflow-x-auto">
                 {loadingInventory ? (
                     <div className="text-center py-10">Loading inventory...</div>
                 ) : (
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
                                         <td className="px-6 py-4"><span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white text-xs ${item.category === 'A' ? 'bg-red-600' : item.category === 'B' ? 'bg-yellow-500' : 'bg-gray-400'}`}>{item.category}</span></td>
                                         <td className="px-6 py-4 font-medium text-gray-900">{item.name}<div className="text-xs text-gray-400">Lead Time: {item.leadTime} days</div></td>
                                         <td className="px-6 py-4"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>{status.label}</span></td>
                                         <td className="px-6 py-4"><div className="font-semibold text-gray-900">{item.currentStock} {item.unit}</div><div className="text-xs text-gray-400">Range: {item.minLevel} - {item.maxLevel}</div></td>
                                         <td className="px-6 py-4">{item.expirationDate}</td>
                                         <td className="px-6 py-4">ZMW {item.costPerUnit.toFixed(2)}</td>
                                         <td className="px-6 py-4 text-right space-x-2">
                                             <button onClick={() => handleOpenEdit(item)} className="text-indigo-600 hover:text-indigo-900 font-medium">Edit</button>
                                             <button onClick={() => handleDeleteItem(item.id)} className="text-red-600 hover:text-red-900 font-medium">Del</button>
                                         </td>
                                     </tr>
                                 );
                             })}
                         </tbody>
                     </table>
                 )}
             </div>
         </div>
    );

    // ... other render functions remain the same but use the new state-managed 'inventory'
    // The rest of the component (overview, procurement, etc.) will now use the 'inventory' state

    return (
        <div className="space-y-4 md:space-y-6 p-2 md:p-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1.5 sm:p-2">
                <div className="flex overflow-x-auto scrollbar-hide gap-1">
                {(['OVERVIEW', 'METRICS', 'STOCK', 'PROCUREMENT', 'ORDERS', 'PRESCRIPTIONS', 'COUNTING', 'NEWS', 'FORMULARY'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${activeTab === tab
                            ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                            : 'text-gray-500 hover:bg-gray-50'
                            }`}>
                        <span className="text-base sm:text-lg">{/* Replace with actual icons */}</span>
                        <span className="hidden sm:inline">{tab}</span>
                    </button>
                ))}
                </div>
            </div>

            {activeTab === 'STOCK' && renderStockTable()}
            {/* Other tabs would be rendered here */}

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
                                     <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Amoxicillin 500mg" />
                                 </div>
                                 <div>
                                     <label className="block text-sm font-bold text-gray-700 mb-1">ABC Category</label>
                                     <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as any })} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none">
                                         <option value="A">Class A (High Value)</option>
                                         <option value="B">Class B (Moderate)</option>
                                         <option value="C">Class C (Low Value)</option>
                                     </select>
                                 </div>
                                 <div>
                                     <label className="block text-sm font-bold text-gray-700 mb-1">Cost Per Unit (ZMW)</label>
                                     <input type="number" step="0.01" min="0" value={formData.costPerUnit} onChange={(e) => setFormData({ ...formData, costPerUnit: parseFloat(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                 </div>
                                 <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 col-span-2 grid grid-cols-3 gap-4">
                                     <div className="col-span-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Stock Parameters</div>
                                     <div>
                                         <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock</label>
                                         <input placeholder="e.g., 100" required type="number" min="0" value={formData.currentStock || 0} onChange={(e) => setFormData({ ...formData, currentStock: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                     </div>
                                     <div>
                                         <label className="block text-sm font-medium text-gray-700 mb-1">Min Level</label>
                                         <input required type="number" min="0" value={formData.minLevel || 0} onChange={(e) => setFormData({ ...formData, minLevel: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                     </div>
                                     <div>
                                         <label className="block text-sm font-medium text-gray-700 mb-1">Max Level</label>
                                         <input required type="number" min="0" value={formData.maxLevel || 0} onChange={(e) => setFormData({ ...formData, maxLevel: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                     </div>
                                     <div>
                                         <label className="block text-sm font-medium text-gray-700 mb-1">Lead Time (days)</label>
                                         <input type="number" min="0" value={formData.leadTime || 0} onChange={(e) => setFormData({ ...formData, leadTime: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                     </div>
                                 </div>
                                 <div>
                                     <label className="block text-sm font-bold text-gray-700 mb-1">Expiration Date</label>
                                     <input required type="date" value={formData.expirationDate} onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none" />
                                 </div>
                             </div>
                             <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                                 <button type="button" onClick={() => setIsInventoryModalOpen(false)} className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                                 <button type="submit" className="px-6 py-2.5 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 font-medium shadow-md">{editingItem ? 'Save Changes' : 'Create Item'}</button>
                             </div>
                         </form>
                     </div>
                 </div>
            )}
        </div>
    );
};

export default PharmacistDashboard;

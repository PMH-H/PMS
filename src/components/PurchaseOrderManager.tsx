import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { generateUUID } from '../utils/uuid';

interface PurchaseOrder {
    id: string;
    po_number: string;
    supplier_id: string;
    facility_id: string;
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
    order_date: string;
    expected_delivery_date?: string;
    actual_delivery_date?: string;
    total_amount?: number;
    notes?: string;
    created_by?: string;
    approved_by?: string;
    created_at: string;
}

interface POItem {
    id: string;
    po_id: string;
    item_id: string;
    quantity_ordered: number;
    quantity_received: number;
    unit_price: number;
}

interface Supplier {
    id: string;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    lead_time_days: number;
}

interface PurchaseOrderManagerProps {
    currentUser: User;
    facilityId: string;
}

const PurchaseOrderManager: React.FC<PurchaseOrderManagerProps> = ({ currentUser, facilityId }) => {
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'DRAFT' | 'SUBMITTED' | 'APPROVED'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

    // Create PO form
    const [formData, setFormData] = useState({
        supplier_id: '',
        expected_delivery_date: '',
        notes: ''
    });
    const [poItems, setPOItems] = useState<Array<{ item_id: string; quantity: number; unit_price: number }>>([]);

    useEffect(() => {
        fetchData();
    }, [facilityId, filter]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch purchase orders
            let poQuery = supabase
                .from('purchase_orders')
                .select('*, suppliers(name), profiles!purchase_orders_created_by_fkey(full_name)')
                .eq('facility_id', facilityId)
                .order('created_at', { ascending: false });

            if (filter !== 'all') {
                poQuery = poQuery.eq('status', filter);
            }

            const { data: poData, error: poError } = await poQuery;
            if (poError) throw poError;
            setOrders(poData || []);

            // Fetch suppliers
            const { data: suppliersData, error: suppliersError } = await supabase
                .from('suppliers')
                .select('*')
                .eq('is_active', true)
                .order('name');
            if (suppliersError) throw suppliersError;
            setSuppliers(suppliersData || []);

            // Fetch items
            const { data: itemsData, error: itemsError } = await supabase
                .from('items')
                .select('*')
                .order('name');
            if (itemsError) throw itemsError;
            setItems(itemsData || []);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const generatePONumber = () => {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `PO-${year}${month}-${random}`;
    };

    const handleCreatePO = async (e: React.FormEvent) => {
        e.preventDefault();

        if (poItems.length === 0) {
            alert('Please add at least one item');
            return;
        }

        try {
            const totalAmount = poItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

            // Create PO
            const { data: newPO, error: poError } = await supabase
                .from('purchase_orders')
                .insert([{
                    po_number: generatePONumber(),
                    supplier_id: formData.supplier_id,
                    facility_id: facilityId,
                    status: 'DRAFT',
                    order_date: new Date().toISOString().split('T')[0],
                    expected_delivery_date: formData.expected_delivery_date || null,
                    total_amount: totalAmount,
                    notes: formData.notes,
                    created_by: currentUser.id
                }])
                .select()
                .single();

            if (poError) throw poError;

            // Create PO items
            const itemsToInsert = poItems.map(item => ({
                po_id: newPO.id,
                item_id: item.item_id,
                quantity_ordered: item.quantity,
                quantity_received: 0,
                unit_price: item.unit_price
            }));

            const { error: itemsError } = await supabase
                .from('purchase_order_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;

            setShowCreateModal(false);
            resetForm();
            fetchData();
        } catch (error) {
            console.error('Error creating PO:', error);
            alert('Failed to create purchase order');
        }
    };

    const updatePOStatus = async (poId: string, newStatus: PurchaseOrder['status']) => {
        try {
            const updateData: any = { status: newStatus };

            if (newStatus === 'APPROVED') {
                updateData.approved_by = currentUser.id;
            }

            const { error } = await supabase
                .from('purchase_orders')
                .update(updateData)
                .eq('id', poId);

            if (error) throw error;
            fetchData();
        } catch (error) {
            console.error('Error updating PO:', error);
        }
    };

    const resetForm = () => {
        setFormData({ supplier_id: '', expected_delivery_date: '', notes: '' });
        setPOItems([]);
    };

    const addPOItem = () => {
        setPOItems([...poItems, { item_id: '', quantity: 1, unit_price: 0 }]);
    };

    const updatePOItem = (index: number, field: string, value: any) => {
        const updated = [...poItems];
        updated[index] = { ...updated[index], [field]: value };
        setPOItems(updated);
    };

    const removePOItem = (index: number) => {
        setPOItems(poItems.filter((_, i) => i !== index));
    };

    const getStatusColor = (status: string) => {
        const colors = {
            DRAFT: 'bg-gray-100 text-gray-800',
            SUBMITTED: 'bg-blue-100 text-blue-800',
            APPROVED: 'bg-green-100 text-green-800',
            ORDERED: 'bg-purple-100 text-purple-800',
            PARTIALLY_RECEIVED: 'bg-yellow-100 text-yellow-800',
            RECEIVED: 'bg-emerald-100 text-emerald-800',
            CANCELLED: 'bg-red-100 text-red-800'
        };
        return colors[status as keyof typeof colors] || colors.DRAFT;
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
                    <h2 className="text-2xl font-bold text-gray-900">Requisitions</h2>
                    <p className="text-sm text-gray-500">Manage procurement and stock requisitions</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Requisition
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex gap-2">
                    {(['all', 'DRAFT', 'SUBMITTED', 'APPROVED'] as const).map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === status
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {status === 'all' ? 'ALL' : status}
                        </button>
                    ))}
                </div>
            </div>

            {/* PO List */}
            <div className="grid grid-cols-1 gap-4">
                {orders.map(po => (
                    <div key={po.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">{po.po_number}</h3>
                                <p className="text-sm text-gray-500">
                                    Supplier: {(po as any).suppliers?.name}
                                </p>
                                <p className="text-xs text-gray-400">
                                    Created: {new Date(po.created_at).toLocaleDateString()} by{' '}
                                    {(po as any).profiles?.full_name}
                                </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(po.status)}`}>
                                {po.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                            <div>
                                <span className="text-gray-500">Date:</span>
                                <p className="font-medium">{new Date(po.order_date).toLocaleDateString()}</p>
                            </div>
                            {po.expected_delivery_date && (
                                <div>
                                    <span className="text-gray-500">Expected:</span>
                                    <p className="font-medium">{new Date(po.expected_delivery_date).toLocaleDateString()}</p>
                                </div>
                            )}
                            <div>
                                <span className="text-gray-500">Total:</span>
                                <p className="font-bold text-lg">ZMW {po.total_amount?.toFixed(2)}</p>
                            </div>
                        </div>

                        {po.notes && (
                            <p className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-lg">
                                <span className="font-bold">Notes:</span> {po.notes}
                            </p>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                            {po.status === 'DRAFT' && (
                                <button
                                    onClick={() => updatePOStatus(po.id, 'SUBMITTED')}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700"
                                >
                                    Submit
                                </button>
                            )}
                            {po.status === 'SUBMITTED' && currentUser.role === 'admin' && (
                                <>
                                    <button
                                        onClick={() => updatePOStatus(po.id, 'APPROVED')}
                                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => updatePOStatus(po.id, 'CANCELLED')}
                                        className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700"
                                    >
                                        Reject
                                    </button>
                                </>
                            )}
                            {po.status === 'APPROVED' && (
                                <button
                                    onClick={() => updatePOStatus(po.id, 'ORDERED')}
                                    className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-700"
                                >
                                    Mark as Ordered
                                </button>
                            )}
                            {(po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED') && (
                                <button
                                    onClick={() => {
                                        setSelectedPO(po);
                                        setShowReceiveModal(true);
                                    }}
                                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700"
                                >
                                    Receive Stock
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {orders.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                    <p className="text-gray-500 mb-4">No requisitions found</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="text-indigo-600 font-bold hover:text-indigo-700"
                    >
                        Create your first requisition
                    </button>
                </div>
            )}

            {/* Create PO Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
                    <div className="bg-white rounded-2xl max-w-4xl w-full p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h3 className="text-2xl font-bold text-gray-900 mb-6">New Requisition</h3>

                        <form onSubmit={handleCreatePO} className="space-y-6">
                            {/* Supplier & Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Supplier *</label>
                                    <select
                                        required
                                        value={formData.supplier_id}
                                        onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="">Select supplier...</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} (Lead time: {s.lead_time_days} days)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Expected Delivery</label>
                                    <input
                                        type="date"
                                        value={formData.expected_delivery_date}
                                        onChange={e => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-sm font-bold text-gray-700">Items</label>
                                    <button type="button" onClick={addPOItem} className="text-indigo-600 text-sm font-bold hover:text-indigo-700">
                                        + Add Item
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {poItems.map((item, index) => (
                                        <div key={index} className="grid grid-cols-12 gap-2 p-3 bg-gray-50 rounded-lg">
                                            <select
                                                required
                                                value={item.item_id}
                                                onChange={e => updatePOItem(index, 'item_id', e.target.value)}
                                                className="col-span-5 p-2 border rounded-lg text-sm"
                                            >
                                                <option value="">Select item...</option>
                                                {items.map(i => (
                                                    <option key={i.id} value={i.id}>{i.name}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                placeholder="Qty"
                                                value={item.quantity}
                                                onChange={e => updatePOItem(index, 'quantity', parseInt(e.target.value))}
                                                className="col-span-3 p-2 border rounded-lg text-sm"
                                            />
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                step="0.01"
                                                placeholder="Price"
                                                value={item.unit_price}
                                                onChange={e => updatePOItem(index, 'unit_price', parseFloat(e.target.value))}
                                                className="col-span-3 p-2 border rounded-lg text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removePOItem(index)}
                                                className="col-span-1 text-red-600 hover:text-red-700"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Notes</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    rows={3}
                                />
                            </div>

                            {/* Total */}
                            <div className="bg-indigo-50 p-4 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold text-gray-700">Total Amount:</span>
                                    <span className="text-2xl font-bold text-indigo-700">
                                        ZMW {poItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        resetForm();
                                    }}
                                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">
                                    Create Purchase Order
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseOrderManager;

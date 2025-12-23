import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { createAuditLog, getRiders, createDelivery } from '../services/database';
import { toast } from 'sonner';
import { Rider } from '../types';

interface StoreOrder {
    id: string;
    customer_id: string;
    facility_id: string;
    items: { item_id: string; name: string; quantity: number; unit_price: number }[];
    total_price_cents: number;
    status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'PICKED_UP' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
    delivery_type: 'PICKUP' | 'DELIVERY';
    delivery_address?: string;
    delivery_notes?: string;
    notes?: string;
    created_at: string;
    updated_at?: string;
    profiles?: { full_name: string; phone?: string };
}

interface OrderManagementProps {
    currentUser: User;
    facilityId?: string;
}

type FilterStatus = 'all' | StoreOrder['status'];

const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
        'PENDING': 'bg-amber-100 text-amber-800 border-amber-200',
        'CONFIRMED': 'bg-blue-100 text-blue-800 border-blue-200',
        'PREPARING': 'bg-indigo-100 text-indigo-800 border-indigo-200',
        'READY': 'bg-emerald-100 text-emerald-800 border-emerald-200',
        'PICKED_UP': 'bg-purple-100 text-purple-800 border-purple-200',
        'DELIVERED': 'bg-green-100 text-green-800 border-green-200',
        'COMPLETED': 'bg-gray-100 text-gray-800 border-gray-200',
        'CANCELLED': 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-600 border-gray-200';
};

const OrderManagement: React.FC<OrderManagementProps> = ({ currentUser, facilityId }) => {
    const [orders, setOrders] = useState<StoreOrder[]>([]);
    const [filter, setFilter] = useState<FilterStatus>('all');
    const [loading, setLoading] = useState(true);
    const [showRiderModal, setShowRiderModal] = useState(false);
    const [riders, setRiders] = useState<Rider[]>([]);
    const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);

    const fetchOrders = useCallback(async () => {
        if (!facilityId) return;

        try {
            let query = supabase
                .from('store_orders')
                .select(`
                    *,
                    profiles:customer_id(full_name, phone)
                `)
                .eq('facility_id', facilityId)
                .order('created_at', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;
            setOrders(data || []);
        } catch (err: any) {
            console.error('Error fetching orders:', err);
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    }, [facilityId]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    useEffect(() => {
        if (showRiderModal && facilityId) {
            getRiders(facilityId).then(setRiders).catch(console.error);
        }
    }, [showRiderModal, facilityId]);

    const updateOrderStatus = async (orderId: string, newStatus: StoreOrder['status']) => {
        try {
            const { error } = await supabase
                .from('store_orders')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', orderId);

            if (error) throw error;

            // Update local state immediately
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

            await createAuditLog({
                action: `Order Status Updated to ${newStatus}`,
                userId: currentUser.id,
                details: `Order ${orderId} status changed to ${newStatus}`
            });

            toast.success(`Order ${newStatus.toLowerCase().replace('_', ' ')}`);
        } catch (err: any) {
            console.error('Error updating order:', err);
            toast.error('Failed to update order: ' + err.message);
        }
    };

    const openAssignModal = (orderId: string) => {
        setAssigningOrderId(orderId);
        setShowRiderModal(true);
    };

    const handleAssignRider = async (riderId: string) => {
        if (!assigningOrderId) return;
        try {
            await createDelivery({
                order_id: assigningOrderId,
                rider_id: riderId,
                status: 'assigned',
                assigned_at: new Date().toISOString()
            });

            await updateOrderStatus(assigningOrderId, 'READY');

            await createAuditLog({
                action: 'Order Assigned to Rider',
                userId: currentUser.id,
                details: `Order ${assigningOrderId} assigned to Rider ${riderId}`
            });

            toast.success('Rider assigned successfully!');
            setShowRiderModal(false);
        } catch (err: any) {
            console.error(err);
            toast.error('Failed to assign rider: ' + err.message);
        }
    };

    const filteredOrders = filter === 'all'
        ? orders
        : orders.filter(o => o.status === filter);

    const RiderModal = () => (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-900">Assign Rider</h3>
                    <button onClick={() => setShowRiderModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                    {riders.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">No riders found for this facility.</p>
                    ) : (
                        riders.map(rider => (
                            <button
                                key={rider.id}
                                onClick={() => handleAssignRider(rider.id)}
                                className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
                            >
                                <div className="text-left">
                                    <div className="font-bold text-gray-900">{rider.full_name}</div>
                                    <div className="text-xs text-gray-500">{rider.vehicle_type} • {rider.status || 'Active'}</div>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 md:opacity-0 text-indigo-600 font-bold text-sm">Select</div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {showRiderModal && <RiderModal />}

            {/* Header with Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Store Orders</h2>
                        <p className="text-sm text-gray-500">Manage customer orders from the shop</p>
                    </div>
                    <button
                        onClick={fetchOrders}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                    >
                        🔄 Refresh
                    </button>
                </div>

                <div className="flex gap-2 overflow-x-auto w-full pb-2 hide-scrollbar">
                    {(['all', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'] as const).map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap flex-shrink-0 ${filter === status
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {status === 'all' ? 'All' : status}
                            {status !== 'all' && (
                                <span className="ml-1 text-xs opacity-75">
                                    ({orders.filter(o => o.status === status).length})
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Orders Grid */}
            {filteredOrders.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                    <div className="text-4xl mb-4">📦</div>
                    <p className="text-gray-500 font-medium">No orders found</p>
                    <p className="text-sm text-gray-400">Orders from the shop will appear here</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredOrders.map(order => (
                        <div
                            key={order.id}
                            className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                        >
                            {/* Order Header */}
                            <div className="flex justify-between items-start mb-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
                                    {order.status.replace('_', ' ')}
                                </span>
                                <div className="text-right">
                                    <span className="text-xs text-gray-400 block">
                                        {new Date(order.created_at).toLocaleDateString()}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>

                            {/* Customer Info */}
                            <div className="mb-3">
                                <p className="font-bold text-gray-900">
                                    {order.profiles?.full_name || 'Unknown Customer'}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {order.profiles?.phone || 'No phone'}
                                </p>
                            </div>

                            {/* Items */}
                            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                                <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Items ({order.items?.length || 0})</p>
                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                    {(order.items || []).map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                            <span className="text-gray-700 truncate flex-1">{item.name}</span>
                                            <span className="text-gray-500 ml-2">×{item.quantity}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Total */}
                            <div className="flex justify-between items-center mb-3 py-2 border-t border-gray-100">
                                <span className="text-sm font-medium text-gray-500">Total</span>
                                <span className="text-lg font-bold text-gray-900">
                                    ZMW {((order.total_price_cents || 0)).toFixed(2)}
                                </span>
                            </div>

                            {/* Delivery Info */}
                            {order.delivery_type === 'DELIVERY' && order.delivery_address && (
                                <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                                    <p className="text-xs font-bold text-blue-600 mb-1">🚚 DELIVERY TO:</p>
                                    <p className="text-sm text-blue-800">{order.delivery_address}</p>
                                    {order.delivery_notes && (
                                        <p className="text-xs text-blue-600 mt-1 italic">Note: {order.delivery_notes}</p>
                                    )}
                                </div>
                            )}

                            {order.delivery_type === 'PICKUP' && (
                                <div className="mb-3 p-2 bg-green-50 rounded-lg text-center">
                                    <span className="text-sm font-medium text-green-700">🏪 Store Pickup</span>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-2 flex-wrap">
                                {order.status === 'PENDING' && (
                                    <button
                                        onClick={() => updateOrderStatus(order.id, 'CONFIRMED')}
                                        className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-blue-700"
                                    >
                                        ✓ Confirm
                                    </button>
                                )}
                                {order.status === 'CONFIRMED' && (
                                    <button
                                        onClick={() => updateOrderStatus(order.id, 'PREPARING')}
                                        className="flex-1 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700"
                                    >
                                        🔧 Start Preparing
                                    </button>
                                )}
                                {order.status === 'PREPARING' && (
                                    <>
                                        <button
                                            onClick={() => updateOrderStatus(order.id, 'READY')}
                                            className="flex-1 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700"
                                        >
                                            ✓ Ready
                                        </button>
                                        {order.delivery_type === 'DELIVERY' && (
                                            <button
                                                onClick={() => openAssignModal(order.id)}
                                                className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-gray-700"
                                            >
                                                🛵 Dispatch
                                            </button>
                                        )}
                                    </>
                                )}
                                {order.status === 'READY' && (
                                    <>
                                        {order.delivery_type === 'PICKUP' ? (
                                            <button
                                                onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
                                                className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-green-700"
                                            >
                                                ✓ Customer Picked Up
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => openAssignModal(order.id)}
                                                    className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-gray-700"
                                                >
                                                    🛵 Assign Rider
                                                </button>
                                                <button
                                                    onClick={() => updateOrderStatus(order.id, 'PICKED_UP')}
                                                    className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-purple-700"
                                                >
                                                    📦 Out for Delivery
                                                </button>
                                            </>
                                        )}
                                    </>
                                )}
                                {order.status === 'PICKED_UP' && (
                                    <button
                                        onClick={() => updateOrderStatus(order.id, 'DELIVERED')}
                                        className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-green-700"
                                    >
                                        ✓ Mark Delivered
                                    </button>
                                )}
                                {(order.status === 'PENDING' || order.status === 'CONFIRMED') && (
                                    <button
                                        onClick={() => {
                                            if (window.confirm('Cancel this order?')) {
                                                updateOrderStatus(order.id, 'CANCELLED');
                                            }
                                        }}
                                        className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OrderManagement;

import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { createAuditLog } from '../services/database';
import { useNotifications } from '../hooks/useNotifications';

interface CustomerOrder {
    id: string;
    patient_id: string;
    prescription_id?: string;
    sale_id?: string;
    facility_id: string;
    status: 'pending' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'cancelled';
    delivery_address?: string;
    delivery_notes?: string;
    expected_delivery_date?: string;
    actual_delivery_date?: string;
    assigned_to?: string;
    created_at: string;
    updated_at: string;
}

interface OrderManagementProps {
    currentUser: User;
    facilityId?: string;
}

const OrderManagement: React.FC<OrderManagementProps> = ({ currentUser, facilityId }) => {
    const [orders, setOrders] = useState<CustomerOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'preparing' | 'ready'>('all');
    const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
    const { success, error, info } = useNotifications();

    useEffect(() => {
        fetchOrders();

        const channel = supabase
            .channel('customer_orders_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'customer_orders',
                    filter: facilityId ? `facility_id=eq.${facilityId}` : undefined
                },
                (payload) => {
                    if(payload.eventType === 'INSERT') {
                        info('A new order has been placed.');
                    }
                    fetchOrders();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [facilityId, filter]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('customer_orders')
                .select('*, profiles!customer_orders_patient_id_fkey(full_name, phone)')
                .order('created_at', { ascending: false });

            if (facilityId) {
                query = query.eq('facility_id', facilityId);
            }

            if (filter !== 'all') {
                query = query.eq('status', filter);
            }

            const { data, error } = await query;
            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateOrderStatus = async (orderId: string, newStatus: CustomerOrder['status']) => {
        try {
            const { error } = await supabase
                .from('customer_orders')
                .update({
                    status: newStatus,
                    ...(newStatus === 'delivered' && { actual_delivery_date: new Date().toISOString() })
                })
                .eq('id', orderId);

            if (error) throw error;
            await createAuditLog({
              action: `Order status changed to ${newStatus}`,
              userId: currentUser.id,
              details: `Order ID: ${orderId}`
            });
            success(`Order status updated to ${newStatus}`);
            fetchOrders();
        } catch (err) {
            console.error('Error updating order:', err);
            error('Failed to update order status');
        }
    };

    const assignOrder = async (orderId: string) => {
        try {
            const { error } = await supabase
                .from('customer_orders')
                .update({ assigned_to: currentUser.id })
                .eq('id', orderId);

            if (error) throw error;
            await createAuditLog({
              action: `Order assigned`,
              userId: currentUser.id,
              details: `Order ID: ${orderId}`
            });
            info('Order assigned to you');
            fetchOrders();
        } catch (err) {
            console.error('Error assigning order:', err);
            error('Failed to assign order');
        }
    };

    const getStatusColor = (status: string) => {
        const colors = {
            pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            preparing: 'bg-blue-100 text-blue-800 border-blue-300',
            ready: 'bg-green-100 text-green-800 border-green-300',
            picked_up: 'bg-purple-100 text-purple-800 border-purple-300',
            delivered: 'bg-gray-100 text-gray-800 border-gray-300',
            cancelled: 'bg-red-100 text-red-800 border-red-300'
        };
        return colors[status as keyof typeof colors] || colors.pending;
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
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Order Management</h2>
                    <div className="flex gap-2">
                        {(['all', 'pending', 'preparing', 'ready'] as const).map(status => (
                            <button
                                key={status}
                                onClick={() => setFilter(status)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === status
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {status.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="text-sm text-gray-500">
                    Showing {orders.length} order{orders.length !== 1 ? 's' : ''}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders.map(order => (
                    <div
                        key={order.id}
                        className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
                                {order.status.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-400">
                                {new Date(order.created_at).toLocaleDateString()}
                            </span>
                        </div>

                        <div className="mb-4">
                            <p className="font-bold text-gray-900">
                                {(order as any).profiles?.full_name || 'Unknown Patient'}
                            </p>
                            <p className="text-sm text-gray-500">
                                {(order as any).profiles?.phone || 'No phone'}
                            </p>
                        </div>

                        {order.delivery_address && (
                            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                                <p className="text-xs font-bold text-gray-500 mb-1">DELIVERY TO:</p>
                                <p className="text-sm text-gray-700">{order.delivery_address}</p>
                                {order.delivery_notes && (
                                    <p className="text-xs text-gray-500 mt-1">Note: {order.delivery_notes}</p>
                                )}
                            </div>
                        )}

                        {order.expected_delivery_date && (
                            <div className="mb-4 text-sm">
                                <span className="text-gray-500">Expected: </span>
                                <span className="font-medium text-gray-700">
                                    {new Date(order.expected_delivery_date).toLocaleDateString()}
                                </span>
                            </div>
                        )}

                        <div className="flex gap-2">
                            {order.status === 'pending' && (
                                <>
                                    <button
                                        onClick={() => updateOrderStatus(order.id, 'preparing')}
                                        className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-blue-700"
                                    >
                                        Start Preparing
                                    </button>
                                    {!order.assigned_to && (
                                        <button
                                            onClick={() => assignOrder(order.id)}
                                            className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-300"
                                        >
                                            Assign to Me
                                        </button>
                                    )}
                                </>
                            )}
                            {order.status === 'preparing' && (
                                <button
                                    onClick={() => updateOrderStatus(order.id, 'ready')}
                                    className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-green-700"
                                >
                                    Mark Ready
                                </button>
                            )}
                            {order.status === 'ready' && (
                                <button
                                    onClick={() => updateOrderStatus(order.id, 'picked_up')}
                                    className="flex-1 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-purple-700"
                                >
                                    Mark Picked Up
                                </button>
                            )}
                            {order.status === 'picked_up' && (
                                <button
                                    onClick={() => updateOrderStatus(order.id, 'delivered')}
                                    className="flex-1 bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-gray-700"
                                >
                                    Mark Delivered
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {orders.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                    <p className="text-gray-500">No orders found for this filter</p>
                </div>
            )}
        </div>
    );
};

export default OrderManagement;

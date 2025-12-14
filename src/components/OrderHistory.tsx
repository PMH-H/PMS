import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';

interface CustomerOrder {
    id: string;
    prescription_id?: string;
    sale_id?: string;
    status: string;
    delivery_address?: string;
    delivery_notes?: string;
    expected_delivery_date?: string;
    actual_delivery_date?: string;
    created_at: string;
    updated_at: string;
}

interface OrderHistoryProps {
    currentUser: User;
}

const OrderHistory: React.FC<OrderHistoryProps> = ({ currentUser }) => {
    const [orders, setOrders] = useState<CustomerOrder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
    }, [currentUser.id]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('customer_orders')
                .select('*, prescriptions(medications, created_at), sales(total_price, items)')
                .eq('patient_id', currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching order history:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        const icons = {
            pending: '⏳',
            preparing: '📦',
            ready: '✅',
            picked_up: '🚗',
            delivered: '🎉',
            cancelled: '❌'
        };
        return icons[status as keyof typeof icons] || '📋';
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
            <div>
                <h2 className="text-2xl font-bold text-gray-900">My Order History</h2>
                <p className="text-sm text-gray-500">Track your prescriptions and deliveries</p>
            </div>

            {/* Timeline */}
            <div className="space-y-4">
                {orders.map((order, index) => (
                    <div key={order.id} className="relative">
                        {/* Timeline connector */}
                        {index !== orders.length - 1 && (
                            <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-gray-200"></div>
                        )}

                        <div className="flex gap-4">
                            {/* Timeline dot */}
                            <div className="relative flex-shrink-0">
                                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-2xl">
                                    {getStatusIcon(order.status)}
                                </div>
                            </div>

                            {/* Order card */}
                            <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-gray-900">
                                            Order #{order.id.slice(0, 8)}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {new Date(order.created_at).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                                        {order.status.toUpperCase()}
                                    </span>
                                </div>

                                {/* Order details */}
                                {order.delivery_address && (
                                    <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                                        <p className="text-xs font-bold text-gray-500">DELIVERY ADDRESS:</p>
                                        <p className="text-sm text-gray-700">{order.delivery_address}</p>
                                    </div>
                                )}

                                {/* Prescription info */}
                                {(order as any).prescriptions && (
                                    <div className="mb-3">
                                        <p className="text-xs font-bold text-gray-500 mb-1">MEDICATIONS:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {JSON.parse((order as any).prescriptions.medications || '[]').map((med: any, i: number) => (
                                                <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg">
                                                    {med.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Delivery dates */}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    {order.expected_delivery_date && (
                                        <div>
                                            <span className="text-gray-500">Expected:</span>
                                            <p className="font-medium">{new Date(order.expected_delivery_date).toLocaleDateString()}</p>
                                        </div>
                                    )}
                                    {order.actual_delivery_date && (
                                        <div>
                                            <span className="text-gray-500">Delivered:</span>
                                            <p className="font-medium text-green-600">{new Date(order.actual_delivery_date).toLocaleDateString()}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Sale info */}
                                {(order as any).sales && (
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-500">Total Amount:</span>
                                            <span className="text-lg font-bold text-gray-900">
                                                ZMW {(order as any).sales.total_price.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {orders.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                    <p className="text-gray-500">No orders yet</p>
                    <p className="text-sm text-gray-400 mt-2">Your order history will appear here</p>
                </div>
            )}
        </div>
    );
};

export default OrderHistory;

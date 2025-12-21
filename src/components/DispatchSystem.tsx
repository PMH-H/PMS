import React, { useState, useEffect } from 'react';
import { Delivery, Rider, DeliveryStatus } from '../types';
import { getDeliveries, getRiders, assignDeliveryToRider, updateDelivery } from '../services/database';

interface DispatchSystemProps {
    facilityId?: string;
}

const DispatchSystem: React.FC<DispatchSystemProps> = ({ facilityId = 'default' }) => {
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [riders, setRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
    const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
    const [filterStatus, setFilterStatus] = useState<DeliveryStatus | 'ALL'>('ALL');

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [facilityId, filterStatus]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [deliveryData, riderData] = await Promise.all([
                getDeliveries(facilityId, filterStatus !== 'ALL' ? filterStatus : undefined),
                getRiders(facilityId)
            ]);
            setDeliveries(deliveryData);
            setRiders(riderData);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAssignDelivery = async (delivery: Delivery, rider: Rider) => {
        try {
            setLoading(true);
            await assignDeliveryToRider(delivery.id, rider.id);
            setSelectedDelivery(null);
            setSelectedRider(null);
            await fetchData();
            alert(`Delivery assigned to ${rider.full_name}`);
        } catch (error) {
            console.error('Error assigning delivery:', error);
            alert('Failed to assign delivery');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateDeliveryStatus = async (delivery: Delivery, newStatus: DeliveryStatus) => {
        try {
            setLoading(true);
            await updateDelivery(delivery.id, {
                status: newStatus,
                updated_at: new Date().toISOString(),
                ...(newStatus === 'PICKED_UP' && { picked_up_at: new Date().toISOString() }),
                ...(newStatus === 'DELIVERED' && { delivered_at: new Date().toISOString() })
            });
            await fetchData();
        } catch (error) {
            console.error('Error updating delivery:', error);
            alert('Failed to update delivery status');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: DeliveryStatus) => {
        const colors: Record<DeliveryStatus, string> = {
            PENDING: 'bg-gray-100 text-gray-700',
            ASSIGNED: 'bg-blue-100 text-blue-700',
            PICKED_UP: 'bg-purple-100 text-purple-700',
            IN_TRANSIT: 'bg-orange-100 text-orange-700',
            DELIVERED: 'bg-green-100 text-green-700',
            FAILED: 'bg-red-100 text-red-700',
            CANCELLED: 'bg-gray-100 text-gray-700'
        };
        return colors[status];
    };

    const unassignedDeliveries = deliveries.filter(d => !d.rider_id && d.status === 'PENDING');
    const assignedDeliveries = deliveries.filter(d => d.rider_id && d.status !== 'DELIVERED');
    const completedDeliveries = deliveries.filter(d => d.status === 'DELIVERED');

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Dispatch System</h2>
                    <p className="text-sm text-gray-600 mt-1">Assign and track deliveries</p>
                </div>
                <div className="flex gap-2">
                    {Object.values(DeliveryStatus).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status as DeliveryStatus)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                filterStatus === status
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                    <button
                        onClick={() => setFilterStatus('ALL')}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            filterStatus === 'ALL'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        All
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-600">Unassigned Orders</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{unassignedDeliveries.length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-600">In Progress</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{assignedDeliveries.length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-600">Completed Today</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{completedDeliveries.length}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Unassigned Deliveries */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                        <h3 className="font-bold text-slate-900">
                            Unassigned Orders ({unassignedDeliveries.length})
                        </h3>
                    </div>
                    <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                        {unassignedDeliveries.length === 0 ? (
                            <div className="px-6 py-4 text-center text-gray-500 text-sm">
                                No unassigned orders
                            </div>
                        ) : (
                            unassignedDeliveries.map((delivery) => (
                                <div
                                    key={delivery.id}
                                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                                        selectedDelivery?.id === delivery.id ? 'bg-indigo-50' : ''
                                    }`}
                                    onClick={() => setSelectedDelivery(delivery)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="font-medium text-slate-900">{delivery.customer_name}</p>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(delivery.status)}`}>
                                            {delivery.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600">{delivery.customer_phone}</p>
                                    <p className="text-sm text-gray-600">{delivery.delivery_address}</p>
                                    {delivery.distance_km && (
                                        <p className="text-xs text-gray-500 mt-1">📍 {delivery.distance_km.toFixed(1)} km away</p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Rider Selection for Assignment */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                        <h3 className="font-bold text-slate-900">
                            Available Riders
                        </h3>
                    </div>
                    <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                        {riders.filter(r => r.status === 'ACTIVE' || r.status === 'ON_BREAK').length === 0 ? (
                            <div className="px-6 py-4 text-center text-gray-500 text-sm">
                                No available riders
                            </div>
                        ) : (
                            riders
                                .filter(r => r.status === 'ACTIVE' || r.status === 'ON_BREAK')
                                .map((rider) => (
                                    <div
                                        key={rider.id}
                                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                                            selectedRider?.id === rider.id ? 'bg-indigo-50' : ''
                                        }`}
                                        onClick={() => setSelectedRider(rider)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="font-medium text-slate-900">{rider.full_name}</p>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                rider.status === 'ACTIVE'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                {rider.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600">{rider.vehicle_type}</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Active: {rider.active_deliveries} | Completed: {rider.completed_deliveries} | Rating: ★{rider.rating.toFixed(1)}
                                        </p>
                                    </div>
                                ))
                        )}
                    </div>
                    
                    {selectedDelivery && selectedRider && (
                        <div className="border-t border-gray-200 bg-indigo-50 p-4">
                            <button
                                onClick={() => handleAssignDelivery(selectedDelivery, selectedRider)}
                                disabled={loading}
                                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
                            >
                                {loading ? 'Assigning...' : 'Assign Order'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* In-Progress Deliveries */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                    <h3 className="font-bold text-slate-900">In Progress Deliveries ({assignedDeliveries.length})</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Order</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Customer</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Rider</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Distance</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {assignedDeliveries.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500 text-sm">
                                        No deliveries in progress
                                    </td>
                                </tr>
                            ) : (
                                assignedDeliveries.map((delivery) => (
                                    <tr key={delivery.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                            #{delivery.id.substring(0, 8)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            <div>{delivery.customer_name}</div>
                                            <div className="text-xs text-gray-500">{delivery.customer_phone}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {riders.find(r => r.id === delivery.rider_id)?.full_name || 'Unassigned'}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(delivery.status)}`}>
                                                {delivery.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {delivery.distance_km ? `${delivery.distance_km.toFixed(1)} km` : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <select
                                                value={delivery.status}
                                                onChange={(e) => handleUpdateDeliveryStatus(delivery, e.target.value as DeliveryStatus)}
                                                disabled={loading}
                                                className="px-2 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50"
                                            >
                                                {delivery.status === 'ASSIGNED' && <option value="PICKED_UP">Mark Picked Up</option>}
                                                {delivery.status === 'PICKED_UP' && <option value="IN_TRANSIT">Mark In Transit</option>}
                                                {delivery.status === 'IN_TRANSIT' && <option value="DELIVERED">Mark Delivered</option>}
                                                {(delivery.status === 'ASSIGNED' || delivery.status === 'PICKED_UP' || delivery.status === 'IN_TRANSIT') && (
                                                    <option value="FAILED">Mark Failed</option>
                                                )}
                                                <option value={delivery.status}>No change</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DispatchSystem;

import React, { useState, useEffect } from 'react';
import { Rider, Delivery } from '../types';
import { getRiders, getDeliveries } from '../services/database';

interface MapViewProps {
    facilityId?: string;
}

const MapView: React.FC<MapViewProps> = ({ facilityId = 'default' }) => {
    const [riders, setRiders] = useState<Rider[]>([]);
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
    const [mapType, setMapType] = useState<'riders' | 'deliveries'>('riders');

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000); // Refresh every 15 seconds
        return () => clearInterval(interval);
    }, [facilityId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [riderData, deliveryData] = await Promise.all([
                getRiders(facilityId),
                getDeliveries(facilityId)
            ]);
            setRiders(riderData);
            setDeliveries(deliveryData);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Simulated map rendering - in production, integrate with Google Maps or Leaflet
    const renderMapPlaceholder = () => {
        return (
            <div className="w-full h-96 bg-gradient-to-b from-blue-50 to-blue-100 rounded-lg border-2 border-blue-200 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                        <defs>
                            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="blue" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100" height="100" fill="url(#grid)" />
                    </svg>
                </div>
                <div className="relative z-10 text-center">
                    <svg className="w-16 h-16 text-blue-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 003 16.382V5.618a1 1 0 011.553-.894L9 7m0 13l6.553 3.276A1 1 0 0021 20.382V9.618a1 1 0 00-1.553-.894L15 11m0 0V5m0 0L9.447 1.276A1 1 0 008 2v5m7 13v-5m0 0l6.553-3.276A1 1 0 0023 14.382V5.618a1 1 0 00-1.553-.894L16 8" />
                    </svg>
                    <h3 className="text-xl font-bold text-blue-900 mb-2">Map View</h3>
                    <p className="text-blue-700 mb-4">Integration with Google Maps coming soon</p>
                    <p className="text-sm text-blue-600">Real-time rider tracking • Route optimization • ETA calculation</p>
                </div>
            </div>
        );
    };

    const activeRiders = riders.filter(r => r.status === 'ACTIVE' && r.current_location);
    const inProgressDeliveries = deliveries.filter(d => 
        ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(d.status)
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Rider Tracking & Map</h2>
                    <p className="text-sm text-gray-600 mt-1">Real-time location and delivery tracking</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setMapType('riders')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            mapType === 'riders'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        Riders
                    </button>
                    <button
                        onClick={() => setMapType('deliveries')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            mapType === 'deliveries'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        Deliveries
                    </button>
                </div>
            </div>

            {/* Map Display */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                {renderMapPlaceholder()}
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-600">Active Riders</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{activeRiders.length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-600">In Progress Deliveries</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{inProgressDeliveries.length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-600">Avg Completion Time</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">~45 min</p>
                </div>
            </div>

            {mapType === 'riders' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Active Riders List */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                            <h3 className="font-bold text-slate-900">Active Riders ({activeRiders.length})</h3>
                        </div>
                        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                            {activeRiders.length === 0 ? (
                                <div className="px-6 py-4 text-center text-gray-500 text-sm">
                                    No active riders online
                                </div>
                            ) : (
                                activeRiders.map((rider) => (
                                    <div
                                        key={rider.id}
                                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${
                                            selectedRider?.id === rider.id
                                                ? 'border-indigo-600 bg-indigo-50'
                                                : 'border-green-500'
                                        }`}
                                        onClick={() => setSelectedRider(rider)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="font-medium text-slate-900">{rider.full_name}</p>
                                            <span className="text-green-600 text-2xl">●</span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">{rider.vehicle_type}</p>
                                        {rider.current_location && (
                                            <div className="text-xs text-gray-500 space-y-1">
                                                <p>📍 Lat: {rider.current_location.latitude.toFixed(4)}</p>
                                                <p>📍 Lon: {rider.current_location.longitude.toFixed(4)}</p>
                                                <p>🕐 {new Date(rider.current_location.timestamp).toLocaleTimeString()}</p>
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-500 mt-2">Active: {rider.active_deliveries}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Selected Rider Details */}
                    {selectedRider && (
                        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-indigo-50 border-b border-gray-200 px-6 py-4">
                                <h3 className="font-bold text-slate-900">{selectedRider.full_name} - Details</h3>
                            </div>
                            <div className="p-6 space-y-6">
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-600">Vehicle Type</p>
                                            <p className="font-medium text-slate-900">{selectedRider.vehicle_type}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-600">Phone</p>
                                            <p className="font-medium text-slate-900">{selectedRider.phone_number}</p>
                                        </div>
                                        {selectedRider.license_number && (
                                            <div>
                                                <p className="text-xs text-gray-600">License</p>
                                                <p className="font-medium text-slate-900">{selectedRider.license_number}</p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-xs text-gray-600">Status</p>
                                            <p className="font-medium text-green-600">{selectedRider.status}</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium text-gray-900 mb-3">Performance</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-600">Active</p>
                                            <p className="text-2xl font-bold text-indigo-600">{selectedRider.active_deliveries}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-600">Completed</p>
                                            <p className="text-2xl font-bold text-green-600">{selectedRider.completed_deliveries}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-600">Rating</p>
                                            <p className="text-2xl font-bold text-yellow-600">★ {selectedRider.rating.toFixed(1)}</p>
                                        </div>
                                    </div>
                                </div>

                                {selectedRider.current_location && (
                                    <div>
                                        <h4 className="font-medium text-gray-900 mb-3">Current Location</h4>
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <p className="text-sm"><strong>Latitude:</strong> {selectedRider.current_location.latitude.toFixed(6)}</p>
                                            <p className="text-sm"><strong>Longitude:</strong> {selectedRider.current_location.longitude.toFixed(6)}</p>
                                            <p className="text-sm"><strong>Last Updated:</strong> {new Date(selectedRider.current_location.timestamp).toLocaleString()}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                        <h3 className="font-bold text-slate-900">In-Progress Deliveries ({inProgressDeliveries.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Order ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Customer</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Rider</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Distance</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">ETA</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {inProgressDeliveries.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500 text-sm">
                                            No deliveries in progress
                                        </td>
                                    </tr>
                                ) : (
                                    inProgressDeliveries.map((delivery) => (
                                        <tr key={delivery.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                #{delivery.id.substring(0, 8)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                <div>{delivery.customer_name}</div>
                                                <div className="text-xs text-gray-500">{delivery.delivery_address}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {riders.find(r => r.id === delivery.rider_id)?.full_name || 'Unassigned'}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    delivery.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-700' :
                                                    delivery.status === 'PICKED_UP' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-orange-100 text-orange-700'
                                                }`}>
                                                    {delivery.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {delivery.distance_km ? `${delivery.distance_km.toFixed(1)} km` : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {delivery.estimated_time_minutes ? `~${delivery.estimated_time_minutes} min` : 'N/A'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MapView;

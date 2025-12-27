import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Rider, Delivery } from '../types';
import { getRiders, getDeliveries } from '../services/database';
import { supabase } from '../services/supabase';

// Fix Leaflet default icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom icons
const pharmacyIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const riderIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const customerIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

interface MapViewProps {
    facilityId?: string;
    mode?: 'tracking' | 'store-locator' | 'order-detail';
    orderId?: string;
    pharmacyLocation?: { lat: number; lng: number; name: string };
    customerLocation?: { lat: number; lng: number; address: string };
}

// Component to recenter map
const RecenterMap: React.FC<{ center: [number, number] }> = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
};

const MapView: React.FC<MapViewProps> = ({
    facilityId = 'default',
    mode = 'tracking',
    orderId,
    pharmacyLocation,
    customerLocation
}) => {
    const [riders, setRiders] = useState<Rider[]>([]);
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
    const [mapType, setMapType] = useState<'riders' | 'deliveries'>('riders');
    const [facilities, setFacilities] = useState<any[]>([]);

    // Default center: Lusaka, Zambia
    const defaultCenter: [number, number] = [-15.3875, 28.3228];
    const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter);

    useEffect(() => {
        fetchData();
        fetchFacilities();
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

    const fetchFacilities = async () => {
        try {
            const { data } = await supabase
                .from('facilities')
                .select('id, name, address, latitude, longitude')
                .not('latitude', 'is', null);
            if (data) setFacilities(data);
        } catch (error) {
            console.error('Error fetching facilities:', error);
        }
    };

    const activeRiders = riders.filter(r => r.status === 'ACTIVE' && r.current_location);
    const inProgressDeliveries = deliveries.filter(d =>
        ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(d.status)
    );

    // Order Detail Mode - Simple pharmacy to customer view
    if (mode === 'order-detail' && pharmacyLocation) {
        return (
            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <MapContainer
                    center={[pharmacyLocation.lat, pharmacyLocation.lng]}
                    zoom={14}
                    style={{ height: '300px', width: '100%' }}
                    scrollWheelZoom={false}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[pharmacyLocation.lat, pharmacyLocation.lng]} icon={pharmacyIcon}>
                        <Popup>
                            <div className="font-medium">📍 {pharmacyLocation.name}</div>
                            <div className="text-sm text-gray-600">Pickup Location</div>
                        </Popup>
                    </Marker>
                    {customerLocation && (
                        <>
                            <Marker position={[customerLocation.lat, customerLocation.lng]} icon={customerIcon}>
                                <Popup>
                                    <div className="font-medium">🏠 Delivery Address</div>
                                    <div className="text-sm text-gray-600">{customerLocation.address}</div>
                                </Popup>
                            </Marker>
                            <Polyline
                                positions={[
                                    [pharmacyLocation.lat, pharmacyLocation.lng],
                                    [customerLocation.lat, customerLocation.lng]
                                ]}
                                color="blue"
                                weight={3}
                                dashArray="10, 10"
                            />
                        </>
                    )}
                </MapContainer>
            </div>
        );
    }

    // Store Locator Mode
    if (mode === 'store-locator') {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-900">Find Nearby Pharmacies</h3>
                    <span className="text-sm text-gray-500">{facilities.length} locations</span>
                </div>
                <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                    <MapContainer
                        center={defaultCenter}
                        zoom={12}
                        style={{ height: '400px', width: '100%' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {facilities.map(facility => (
                            facility.latitude && facility.longitude && (
                                <Marker
                                    key={facility.id}
                                    position={[facility.latitude, facility.longitude]}
                                    icon={pharmacyIcon}
                                >
                                    <Popup>
                                        <div className="font-bold text-emerald-700">{facility.name}</div>
                                        <div className="text-sm text-gray-600">{facility.address}</div>
                                        <button className="mt-2 px-3 py-1 bg-emerald-600 text-white text-xs rounded-full">
                                            Get Directions
                                        </button>
                                    </Popup>
                                </Marker>
                            )
                        ))}
                    </MapContainer>
                </div>
            </div>
        );
    }

    // Full Tracking Mode (Admin/Pharmacist)
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
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${mapType === 'riders'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        Riders
                    </button>
                    <button
                        onClick={() => setMapType('deliveries')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${mapType === 'deliveries'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        Deliveries
                    </button>
                </div>
            </div>

            {/* Live Map */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <MapContainer
                    center={mapCenter}
                    zoom={13}
                    style={{ height: '400px', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <RecenterMap center={mapCenter} />

                    {/* Show Facilities */}
                    {facilities.map(facility => (
                        facility.latitude && facility.longitude && (
                            <Marker
                                key={facility.id}
                                position={[facility.latitude, facility.longitude]}
                                icon={pharmacyIcon}
                            >
                                <Popup>
                                    <div className="font-bold text-emerald-700">🏥 {facility.name}</div>
                                    <div className="text-sm text-gray-600">{facility.address}</div>
                                </Popup>
                            </Marker>
                        )
                    ))}

                    {/* Show Active Riders */}
                    {mapType === 'riders' && activeRiders.map(rider => (
                        rider.current_location && (
                            <React.Fragment key={rider.id}>
                                <Marker
                                    position={[rider.current_location.latitude, rider.current_location.longitude]}
                                    icon={riderIcon}
                                    eventHandlers={{
                                        click: () => setSelectedRider(rider)
                                    }}
                                >
                                    <Popup>
                                        <div className="font-bold text-blue-700">🚴 {rider.full_name}</div>
                                        <div className="text-sm text-gray-600">{rider.vehicle_type}</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            Active: {rider.active_deliveries} | Completed: {rider.completed_deliveries}
                                        </div>
                                    </Popup>
                                </Marker>
                                <Circle
                                    center={[rider.current_location.latitude, rider.current_location.longitude]}
                                    radius={100}
                                    pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }}
                                />
                            </React.Fragment>
                        )
                    ))}

                    {/* Show Deliveries */}
                    {mapType === 'deliveries' && inProgressDeliveries.map(delivery => (
                        delivery.pickup_location && delivery.dropoff_location && (
                            <React.Fragment key={delivery.id}>
                                <Marker
                                    position={[delivery.dropoff_location.latitude, delivery.dropoff_location.longitude]}
                                    icon={customerIcon}
                                >
                                    <Popup>
                                        <div className="font-bold">📦 Order #{delivery.id.substring(0, 8)}</div>
                                        <div className="text-sm">{delivery.customer_name}</div>
                                        <div className="text-xs text-gray-600">{delivery.delivery_address}</div>
                                        <div className={`text-xs mt-1 font-medium ${delivery.status === 'IN_TRANSIT' ? 'text-orange-600' : 'text-blue-600'
                                            }`}>
                                            {delivery.status}
                                        </div>
                                    </Popup>
                                </Marker>
                                <Polyline
                                    positions={[
                                        [delivery.pickup_location.latitude, delivery.pickup_location.longitude],
                                        [delivery.dropoff_location.latitude, delivery.dropoff_location.longitude]
                                    ]}
                                    color={delivery.status === 'IN_TRANSIT' ? 'orange' : 'blue'}
                                    weight={2}
                                    dashArray="5, 10"
                                />
                            </React.Fragment>
                        )
                    ))}
                </MapContainer>
            </div>

            {/* Stats Cards */}
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
                                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${selectedRider?.id === rider.id
                                                ? 'border-indigo-600 bg-indigo-50'
                                                : 'border-green-500'
                                            }`}
                                        onClick={() => {
                                            setSelectedRider(rider);
                                            if (rider.current_location) {
                                                setMapCenter([rider.current_location.latitude, rider.current_location.longitude]);
                                            }
                                        }}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="font-medium text-slate-900">{rider.full_name}</p>
                                            <span className="text-green-600 text-2xl">●</span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">{rider.vehicle_type}</p>
                                        <p className="text-xs text-gray-500">Active: {rider.active_deliveries}</p>
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
                                        <div>
                                            <p className="text-xs text-gray-600">Status</p>
                                            <p className="font-medium text-green-600">{selectedRider.status}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-600">Rating</p>
                                            <p className="font-medium text-yellow-600">★ {selectedRider.rating.toFixed(1)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium text-gray-900 mb-3">Performance</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-indigo-50 p-3 rounded-lg text-center">
                                            <p className="text-2xl font-bold text-indigo-600">{selectedRider.active_deliveries}</p>
                                            <p className="text-xs text-gray-600">Active</p>
                                        </div>
                                        <div className="bg-green-50 p-3 rounded-lg text-center">
                                            <p className="text-2xl font-bold text-green-600">{selectedRider.completed_deliveries}</p>
                                            <p className="text-xs text-gray-600">Completed</p>
                                        </div>
                                        <div className="bg-yellow-50 p-3 rounded-lg text-center">
                                            <p className="text-2xl font-bold text-yellow-600">★ {selectedRider.rating.toFixed(1)}</p>
                                            <p className="text-xs text-gray-600">Rating</p>
                                        </div>
                                    </div>
                                </div>
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
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${delivery.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-700' :
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

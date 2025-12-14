import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface NearbyPharmacy {
    id: string;
    name: string;
    address: string;
    city: string;
    region: string;
    distance_km: number;
}

interface NearbyPharmaciesProps {
    userLocation?: { lat: number; lng: number };
    maxDistance?: number; // in km
}

const NearbyPharmacies: React.FC<NearbyPharmaciesProps> = ({
    userLocation,
    maxDistance = 50
}) => {
    const [pharmacies, setPharmacies] = useState<NearbyPharmacy[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [radiusKm, setRadiusKm] = useState(maxDistance);

    const findNearbyPharmacies = async (lat: number, lng: number) => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('find_nearest_facilities', {
                user_lat: lat,
                user_lng: lng,
                max_distance_km: radiusKm,
                limit_count: 10
            });

            if (rpcError) throw rpcError;
            setPharmacies(data || []);
        } catch (err: any) {
            console.error('Error finding pharmacies:', err);
            setError(err.message || 'Failed to find nearby pharmacies');
        } finally {
            setLoading(false);
        }
    };

    const requestLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            return;
        }

        setLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                findNearbyPharmacies(position.coords.latitude, position.coords.longitude);
            },
            (err) => {
                setError('Unable to get your location. Please enable location access.');
                setLoading(false);
            }
        );
    };

    useEffect(() => {
        if (userLocation) {
            findNearbyPharmacies(userLocation.lat, userLocation.lng);
        }
    }, [userLocation, radiusKm]);

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">📍 Nearby Pharmacies</h3>
                {!userLocation && (
                    <button
                        onClick={requestLocation}
                        disabled={loading}
                        className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {loading ? 'Finding...' : 'Find Nearby'}
                    </button>
                )}
            </div>

            {/* Radius Selector */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Radius: {radiusKm} km
                </label>
                <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>5 km</span>
                    <span>100 km</span>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 mb-4">
                    {error}
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                </div>
            )}

            {!loading && pharmacies.length === 0 && !error && (
                <p className="text-center text-gray-500 py-8 text-sm">
                    No pharmacies found within {radiusKm} km
                </p>
            )}

            {!loading && pharmacies.length > 0 && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {pharmacies.map((pharmacy) => (
                        <div
                            key={pharmacy.id}
                            className="p-4 border border-gray-200 rounded-lg hover:border-emerald-500 transition-colors"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-gray-900">{pharmacy.name}</h4>
                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded">
                                    {pharmacy.distance_km} km
                                </span>
                            </div>
                            <p className="text-sm text-gray-600">
                                {pharmacy.address}
                                {pharmacy.city && `, ${pharmacy.city}`}
                            </p>
                            {pharmacy.region && (
                                <p className="text-xs text-gray-500 mt-1">{pharmacy.region}</p>
                            )}
                            <div className="mt-3 flex gap-2">
                                <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${pharmacy.address}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                                >
                                    Get Directions →
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NearbyPharmacies;

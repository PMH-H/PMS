
import React, { useState, useEffect } from 'react';
import { NetworkInventory } from './NetworkInventory';
import { User } from '../types';
import { supabase } from '../services/supabase';

interface NetworkInventoryManagerProps {
    currentUser: User;
}

export const NetworkInventoryManager: React.FC<NetworkInventoryManagerProps> = ({ currentUser }) => {
    const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
    const [facilities, setFacilities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadFacilities = async () => {
            // For Super Admin, fetch all top-level facilities (or just all)
            // Using 'facilities' table directly
            const { data, error } = await supabase
                .from('facilities')
                .select('id, name, region')
                .order('name');

            if (data) setFacilities(data);
            setLoading(false);
        };
        loadFacilities();
    }, []);

    // Create a mock user object with the selected facility_id to trick NetworkInventory
    // This is a safe hack because NetworkInventory only uses facility_id for fetching.
    const mockUser = selectedFacilityId ? { ...currentUser, facility_id: selectedFacilityId } : null;

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Network Inventory Inspector</h2>
                <div className="flex gap-4 items-end">
                    <div className="flex-1 max-w-md">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Select Root Facility</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded-lg"
                            value={selectedFacilityId}
                            onChange={(e) => setSelectedFacilityId(e.target.value)}
                        >
                            <option value="">-- Select a Facility to Inspect --</option>
                            {facilities.map(f => (
                                <option key={f.id} value={f.id}>{f.name} ({f.region})</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {mockUser ? (
                <div key={selectedFacilityId} className="animate-in fade-in slide-in-from-bottom-4">
                    <NetworkInventory currentUser={mockUser} />
                </div>
            ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500">Select a facility above to view its network inventory hierarchy.</p>
                </div>
            )}
        </div>
    );
};

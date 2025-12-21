import React, { useState, useEffect } from 'react';
import { Rider, RiderStatus } from '../types';
import { getRiders, createRider, updateRider } from '../services/database';

interface RiderManagementProps {
    facilityId?: string;
}

const RiderManagement: React.FC<RiderManagementProps> = ({ facilityId = 'default' }) => {
    const [riders, setRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        full_name: '',
        phone_number: '',
        vehicle_type: 'BIKE' as 'BIKE' | 'CAR' | 'VAN',
        license_number: '',
        status: 'ACTIVE' as RiderStatus
    });

    useEffect(() => {
        fetchRiders();
    }, [facilityId]);

    const fetchRiders = async () => {
        try {
            setLoading(true);
            const data = await getRiders(facilityId);
            setRiders(data);
        } catch (error) {
            console.error('Error fetching riders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            if (editingId) {
                const updated = await updateRider(editingId, {
                    ...formData,
                    facility_id: facilityId,
                    updated_at: new Date().toISOString()
                });
                setRiders(riders.map(r => r.id === editingId ? updated : r));
            } else {
                const newRider = await createRider({
                    ...formData,
                    facility_id: facilityId,
                    active_deliveries: 0,
                    completed_deliveries: 0,
                    rating: 5,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
                setRiders([...riders, newRider]);
            }
            resetForm();
        } catch (error) {
            console.error('Error saving rider:', error);
            alert('Failed to save rider');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            full_name: '',
            phone_number: '',
            vehicle_type: 'BIKE',
            license_number: '',
            status: 'ACTIVE'
        });
        setEditingId(null);
        setShowForm(false);
    };

    const handleEdit = (rider: Rider) => {
        setFormData({
            full_name: rider.full_name,
            phone_number: rider.phone_number,
            vehicle_type: rider.vehicle_type,
            license_number: rider.license_number || '',
            status: rider.status
        });
        setEditingId(rider.id);
        setShowForm(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Rider Management</h2>
                    <p className="text-sm text-gray-600 mt-1">Manage delivery riders and their status</p>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setShowForm(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    + Add Rider
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">
                        {editingId ? 'Edit Rider' : 'New Rider'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Full Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Phone Number *
                                </label>
                                <input
                                    type="tel"
                                    required
                                    value={formData.phone_number}
                                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Vehicle Type *
                                </label>
                                <select
                                    value={formData.vehicle_type}
                                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value as any })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                >
                                    <option value="BIKE">Bike</option>
                                    <option value="CAR">Car</option>
                                    <option value="VAN">Van</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    License Number
                                </label>
                                <input
                                    type="text"
                                    value={formData.license_number}
                                    onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Status
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as RiderStatus })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                >
                                    <option value="ACTIVE">Active</option>
                                    <option value="INACTIVE">Inactive</option>
                                    <option value="ON_BREAK">On Break</option>
                                    <option value="OFFLINE">Offline</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                {loading ? 'Saving...' : editingId ? 'Update' : 'Add'} Rider
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Riders Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Phone</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Vehicle</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Deliveries</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700">Rating</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                                        Loading riders...
                                    </td>
                                </tr>
                            ) : riders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                                        No riders found. Add one to get started.
                                    </td>
                                </tr>
                            ) : (
                                riders.map((rider) => (
                                    <tr key={rider.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                            {rider.full_name}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {rider.phone_number}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                                {rider.vehicle_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                rider.status === 'ACTIVE'
                                                    ? 'bg-green-100 text-green-700'
                                                    : rider.status === 'ON_BREAK'
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-gray-100 text-gray-700'
                                            }`}>
                                                {rider.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {rider.active_deliveries} active / {rider.completed_deliveries} completed
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="text-yellow-600">★ {rider.rating.toFixed(1)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm">
                                            <button
                                                onClick={() => handleEdit(rider)}
                                                className="text-indigo-600 hover:text-indigo-700 font-medium"
                                            >
                                                Edit
                                            </button>
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

export default RiderManagement;

import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { useNotifications } from '../hooks/useNotifications';
import { createAuditLog } from '../services/database';

interface PharmacyRegistrationFormProps {
    currentUser: User;
    onSuccess: (facilityId: string) => void;
    onCancel?: () => void;
    isAdminMode?: boolean;
    initialData?: {
        id: string;
        name: string;
        address: string;
        phone: string;
        email: string;
    };
    isUpdate?: boolean;
}

const PharmacyRegistrationForm: React.FC<PharmacyRegistrationFormProps> = ({
    currentUser, onSuccess, onCancel, isAdminMode = false, initialData, isUpdate = false
}) => {
    const [loading, setLoading] = useState(false);
    const { success, error } = useNotifications();

    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        address: initialData?.address || '',
        phone: initialData?.phone || '',
        email: initialData?.email || '',
        licenseNumber: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let facilityId = initialData?.id;

            if (isUpdate && facilityId) {
                // UPDATE existing facility
                const { error: updateError } = await supabase
                    .from('facilities')
                    .update({
                        name: formData.name,
                        address: formData.address,
                        phone: formData.phone,
                        email: formData.email,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', facilityId);

                if (updateError) throw updateError;

                await createAuditLog({
                    action: 'Facility Updated',
                    performed_by: currentUser.id,
                    details: { facilityId, name: formData.name }
                });

                success('Facility details updated successfully!');

            } else {
                // CREATE new facility
                const { data: facility, error: facilityError } = await supabase
                    .from('facilities')
                    .insert([{
                        name: formData.name,
                        type: 'PHARMACY',
                        address: formData.address,
                        phone: formData.phone,
                        email: formData.email,
                        is_active: true,
                        owner_id: currentUser.id // Set Admin as Owner
                    }])
                    .select()
                    .single();

                if (facilityError) throw facilityError;
                facilityId = facility.id;

                // Link User if needed
                if (!isAdminMode) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .update({ facility_id: facilityId })
                        .eq('id', currentUser.id);

                    if (profileError) console.error('Error linking profile:', profileError);
                }

                await createAuditLog({
                    action: 'Facility Created',
                    performed_by: currentUser.id,
                    details: { facilityId, name: formData.name }
                });

                success('Pharmacy registered successfully!');
            }

            if (facilityId) onSuccess(facilityId);

        } catch (err: any) {
            console.error('Registration/Update error:', err);
            error(err.message || 'Failed to process request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">
                    {isUpdate ? 'Facility Settings' : 'Register New Pharmacy'}
                </h2>
                {initialData?.id && (
                    <div className="bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 flex items-center gap-3">
                        <div>
                            <p className="text-xs text-indigo-500 font-bold uppercase">Facility ID</p>
                            <p className="font-mono text-sm text-indigo-900 select-all">{initialData.id}</p>
                        </div>
                        <button
                            onClick={() => navigator.clipboard.writeText(initialData.id)}
                            className="text-indigo-600 hover:text-indigo-800 p-1"
                            title="Copy ID"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Pharmacy Name</label>
                    <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        placeholder="e.g. HealthPlus Pharmacy - Downtown"
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Address / Location</label>
                    <textarea
                        required
                        value={formData.address}
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        rows={2}
                        placeholder="Physical address"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Phone Number</label>
                        <input
                            required
                            type="tel"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="+260..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
                        <input
                            required
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="admin@pharmacy.com"
                        />
                    </div>
                </div>

                <div className="pt-4 flex gap-3">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-3 px-4 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
                    >
                        {loading ? (
                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                        ) : null}
                        {loading ? 'Processing...' : (isUpdate ? 'Save Changes' : 'Complete Registration')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PharmacyRegistrationForm;

import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Prescription, PrescriptionStatus, User, Medication } from '../types';

interface PrescriptionManagerProps {
    currentUser: User;
    facilityId?: string;
}

const PrescriptionManager: React.FC<PrescriptionManagerProps> = ({ currentUser, facilityId }) => {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
    const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
    const [actionNotes, setActionNotes] = useState('');

    useEffect(() => {
        fetchPrescriptions();

        // Real-time subscription
        const subscription = supabase
            .channel('prescriptions_changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'prescriptions' },
                () => {
                    fetchPrescriptions();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [activeTab, facilityId]);

    const fetchPrescriptions = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('prescriptions')
                .select(`
          *,
          profiles!prescriptions_patient_id_fkey(full_name)
        `)
                .order('created_at', { ascending: false });

            // Filter by status
            if (activeTab !== 'ALL') {
                query = query.eq('status', activeTab);
            }

            // Filter by facility if provided
            if (facilityId) {
                query = query.eq('profiles.facility_id', facilityId);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Map data to include patientName
            const mapped = (data || []).map(p => ({
                ...p,
                patientName: (p as any).profiles?.full_name || 'Unknown Patient'
            }));

            setPrescriptions(mapped);
        } catch (error) {
            console.error('Error fetching prescriptions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (prescriptionId: string) => {
        try {
            const { error } = await supabase
                .from('prescriptions')
                .update({
                    status: 'APPROVED',
                    approved_by: currentUser.id,
                    approved_at: new Date().toISOString(),
                    notes: actionNotes || null
                })
                .eq('id', prescriptionId);

            if (error) throw error;

            setSelectedPrescription(null);
            setActionNotes('');
            fetchPrescriptions();
        } catch (error) {
            console.error('Error approving prescription:', error);
            alert('Failed to approve prescription');
        }
    };

    const handleReject = async (prescriptionId: string) => {
        if (!actionNotes.trim()) {
            alert('Please provide a reason for rejection');
            return;
        }

        try {
            const { error } = await supabase
                .from('prescriptions')
                .update({
                    status: 'REJECTED',
                    approved_by: currentUser.id,
                    approved_at: new Date().toISOString(),
                    notes: actionNotes
                })
                .eq('id', prescriptionId);

            if (error) throw error;

            setSelectedPrescription(null);
            setActionNotes('');
            fetchPrescriptions();
        } catch (error) {
            console.error('Error rejecting prescription:', error);
            alert('Failed to reject prescription');
        }
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            APPROVED: 'bg-green-100 text-green-800 border-green-200',
            REJECTED: 'bg-red-100 text-red-800 border-red-200',
            PICKED_UP: 'bg-blue-100 text-blue-800 border-blue-200'
        };
        return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
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
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Prescription Management</h2>
                <p className="text-sm text-gray-500">Review and manage patient prescriptions</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200">
                {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === tab
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {tab}
                        <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
                            {prescriptions.filter(p => tab === 'ALL' || p.status === tab).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Prescription List */}
            <div className="grid grid-cols-1 gap-4">
                {prescriptions.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                        <p className="text-gray-500">No prescriptions found</p>
                    </div>
                ) : (
                    prescriptions.map(prescription => (
                        <div
                            key={prescription.id}
                            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-bold text-lg text-gray-900">{prescription.patientName}</h3>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(prescription.status)}`}>
                                            {prescription.status}
                                        </span>
                                    </div>

                                    <p className="text-sm text-gray-500 mb-3">
                                        Uploaded: {new Date(prescription.created_at).toLocaleString()}
                                    </p>

                                    {/* Medications */}
                                    {prescription.medications && prescription.medications.length > 0 ? (
                                        <div className="mb-3">
                                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Medications (AI Parsed):</p>
                                            <ul className="space-y-1">
                                                {prescription.medications.map((med, idx) => (
                                                    <li key={idx} className="text-sm text-gray-700">
                                                        • {med.name} - {med.dosage} ({med.frequency})
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : (
                                        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                                            <p className="text-xs font-bold text-yellow-800">⚠️ AI Parsing Failed</p>
                                            <p className="text-xs text-yellow-700">
                                                {prescription.image_url ? 'Image uploaded - Click "View Details" to review manually' : 'No data available'}
                                            </p>
                                        </div>
                                    )}

                                    {/* Notes */}
                                    {prescription.notes && (
                                        <div className="bg-gray-50 p-3 rounded-lg">
                                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Notes:</p>
                                            <p className="text-sm text-gray-700">{prescription.notes}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 ml-4">
                                    <button
                                        onClick={() => setSelectedPrescription(prescription)}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
                                    >
                                        View Details
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Detail Modal */}
            {selectedPrescription && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPrescription(null)}>
                    <div className="bg-white rounded-2xl max-w-4xl w-full p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h3 className="text-2xl font-bold text-gray-900 mb-6">Prescription Details</h3>

                        <div className="grid grid-cols-2 gap-6 mb-6">
                            <div>
                                <p className="text-sm font-bold text-gray-500">Patient</p>
                                <p className="text-lg text-gray-900">{selectedPrescription.patientName}</p>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-500">Status</p>
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(selectedPrescription.status)}`}>
                                    {selectedPrescription.status}
                                </span>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-500">Uploaded</p>
                                <p className="text-lg text-gray-900">{new Date(selectedPrescription.created_at).toLocaleString()}</p>
                            </div>
                            {selectedPrescription.approved_at && (
                                <div>
                                    <p className="text-sm font-bold text-gray-500">Reviewed</p>
                                    <p className="text-lg text-gray-900">{new Date(selectedPrescription.approved_at).toLocaleString()}</p>
                                </div>
                            )}
                        </div>

                        {/* Prescription Image */}
                        {selectedPrescription.image_url && (
                            <div className="mb-6">
                                <p className="text-sm font-bold text-gray-500 mb-2">Prescription Image</p>
                                <img
                                    src={selectedPrescription.image_url}
                                    alt="Prescription"
                                    className="w-full rounded-lg border border-gray-200"
                                />
                            </div>
                        )}

                        {/* Medications */}
                        {selectedPrescription.medications && selectedPrescription.medications.length > 0 && (
                            <div className="mb-6">
                                <p className="text-sm font-bold text-gray-500 mb-2">Medications</p>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    {selectedPrescription.medications.map((med, idx) => (
                                        <div key={idx} className="mb-2 last:mb-0">
                                            <p className="font-bold text-gray-900">{med.name}</p>
                                            <p className="text-sm text-gray-600">Dosage: {med.dosage} | Frequency: {med.frequency}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action Section (only for PENDING) */}
                        {selectedPrescription.status === 'PENDING' && (
                            <div className="border-t border-gray-200 pt-6">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Notes (optional for approval, required for rejection)</label>
                                <textarea
                                    value={actionNotes}
                                    onChange={e => setActionNotes(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    rows={3}
                                    placeholder="Add notes about this prescription..."
                                />

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleApprove(selectedPrescription.id)}
                                        className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleReject(selectedPrescription.id)}
                                        className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedPrescription(null);
                                            setActionNotes('');
                                        }}
                                        className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Close button for non-pending */}
                        {selectedPrescription.status !== 'PENDING' && (
                            <button
                                onClick={() => setSelectedPrescription(null)}
                                className="w-full mt-6 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
                            >
                                Close
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrescriptionManager;

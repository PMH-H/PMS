import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Prescription, PrescriptionStatus, User, Medication } from '../types';
import PatientAllergies from './PatientAllergies';
import { useNotifications } from '../hooks/useNotifications';
import { createAuditLog } from '../services/database';
import { toast } from 'sonner';

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
    const { success, error, info } = useNotifications();

    useEffect(() => {
        fetchPrescriptions();

        const subscription = supabase
            .channel('prescriptions_changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'prescriptions' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        info('A new prescription has been submitted.');
                    }
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
                    patient:profiles!prescriptions_patient_id_fkey(
                        id,
                        full_name,
                        facility_id
                    )
                `)
                .order('created_at', { ascending: false });

            if (activeTab !== 'ALL') {
                query = query.ilike('status', activeTab);
            }

            const { data, error } = await query;
            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            const mapped = (data || []).map(p => ({
                ...p,
                patientName: (p as any).patient?.full_name || 'Unknown Patient'
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

            await createAuditLog({
                action: 'Prescription approved',
                performed_by: currentUser.id,
                details: `Prescription ID: ${prescriptionId}`
            });
            success('Prescription approved successfully');
            setSelectedPrescription(null);
            setActionNotes('');
            fetchPrescriptions();
        } catch (err) {
            console.error('Error approving prescription:', err);
            error('Failed to approve prescription');
        }
    };

    const handleReject = async (prescriptionId: string) => {
        if (!actionNotes.trim()) {
            toast.error('Please provide a reason for rejection');
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

            await createAuditLog({
                action: 'Prescription rejected',
                performed_by: currentUser.id,
                details: `Prescription ID: ${prescriptionId}`
            });
            success('Prescription rejected successfully');
            setSelectedPrescription(null);
            setActionNotes('');
            fetchPrescriptions();
        } catch (err) {
            console.error('Error rejecting prescription:', err);
            error('Failed to reject prescription');
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
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Prescription Management</h2>
                <p className="text-sm text-gray-500">Review and manage patient prescriptions</p>
            </div>

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

            <div className="grid grid-cols-1 gap-4">
                {prescriptions.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                        <p className="text-gray-500">No prescriptions found for {activeTab} status</p>
                        <p className="text-xs text-gray-400 mt-2">
                            {loading ? 'Loading...' : 'Try selecting a different tab or check RLS policies'}
                        </p>
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

                                    <div className="text-sm text-gray-600 mb-2">
                                        {prescription.medications && prescription.medications.length > 0 ? (
                                            <div className="flex items-start gap-2">
                                                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                                <div className="flex-1">
                                                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Medications (AI Parsed):</p>
                                                    <ul className="space-y-1">
                                                        {prescription.medications.slice(0, 3).map((med, idx) => (
                                                            <li key={idx} className="text-sm text-gray-700">
                                                                • {med.name} - {med.dosage}
                                                            </li>
                                                        ))}
                                                        {prescription.medications.length > 3 && (
                                                            <li className="text-xs text-gray-500 italic">+ {prescription.medications.length - 3} more...</li>
                                                        )}
                                                    </ul>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                                                <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                <div>
                                                    <p className="text-xs font-bold text-yellow-800">⚠️ AI Parsing Failed</p>
                                                    <p className="text-xs text-yellow-700">
                                                        {prescription.image_url ? 'Image uploaded - Click "View Details" to review manually' : 'No data available'}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {prescription.notes && (
                                        <div className="bg-gray-50 p-3 rounded-lg mt-3">
                                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Notes:</p>
                                            <p className="text-sm text-gray-700">{prescription.notes}</p>
                                        </div>
                                    )}
                                </div>

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

            {
                selectedPrescription && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelectedPrescription(null)}>
                        <div
                            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg md:max-w-2xl lg:max-w-4xl p-4 sm:p-6 md:p-8 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4 sm:mb-6">
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Prescription Details</h3>
                                <button
                                    onClick={() => setSelectedPrescription(null)}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs font-bold text-gray-500 uppercase">Patient</p>
                                    <p className="text-base sm:text-lg text-gray-900 font-medium">{selectedPrescription.patientName}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs font-bold text-gray-500 uppercase">Status</p>
                                    <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(selectedPrescription.status)}`}>
                                        {selectedPrescription.status}
                                    </span>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs font-bold text-gray-500 uppercase">Uploaded</p>
                                    <p className="text-sm text-gray-900">{new Date(selectedPrescription.created_at).toLocaleString()}</p>
                                </div>
                                {selectedPrescription.approved_at && (
                                    <div className="bg-gray-50 p-3 rounded-lg">
                                        <p className="text-xs font-bold text-gray-500 uppercase">Reviewed</p>
                                        <p className="text-sm text-gray-900">{new Date(selectedPrescription.approved_at).toLocaleString()}</p>
                                    </div>
                                )}
                            </div>

                            {selectedPrescription.image_url && (
                                <div className="mb-4 sm:mb-6">
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Prescription Image</p>
                                    <img
                                        src={selectedPrescription.image_url}
                                        alt="Prescription"
                                        className="w-full max-h-48 sm:max-h-72 md:max-h-96 object-contain rounded-lg border border-gray-200 bg-gray-50"
                                        onError={(e) => {
                                            console.error('Image failed to load:', selectedPrescription.image_url);
                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%239ca3af" font-size="16"%3EImage not available%3C/text%3E%3C/svg%3E';
                                        }}
                                    />
                                </div>
                            )}

                            {selectedPrescription.patient_id && (
                                <div className="mb-4 sm:mb-6">
                                    <PatientAllergies patientId={selectedPrescription.patient_id} readOnly={true} />
                                </div>
                            )}

                            {selectedPrescription.interactions && selectedPrescription.interactions.length > 0 && (
                                <div className="mb-4 sm:mb-6 border border-red-200 rounded-xl overflow-hidden">
                                    <div className="bg-red-50 px-4 py-2 border-b border-red-200 flex items-center gap-2">
                                        <span className="text-xl">⚠️</span>
                                        <h4 className="font-bold text-red-900 text-sm">Clinical Safety Alerts (AI)</h4>
                                    </div>
                                    <div className="p-4 bg-white space-y-2">
                                        {selectedPrescription.interactions.map((alert: any, idx: number) => (
                                            <div key={idx} className="p-2 bg-red-50 border border-red-100 rounded text-sm text-red-800">
                                                <strong>{alert.medicationA} + {alert.medicationB}</strong>: <span className="uppercase text-xs font-bold bg-red-200 px-1 rounded">{alert.severity}</span>
                                                <div className="text-xs mt-1 text-red-700">{alert.description}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedPrescription.medications && selectedPrescription.medications.length > 0 && (
                                <div className="mb-4 sm:mb-6">
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Medications</p>
                                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg space-y-2">
                                        {selectedPrescription.medications.map((med, idx) => (
                                            <div key={idx} className="pb-2 last:pb-0 border-b last:border-b-0 border-gray-200">
                                                <p className="font-bold text-gray-900 text-sm sm:text-base">{med.name}</p>
                                                <p className="text-xs sm:text-sm text-gray-600">Dosage: {med.dosage} | Frequency: {med.frequency}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedPrescription.status === 'PENDING' && (
                                <div className="border-t border-gray-200 pt-4 sm:pt-6">
                                    <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">Notes (optional for approval, required for rejection)</label>
                                    <textarea
                                        value={actionNotes}
                                        onChange={e => setActionNotes(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-3 mb-3 sm:mb-4 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        rows={3}
                                        placeholder="Add notes about this prescription..."
                                    />

                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                        <button
                                            onClick={() => handleApprove(selectedPrescription.id)}
                                            className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors text-sm sm:text-base"
                                        >
                                            ✓ Approve
                                        </button>
                                        <button
                                            onClick={() => handleReject(selectedPrescription.id)}
                                            className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-colors text-sm sm:text-base"
                                        >
                                            ✗ Reject
                                        </button>
                                    </div>
                                </div>
                            )}

                            {selectedPrescription.status !== 'PENDING' && (
                                <button
                                    onClick={() => setSelectedPrescription(null)}
                                    className="w-full mt-4 sm:mt-6 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                                >
                                    Close
                                </button>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default PrescriptionManager;

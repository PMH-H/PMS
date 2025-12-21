import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';

interface SignupRequest {
    id: string;
    email: string;
    user_id: string | null;
    requested_role: 'patient' | 'prescriber' | 'pharmacist_admin';
    full_name: string;
    phone: string | null;
    hpcz_number: string | null;
    specialization: string | null;
    facility_name: string | null;
    status: 'pending' | 'hpcz_verified' | 'admin_review' | 'approved' | 'rejected';
    hpcz_verification_response: any | null;
    hpcz_verified_at: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;
    created_at: string;
}

interface SignupApprovalPanelProps {
    onApproval?: () => void;
}

const SignupApprovalPanel: React.FC<SignupApprovalPanelProps> = ({ onApproval }) => {
    const [requests, setRequests] = useState<SignupRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'pending' | 'all'>('pending');
    const [selectedRequest, setSelectedRequest] = useState<SignupRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchRequests();
    }, [filter]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('signup_requests')
                .select('*')
                .order('created_at', { ascending: false });

            if (filter === 'pending') {
                query = query.in('status', ['pending', 'hpcz_verified', 'admin_review']);
            }

            const { data, error } = await query;
            if (error) throw error;
            setRequests(data || []);
        } catch (error) {
            console.error('Error fetching signup requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (request: SignupRequest) => {
        setProcessing(true);
        try {
            // 1. Update signup_request status
            const { error: updateError } = await supabase
                .from('signup_requests')
                .update({
                    status: 'approved',
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', request.id);

            if (updateError) throw updateError;

            // 2. Update user's profile with approved role
            if (request.user_id) {
                const roleMapping: Record<string, string> = {
                    'patient': 'customer',
                    'prescriber': 'prescriber',
                    'pharmacist_admin': 'admin'
                };

                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        role: roleMapping[request.requested_role],
                        full_name: request.full_name,
                        phone: request.phone
                    })
                    .eq('id', request.user_id);

                if (profileError) {
                    console.error('Error updating profile:', profileError);
                }
            }

            // Refresh list
            await fetchRequests();
            setSelectedRequest(null);
            onApproval?.();
        } catch (error) {
            console.error('Error approving request:', error);
            alert('Failed to approve request');
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async (request: SignupRequest) => {
        if (!rejectionReason.trim()) {
            alert('Please provide a rejection reason');
            return;
        }

        setProcessing(true);
        try {
            const { error } = await supabase
                .from('signup_requests')
                .update({
                    status: 'rejected',
                    rejection_reason: rejectionReason,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', request.id);

            if (error) throw error;

            await fetchRequests();
            setSelectedRequest(null);
            setRejectionReason('');
        } catch (error) {
            console.error('Error rejecting request:', error);
            alert('Failed to reject request');
        } finally {
            setProcessing(false);
        }
    };

    const verifyHPCZ = async (request: SignupRequest) => {
        // TODO: Integrate with HPCZ API when available
        // For now, mark as admin_review
        try {
            await supabase
                .from('signup_requests')
                .update({ status: 'admin_review' })
                .eq('id', request.id);
            await fetchRequests();
        } catch (error) {
            console.error('Error updating HPCZ status:', error);
        }
    };

    const getRoleBadge = (role: string) => {
        const badges: Record<string, { bg: string; text: string; label: string }> = {
            patient: { bg: 'bg-blue-100', text: 'text-blue-800', label: '🏥 Patient' },
            prescriber: { bg: 'bg-purple-100', text: 'text-purple-800', label: '👨‍⚕️ Prescriber' },
            pharmacist_admin: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: '💊 Pharmacy Admin' }
        };
        const badge = badges[role] || { bg: 'bg-gray-100', text: 'text-gray-800', label: role };
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>;
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { bg: string; text: string }> = {
            pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
            hpcz_verified: { bg: 'bg-blue-100', text: 'text-blue-800' },
            admin_review: { bg: 'bg-orange-100', text: 'text-orange-800' },
            approved: { bg: 'bg-green-100', text: 'text-green-800' },
            rejected: { bg: 'bg-red-100', text: 'text-red-800' }
        };
        const badge = badges[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>{status.replace('_', ' ')}</span>;
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Signup Requests</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('pending')}
                        className={`px-4 py-2 text-sm rounded-lg transition ${filter === 'pending' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        Pending ({requests.filter(r => ['pending', 'hpcz_verified', 'admin_review'].includes(r.status)).length})
                    </button>
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 text-sm rounded-lg transition ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        All
                    </button>
                    <button onClick={fetchRequests} className="p-2 text-gray-500 hover:text-gray-700">🔄</button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : requests.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    {filter === 'pending' ? 'No pending signup requests 🎉' : 'No signup requests found'}
                </div>
            ) : (
                <div className="space-y-4">
                    {requests.map(request => (
                        <div
                            key={request.id}
                            className={`border rounded-lg p-4 transition hover:shadow-md cursor-pointer ${selectedRequest?.id === request.id ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-gray-200'}`}
                            onClick={() => setSelectedRequest(selectedRequest?.id === request.id ? null : request)}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-semibold text-gray-900">{request.full_name}</div>
                                    <div className="text-sm text-gray-500">{request.email}</div>
                                    {request.phone && <div className="text-sm text-gray-400">{request.phone}</div>}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    {getRoleBadge(request.requested_role)}
                                    {getStatusBadge(request.status)}
                                </div>
                            </div>

                            {/* Professional Details */}
                            {request.hpcz_number && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                    <div className="text-sm"><strong>HPCZ:</strong> {request.hpcz_number}</div>
                                    {request.specialization && <div className="text-sm"><strong>Specialization:</strong> {request.specialization}</div>}
                                    {request.facility_name && <div className="text-sm"><strong>Pharmacy:</strong> {request.facility_name}</div>}
                                </div>
                            )}

                            {/* Expanded Actions */}
                            {selectedRequest?.id === request.id && request.status !== 'approved' && request.status !== 'rejected' && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <div className="flex flex-col gap-3">
                                        {request.hpcz_number && request.status === 'pending' && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); verifyHPCZ(request); }}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full"
                                                disabled={processing}
                                            >
                                                🔍 Verify HPCZ Number
                                            </button>
                                        )}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleApprove(request); }}
                                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                                disabled={processing}
                                            >
                                                ✓ Approve
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedRequest({ ...request, status: 'rejected' as any }); }}
                                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                                disabled={processing}
                                            >
                                                ✗ Reject
                                            </button>
                                        </div>
                                        {(selectedRequest as any).status === 'rejected' && (
                                            <div className="mt-2">
                                                <textarea
                                                    value={rejectionReason}
                                                    onChange={(e) => setRejectionReason(e.target.value)}
                                                    placeholder="Reason for rejection..."
                                                    className="w-full p-2 border rounded-lg text-sm"
                                                    rows={2}
                                                />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleReject(request); }}
                                                    className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 w-full disabled:opacity-50"
                                                    disabled={processing || !rejectionReason.trim()}
                                                >
                                                    Confirm Rejection
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Rejection Reason */}
                            {request.status === 'rejected' && request.rejection_reason && (
                                <div className="mt-3 p-3 bg-red-50 rounded-lg text-sm text-red-700">
                                    <strong>Rejection Reason:</strong> {request.rejection_reason}
                                </div>
                            )}

                            <div className="mt-2 text-xs text-gray-400">
                                Submitted: {new Date(request.created_at).toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SignupApprovalPanel;

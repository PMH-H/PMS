import React, { useState, useEffect } from 'react';
import { Prescription, PrescriptionStatus, AuditLog } from '../types';
import { getAuditLogs } from '../services/database';

interface PrescriptionDetailViewProps {
    prescription: Prescription;
    onClose: () => void;
}

const PrescriptionDetailView: React.FC<PrescriptionDetailViewProps> = ({ prescription, onClose }) => {
    // Helper to format date
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            setLoadingLogs(true);
            try {
                const logs = await getAuditLogs({ entityId: prescription.id, entityType: 'prescriptions' });
                setAuditLogs(logs);
            } catch (err) {
                console.error("Failed to fetch logs", err);
            } finally {
                setLoadingLogs(false);
            }
        };

        if (prescription?.id) {
            fetchLogs();
        }
    }, [prescription?.id]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (status: string) => {
        switch (status?.toUpperCase()) {
            case 'APPROVED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'REJECTED': return 'bg-red-100 text-red-800 border-red-200';
            case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'PICKED_UP': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status?.toUpperCase()) {
            case 'PENDING': return 'Waiting for Approval';
            default: return status;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
            <div
                className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex justify-between items-start z-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-2xl font-bold text-slate-900">Prescription Details</h2>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(prescription.status)}`}>
                                {getStatusLabel(prescription.status)}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Submitted on {formatDate(prescription.created_at)}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-8">

                    {/* AI Analysis Section */}
                    <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 overflow-hidden">
                        <div className="bg-indigo-50 px-6 py-3 border-b border-indigo-100 flex justify-between items-center">
                            <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                AI Analysis Summary
                            </h3>
                            <span className="text-xs font-medium text-indigo-600 bg-white px-2 py-1 rounded shadow-sm">
                                Auto-Parsed
                            </span>
                        </div>
                        <div className="p-6">
                            {prescription.medications && prescription.medications.length > 0 ? (
                                <div>
                                    <p className="text-sm text-indigo-800 mb-4 font-medium">The following medications were identified from your image:</p>
                                    <ul className="space-y-3">
                                        {prescription.medications.map((med, index) => (
                                            <li key={index} className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm flex justify-between items-center">
                                                <div>
                                                    <div className="font-bold text-slate-800">{med.name}</div>
                                                    <div className="text-xs text-slate-500">Dosage: {med.dosage} • Freq: {med.frequency}</div>
                                                </div>
                                                <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-sm text-indigo-400 italic">No medications automatically detected. Pharmacist will review manually.</p>
                                </div>
                            )}

                            {/* Interactions Alert */}
                            {prescription.interactions && prescription.interactions.length > 0 && (
                                <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3">
                                    <h4 className="text-xs font-bold text-orange-800 uppercase tracking-wide mb-2 flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        Potential Interactions Detected
                                    </h4>
                                    <ul className="space-y-1">
                                        {prescription.interactions.map((interaction, idx) => (
                                            <li key={idx} className="text-xs text-orange-700">
                                                • {interaction.description} ({interaction.severity})
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pharmacist Feedback */}
                    {(prescription.notes || prescription.status === 'REJECTED') && (
                        <div className={`p-4 rounded-xl border ${prescription.status === 'REJECTED' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                            <h3 className={`font-bold text-sm mb-2 flex items-center gap-2 ${prescription.status === 'REJECTED' ? 'text-red-800' : 'text-blue-800'}`}>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {prescription.status === 'REJECTED'
                                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                    }
                                </svg>
                                {prescription.status === 'REJECTED' ? 'Rejection Reason' : 'Pharmacist Note'}
                            </h3>
                            <p className={`text-sm ${prescription.status === 'REJECTED' ? 'text-red-700' : 'text-blue-700'}`}>
                                {prescription.notes || "No additional notes provided."}
                            </p>
                        </div>
                    )}

                    {/* Original Image */}
                    <div>
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            Original Scanned Image
                        </h3>
                        {prescription.image_url ? (
                            <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                                <img
                                    src={prescription.image_url}
                                    alt="Prescription Scan"
                                    className="w-full object-contain max-h-96"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%239ca3af" font-size="16"%3EImage Load Failed%3C/text%3E%3C/svg%3E';
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center text-gray-400">
                                No image available
                            </div>
                        )}
                    </div>

                    {/* Timeline / History */}
                    {/* Timeline / Real History */}
                    <div className="border-t border-gray-100 pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-900">Full Activity History</h3>
                            {loadingLogs && <span className="text-xs text-gray-400 animate-pulse">Loading logs...</span>}
                        </div>

                        <div className="relative border-l-2 border-gray-100 ml-3 space-y-6">
                            {/* Always show creation */}
                            <div className="ml-6 relative">
                                <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-indigo-100 border-2 border-indigo-500"></div>
                                <div className="font-semibold text-sm text-slate-900">Request Submitted</div>
                                <div className="text-xs text-slate-500">{formatDate(prescription.created_at)}</div>
                            </div>

                            {/* Render Audit Logs */}
                            {auditLogs.map((log) => (
                                <div key={log.id} className="ml-6 relative">
                                    <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-gray-100 border-2 border-gray-400"></div>
                                    <div className="font-semibold text-sm text-slate-900">
                                        {log.action}
                                    </div>
                                    <div className="text-xs text-slate-500 flex flex-col gap-0.5">
                                        <span>{formatDate(log.created_at)}</span>
                                        {log.profiles?.full_name && (
                                            <span className="text-indigo-600">by {log.profiles.full_name} ({log.profiles.role})</span>
                                        )}
                                        {log.details && (
                                            <span className="text-gray-400 italic mt-1">
                                                {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {auditLogs.length === 0 && !loadingLogs && (
                            <div className="text-xs text-gray-400 italic ml-8 mt-2">
                                No additional activity recorded.
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default PrescriptionDetailView;

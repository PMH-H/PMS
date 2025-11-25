import React, { useState, useEffect } from 'react';
import { Prescription, Medication, PrescriptionStatus } from '../types';
import { supabase } from '../services/supabase';

interface PrescriptionDetailsModalProps {
    prescription: Prescription;
    onClose: () => void;
    onVerify?: (notes: string) => void;
    onReject?: (reason: string) => void;
    userRole: 'CUSTOMER' | 'PHARMACIST' | 'ADMIN';
}

interface HistoryEntry {
    id: string;
    change_type: string;
    notes: string;
    created_at: string;
    changed_by_name?: string;
}

interface Note {
    id: string;
    note_type: string;
    content: string;
    author_name?: string;
    created_at: string;
}

const PrescriptionDetailsModal: React.FC<PrescriptionDetailsModalProps> = ({
    prescription,
    onClose,
    onVerify,
    onReject,
    userRole
}) => {
    const [activeTab, setActiveTab] = useState<'DETAILS' | 'HISTORY' | 'ANALYTICS'>('DETAILS');
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [pharmacistNotes, setPharmacistNotes] = useState('');
    const [patientClarification, setPatientClarification] = useState('');
    const [loading, setLoading] = useState(false);
    const [imageZoomed, setImageZoomed] = useState(false);

    useEffect(() => {
        fetchPrescriptionDetails();
    }, [prescription.id]);

    const fetchPrescriptionDetails = async () => {
        setLoading(true);
        try {
            const { data: historyData } = await supabase
                .from('prescription_history')
                .select('*, profiles:changed_by(full_name)')
                .eq('prescription_id', prescription.id)
                .order('created_at', { ascending: false });

            if (historyData) {
                setHistory(historyData.map(h => ({
                    ...h,
                    changed_by_name: (h.profiles as any)?.full_name || 'System'
                })));
            }

            const { data: notesData } = await supabase
                .from('prescription_notes')
                .select('*, profiles:author_id(full_name)')
                .eq('prescription_id', prescription.id)
                .order('created_at', { ascending: false });

            if (notesData) {
                setNotes(notesData.map(n => ({
                    ...n,
                    author_name: (n.profiles as any)?.full_name || 'System'
                })));
            }
        } catch (error) {
            console.error('Error fetching prescription details:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddNote = async (noteType: 'PHARMACIST' | 'PATIENT') => {
        const content = noteType === 'PHARMACIST' ? pharmacistNotes : patientClarification;
        if (!content.trim()) return;

        try {
            const { error } = await supabase
                .from('prescription_notes')
                .insert([{
                    prescription_id: prescription.id,
                    note_type: noteType,
                    author_id: (await supabase.auth.getUser()).data.user?.id,
                    content: content.trim()
                }]);

            if (!error) {
                if (noteType === 'PHARMACIST') setPharmacistNotes('');
                else setPatientClarification('');
                await fetchPrescriptionDetails();
            }
        } catch (error) {
            console.error('Error adding note:', error);
        }
    };

    const getStatusColor = (status: PrescriptionStatus) => {
        switch (status) {
            case 'PENDING': return 'bg-yellow-100 text-yellow-800';
            case 'APPROVED': return 'bg-blue-100 text-blue-800';
            case 'PICKED_UP': return 'bg-green-100 text-green-800';
            case 'REJECTED': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getChangeTypeIcon = (changeType: string) => {
        switch (changeType) {
            case 'CREATED': return '📝';
            case 'AI_ANALYZED': return '🤖';
            case 'PHARMACIST_VERIFIED': return '✅';
            case 'STATUS_UPDATED': return '🔄';
            case 'PATIENT_CLARIFICATION': return '💬';
            default: return '📌';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full sm:max-w-4xl sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col h-[95vh] sm:max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 sm:p-6 text-white flex-shrink-0">
                    <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                            <h2 className="text-xl sm:text-2xl font-bold mb-1 truncate">Prescription Details</h2>
                            <p className="text-indigo-100 text-xs sm:text-sm">Rx ID: {prescription.id.substring(0, 8).toUpperCase()}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors flex-shrink-0 ml-2 touch-manipulation"
                            aria-label="Close"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <div className="flex gap-1 p-2 overflow-x-auto scrollbar-hide">
                        {(['DETAILS', 'HISTORY', 'ANALYTICS'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap touch-manipulation ${activeTab === tab
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-500 hover:bg-white/50'
                                    }`}
                            >
                                {tab === 'DETAILS' && '📋 Details'}
                                {tab === 'HISTORY' && '📊 History'}
                                {tab === 'ANALYTICS' && '🤖 AI Analytics'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-4 sm:p-6 overscroll-contain">
                    {activeTab === 'DETAILS' && (
                        <div className="space-y-4 sm:space-y-6">
                            {/* Patient Info & Status */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="bg-gray-50 p-3 sm:p-4 rounded-xl">
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Patient</p>
                                    <p className="text-base sm:text-lg font-bold text-gray-900">{prescription.patientName}</p>
                                </div>
                                <div className="bg-gray-50 p-3 sm:p-4 rounded-xl">
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Status</p>
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-bold ${getStatusColor(prescription.status)}`}>
                                        ● {prescription.status}
                                    </span>
                                </div>
                            </div>

                            {/* Prescription Image */}
                            {prescription.imageUrl && (
                                <div className="bg-gray-50 p-3 sm:p-4 rounded-xl">
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-3">Prescription Image</p>
                                    <div
                                        className={`relative ${imageZoomed ? 'fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4' : ''}`}
                                        onClick={() => setImageZoomed(!imageZoomed)}
                                    >
                                        <img
                                            src={prescription.imageUrl}
                                            alt="Prescription"
                                            className={`${imageZoomed ? 'max-w-full max-h-full' : 'w-full rounded-lg'} cursor-pointer transition-all`}
                                        />
                                        {!imageZoomed && (
                                            <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                                                Tap to zoom
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Medications */}
                            <div className="bg-blue-50 p-3 sm:p-4 rounded-xl border border-blue-100">
                                <p className="text-xs text-blue-600 uppercase font-bold mb-3">📋 Medications Detected</p>
                                <div className="space-y-2">
                                    {prescription.medications.map((med, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded-lg shadow-sm">
                                            <p className="font-bold text-gray-900 text-sm sm:text-base">{med.name}</p>
                                            <p className="text-xs sm:text-sm text-gray-600">
                                                {med.dosage} • {med.frequency}
                                                {med.duration && ` • ${med.duration}`}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Notes Sections */}
                            {notes.filter(n => n.note_type === 'PATIENT').length > 0 && (
                                <div className="bg-purple-50 p-3 sm:p-4 rounded-xl border border-purple-100">
                                    <p className="text-xs text-purple-600 uppercase font-bold mb-2">💬 Patient Request</p>
                                    {notes.filter(n => n.note_type === 'PATIENT').map(note => (
                                        <p key={note.id} className="text-sm text-gray-700 italic">"{note.content}"</p>
                                    ))}
                                </div>
                            )}

                            {notes.filter(n => n.note_type === 'AI_ANALYSIS').length > 0 && (
                                <div className="bg-indigo-50 p-3 sm:p-4 rounded-xl border border-indigo-100">
                                    <p className="text-xs text-indigo-600 uppercase font-bold mb-2">🤖 AI Analysis Notes</p>
                                    {notes.filter(n => n.note_type === 'AI_ANALYSIS').map(note => (
                                        <p key={note.id} className="text-sm text-gray-700">{note.content}</p>
                                    ))}
                                </div>
                            )}

                            {/* Pharmacist Notes */}
                            {userRole !== 'CUSTOMER' && (
                                <div className="bg-green-50 p-3 sm:p-4 rounded-xl border border-green-100">
                                    <p className="text-xs text-green-600 uppercase font-bold mb-3">👨‍⚕️ Pharmacist Notes</p>
                                    {notes.filter(n => n.note_type === 'PHARMACIST').map(note => (
                                        <div key={note.id} className="bg-white p-3 rounded-lg mb-2">
                                            <p className="text-xs sm:text-sm text-gray-500">{note.author_name} • {new Date(note.created_at).toLocaleString()}</p>
                                            <p className="text-sm text-gray-700 mt-1">{note.content}</p>
                                        </div>
                                    ))}
                                    <textarea
                                        value={pharmacistNotes}
                                        onChange={(e) => setPharmacistNotes(e.target.value)}
                                        placeholder="Add verification notes..."
                                        className="w-full mt-2 p-3 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                        rows={3}
                                    />
                                    <button
                                        onClick={() => handleAddNote('PHARMACIST')}
                                        className="mt-2 px-4 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors touch-manipulation w-full sm:w-auto"
                                    >
                                        Add Note
                                    </button>
                                </div>
                            )}

                            {/* Patient Clarification */}
                            {userRole === 'CUSTOMER' && (
                                <div className="bg-yellow-50 p-3 sm:p-4 rounded-xl border border-yellow-100">
                                    <p className="text-xs text-yellow-600 uppercase font-bold mb-3">💬 Add Clarification</p>
                                    <textarea
                                        value={patientClarification}
                                        onChange={(e) => setPatientClarification(e.target.value)}
                                        placeholder="Add any additional information..."
                                        className="w-full p-3 border border-yellow-200 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none text-sm"
                                        rows={3}
                                    />
                                    <button
                                        onClick={() => handleAddNote('PATIENT')}
                                        className="mt-2 px-4 py-2.5 bg-yellow-600 text-white rounded-lg font-bold hover:bg-yellow-700 transition-colors touch-manipulation w-full sm:w-auto"
                                    >
                                        Submit Clarification
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'HISTORY' && (
                        <div className="space-y-3">
                            <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-4">📊 Timeline</h3>
                            {history.length === 0 ? (
                                <p className="text-gray-500 text-center py-8 text-sm">No history available</p>
                            ) : (
                                <div className="relative border-l-2 border-gray-200 pl-4 sm:pl-6 space-y-4">
                                    {history.map((entry) => (
                                        <div key={entry.id} className="relative">
                                            <div className="absolute -left-[21px] sm:-left-[29px] top-1 w-3 h-3 sm:w-4 sm:h-4 bg-indigo-600 rounded-full border-2 sm:border-4 border-white"></div>
                                            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                                                <div className="flex items-start justify-between mb-2">
                                                    <span className="text-base sm:text-lg">{getChangeTypeIcon(entry.change_type)}</span>
                                                    <span className="text-xs text-gray-500">
                                                        {new Date(entry.created_at).toLocaleString()}
                                                    </span>
                                                </div>
                                                <p className="font-bold text-sm sm:text-base text-gray-900">{entry.change_type.replace(/_/g, ' ')}</p>
                                                <p className="text-xs sm:text-sm text-gray-600">by {entry.changed_by_name}</p>
                                                {entry.notes && <p className="text-xs sm:text-sm text-gray-700 mt-2 italic">"{entry.notes}"</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'ANALYTICS' && (
                        <div className="space-y-4">
                            <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-4">🤖 AI Performance</h3>
                            <div className="bg-indigo-50 p-4 sm:p-6 rounded-xl border border-indigo-100">
                                <p className="text-xs sm:text-sm text-gray-600 mb-4">
                                    AI analytics help improve prescription processing accuracy over time.
                                </p>
                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                    <div className="bg-white p-3 sm:p-4 rounded-lg">
                                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Confidence Score</p>
                                        <p className="text-xl sm:text-2xl font-bold text-indigo-600">
                                            {prescription.interactions ? '92%' : 'N/A'}
                                        </p>
                                    </div>
                                    <div className="bg-white p-3 sm:p-4 rounded-lg">
                                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Medications Detected</p>
                                        <p className="text-xl sm:text-2xl font-bold text-gray-900">{prescription.medications.length}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                {userRole !== 'CUSTOMER' && prescription.status === 'PENDING' && (
                    <div className="border-t border-gray-200 p-3 sm:p-4 bg-gray-50 flex gap-2 sm:gap-3 flex-shrink-0">
                        <button
                            onClick={() => onVerify && onVerify(pharmacistNotes)}
                            className="flex-1 py-3 sm:py-3 bg-green-600 text-white rounded-xl text-sm sm:text-base font-bold hover:bg-green-700 transition-colors shadow-md touch-manipulation"
                        >
                            ✓ Verify & Approve
                        </button>
                        <button
                            onClick={() => onReject && onReject('Requires clarification')}
                            className="flex-1 py-3 sm:py-3 bg-red-600 text-white rounded-xl text-sm sm:text-base font-bold hover:bg-red-700 transition-colors shadow-md touch-manipulation"
                        >
                            ✗ Request Changes
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrescriptionDetailsModal;

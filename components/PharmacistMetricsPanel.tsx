import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { getPatientsByPharmacist, PharmacistPatient, getPharmacistMetrics, PharmacistMetrics } from '../services/userHierarchyService';

interface PharmacistMetricsPanelProps {
    currentUser?: User;
    pharmacistId?: string;
}

const PharmacistMetricsPanel: React.FC<PharmacistMetricsPanelProps> = ({
    currentUser,
    pharmacistId
}) => {
    const [metrics, setMetrics] = useState<PharmacistMetrics | null>(null);
    const [patients, setPatients] = useState<PharmacistPatient[]>([]);
    const [recentPrescriptions, setRecentPrescriptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'patients' | 'activity'>('overview');

    const userId = pharmacistId || currentUser?.id;

    const loadData = useCallback(async () => {
        if (!userId) return;

        setLoading(true);
        try {
            const { data: metricsData } = await getPharmacistMetrics(userId);
            if (metricsData && metricsData.length > 0) {
                setMetrics(metricsData[0]);
            }

            const { data: patientsData } = await getPatientsByPharmacist(userId);
            setPatients(patientsData);

            const { data: rxData } = await supabase
                .from('prescriptions')
                .select('*, patient:profiles!prescriptions_patient_id_fkey(full_name)')
                .eq('approved_by', userId)
                .order('created_at', { ascending: false })
                .limit(10);

            setRecentPrescriptions(rxData || []);
        } catch (err) {
            console.error('Error loading pharmacist data:', err);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        loadData();

        const channel = supabase
            .channel('pharmacist-metrics-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions', filter: `approved_by=eq.${userId}` }, (payload) => {
                loadData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadData, userId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    const tabs = [
        { key: 'overview', label: 'Overview', icon: '📊' },
        { key: 'patients', label: 'My Patients', icon: '👥' },
        { key: 'activity', label: 'Recent Activity', icon: '📋' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex gap-2 border-b border-gray-200 pb-2">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === tab.key
                                ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white">
                            <p className="text-xs font-medium text-emerald-100 uppercase">Active Patients</p>
                            <p className="text-3xl font-bold mt-2">{metrics?.active_patients || 0}</p>
                            <p className="text-xs text-emerald-200 mt-1">Assigned to you</p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
                            <p className="text-xs font-medium text-blue-100 uppercase">Prescriptions Today</p>
                            <p className="text-3xl font-bold mt-2">{metrics?.prescriptions_today || 0}</p>
                            <p className="text-xs text-blue-200 mt-1">Processed by you</p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
                            <p className="text-xs font-medium text-purple-100 uppercase">This Week</p>
                            <p className="text-3xl font-bold mt-2">{metrics?.prescriptions_week || 0}</p>
                            <p className="text-xs text-purple-200 mt-1">Last 7 days</p>
                        </div>
                        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white">
                            <p className="text-xs font-medium text-amber-100 uppercase">Total Processed</p>
                            <p className="text-3xl font-bold mt-2">{metrics?.total_prescriptions_processed || 0}</p>
                            <p className="text-xs text-amber-200 mt-1">All time</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="font-bold text-gray-900 mb-4">Prescription Status</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">Approved</span>
                                        <span className="font-bold text-emerald-600">{metrics?.approved_count || 0}</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 rounded-full"
                                            style={{
                                                width: `${metrics?.total_prescriptions_processed ?
                                                    ((metrics.approved_count || 0) / metrics.total_prescriptions_processed) * 100 : 0}%`
                                            }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">Rejected</span>
                                        <span className="font-bold text-red-600">{metrics?.rejected_count || 0}</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-red-500 rounded-full"
                                            style={{
                                                width: `${metrics?.total_prescriptions_processed ?
                                                    ((metrics.rejected_count || 0) / metrics.total_prescriptions_processed) * 100 : 0}%`
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {metrics?.total_prescriptions_processed ? (
                                <p className="text-xs text-gray-500 mt-4">
                                    Approval rate: {Math.round(((metrics.approved_count || 0) / metrics.total_prescriptions_processed) * 100)}%
                                </p>
                            ) : null}
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="font-bold text-gray-900 mb-4">Facility Info</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm text-gray-600">Facility</span>
                                    <span className="font-medium text-gray-900">{metrics?.facility_name || 'Not assigned'}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm text-gray-600">Joined</span>
                                    <span className="font-medium text-gray-900">
                                        {metrics?.joined_at ? new Date(metrics.joined_at).toLocaleDateString() : 'N/A'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm text-gray-600">Last Active</span>
                                    <span className="font-medium text-gray-900">
                                        {metrics?.last_active_at ? new Date(metrics.last_active_at).toLocaleString() : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'patients' && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="font-bold text-gray-900">My Patients ({patients.length})</h3>
                    </div>

                    {patients.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <p>No patients assigned yet.</p>
                            <p className="text-sm mt-1">Patients will be assigned as they submit prescriptions.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Patient</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Primary</th>
                                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Prescriptions</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Last Prescription</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Assigned</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {patients.map(patient => (
                                        <tr key={patient.patient_id} className="hover:bg-gray-50">
                                            <td className="py-3 px-4">
                                                <div>
                                                    <p className="font-medium text-gray-900">{patient.patient_name}</p>
                                                    {patient.patient_email && (
                                                        <p className="text-xs text-gray-500">{patient.patient_email}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                {patient.is_primary ? (
                                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                                                        Primary
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right font-medium">{patient.total_prescriptions}</td>
                                            <td className="py-3 px-4 text-gray-500 text-xs">
                                                {patient.last_prescription
                                                    ? new Date(patient.last_prescription).toLocaleDateString()
                                                    : 'Never'}
                                            </td>
                                            <td className="py-3 px-4 text-gray-500 text-xs">
                                                {new Date(patient.assigned_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'activity' && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200">
                        <h3 className="font-bold text-gray-900">Recent Prescriptions</h3>
                    </div>

                    {recentPrescriptions.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <p>No prescriptions processed yet.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {recentPrescriptions.map(rx => (
                                <div key={rx.id} className="p-4 hover:bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {rx.patient?.full_name || 'Unknown Patient'}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {rx.medications?.length || 0} medications
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${rx.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                                    rx.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                        rx.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-gray-100 text-gray-700'
                                                }`}>
                                                {rx.status}
                                            </span>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {new Date(rx.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PharmacistMetricsPanel;

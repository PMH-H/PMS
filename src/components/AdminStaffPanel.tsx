import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import {
    getStaffByAdmin,
    getAdminMetrics,
    linkStaffToFacility,
    getJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    AdminStaffMember,
    AdminMetrics
} from '../services/userHierarchyService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AdminStaffPanelProps {
    currentUser?: User;
    adminId?: string;
}

const AdminStaffPanel: React.FC<AdminStaffPanelProps> = ({ currentUser, adminId }) => {
    const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
    const [staff, setStaff] = useState<AdminStaffMember[]>([]);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]); // Typed as any for now, should be clearer
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'performance'>('overview');

    // Add Staff Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addEmail, setAddEmail] = useState('');
    const [addStatus, setAddStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [addMessage, setAddMessage] = useState('');

    const userId = adminId || currentUser?.id;

    const loadData = useCallback(async () => {
        if (!userId) return;

        setLoading(true);
        try {
            // Load admin metrics
            const { data: metricsData } = await getAdminMetrics(userId);
            if (metricsData && metricsData.length > 0) {
                setMetrics(metricsData[0]);
            }

            // Load staff
            const { data: staffData } = await getStaffByAdmin(userId);
            setStaff(staffData);

            // Load pending requests
            const { data: requestsData } = await getJoinRequests(metricsData?.[0]?.facility_id || (currentUser as any)?.facility_id);
            setPendingRequests(requestsData);

        } catch (err) {
            console.error('Error loading admin data:', err);
        } finally {
            setLoading(false);
        }
    }, [userId, currentUser]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleApproveRequest = async (requestId: string) => {
        try {
            await approveJoinRequest(requestId);
            loadData(); // Refresh to move user to staff lists
        } catch (err) {
            console.error('Failed to approve:', err);
            alert('Failed to approve request.');
        }
    };

    const handleRejectRequest = async (requestId: string) => {
        if (!confirm('Reject this request?')) return;
        try {
            await rejectJoinRequest(requestId);
            loadData();
        } catch (err) {
            console.error('Failed to reject:', err);
        }
    };

    const handleAddStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddStatus('loading');
        setAddMessage('');

        try {
            await linkStaffToFacility(addEmail);
            setAddStatus('success');
            setAddMessage('Staff member linked successfully!');
            setAddEmail('');
            setTimeout(() => {
                setIsAddModalOpen(false);
                setAddStatus('idle');
                loadData(); // Refresh list
            }, 1500);
        } catch (err: any) {
            console.error(err);
            setAddStatus('error');
            setAddMessage(err.message || 'Failed to link staff member. Check if email is correct.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    const tabs = [
        { key: 'overview', label: 'Facility Overview', icon: '📊' },
        { key: 'staff', label: 'Staff Members', icon: '👥' },
        { key: 'performance', label: 'Performance', icon: '📈' },
    ];

    // Prepare chart data
    const staffChartData = staff.map(s => ({
        name: s.pharmacist_name.split(' ')[0], // First name only
        today: s.prescriptions_today,
        week: s.prescriptions_week,
        patients: s.patient_count,
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold">{metrics?.facility_name || 'Your Facility'}</h2>
                        <p className="text-indigo-200 text-sm">{metrics?.region || 'Region not set'}</p>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-3xl font-bold">{metrics?.total_pharmacists || 0}</p>
                            <p className="text-indigo-200 text-sm">Staff Members</p>
                        </div>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm shadow hover:bg-indigo-50 transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            Add Staff
                        </button>
                    </div>
                </div>
            </div>

            {/* Add Staff Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-900">Add Existing User</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">Enter the email address of a user who has already signed up (Pharmacist role). They will be linked to your facility.</p>

                        <form onSubmit={handleAddStaff}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={addEmail}
                                    onChange={e => setAddEmail(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    placeholder="user@example.com"
                                />
                            </div>

                            {addMessage && (
                                <div className={`mb-4 p-3 rounded-lg text-sm ${addStatus === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                    {addMessage}
                                </div>
                            )}

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={addStatus === 'loading' || addStatus === 'success'}
                                    className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {addStatus === 'loading' && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
                                    {addStatus === 'success' ? 'Added!' : 'Link User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 pb-2 overflow-x-auto hide-scrollbar">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === tab.key
                            ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                        {tab.key === 'staff' && pendingRequests.length > 0 && (
                            <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                                {pendingRequests.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                            <p className="text-xs font-medium text-gray-500 uppercase">Total Staff</p>
                            <p className="text-3xl font-bold text-indigo-600 mt-2">{metrics?.total_pharmacists || 0}</p>
                            <p className="text-xs text-gray-400 mt-1">{metrics?.active_pharmacists_today || 0} active today</p>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                            <p className="text-xs font-medium text-gray-500 uppercase">Total Patients</p>
                            <p className="text-3xl font-bold text-emerald-600 mt-2">{metrics?.total_patients || 0}</p>
                            <p className="text-xs text-gray-400 mt-1">Across all staff</p>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                            <p className="text-xs font-medium text-gray-500 uppercase">Prescriptions Today</p>
                            <p className="text-3xl font-bold text-purple-600 mt-2">{metrics?.prescriptions_today || 0}</p>
                            <p className="text-xs text-gray-400 mt-1">{metrics?.prescriptions_week || 0} this week</p>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                            <p className="text-xs font-medium text-gray-500 uppercase">Total Prescriptions</p>
                            <p className="text-3xl font-bold text-amber-600 mt-2">{metrics?.total_prescriptions || 0}</p>
                            <p className="text-xs text-gray-400 mt-1">All time</p>
                        </div>
                    </div>

                    {/* Inventory Summary */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <h3 className="font-bold text-gray-900 mb-4">Inventory Status</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 bg-emerald-50 rounded-lg text-center">
                                <p className="text-2xl font-bold text-emerald-600">{metrics?.items_in_stock || 0}</p>
                                <p className="text-sm text-emerald-700">In Stock</p>
                            </div>
                            <div className="p-4 bg-amber-50 rounded-lg text-center">
                                <p className="text-2xl font-bold text-amber-600">{metrics?.low_stock_items || 0}</p>
                                <p className="text-sm text-amber-700">Low Stock</p>
                            </div>
                            <div className="p-4 bg-red-50 rounded-lg text-center">
                                <p className="text-2xl font-bold text-red-600">{metrics?.out_of_stock_items || 0}</p>
                                <p className="text-sm text-red-700">Out of Stock</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Staff Tab */}
            {activeTab === 'staff' && (
                <div className="space-y-6">
                    {/* Pending Requests Section */}
                    {pendingRequests.length > 0 && (
                        <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <h3 className="font-bold text-amber-900 mb-4 flex items-center gap-2">
                                <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">{pendingRequests.length}</span>
                                Pending Join Requests
                            </h3>
                            <div className="space-y-3">
                                {pendingRequests.map(req => (
                                    <div key={req.id} className="bg-white p-4 rounded-lg shadow-sm border border-amber-100 flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-gray-900">{req.profiles?.full_name || 'Unknown User'}</p>
                                            <p className="text-sm text-gray-500">{req.profiles?.email}</p>
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase mt-1 inline-block">
                                                {req.profiles?.role}
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleRejectRequest(req.id)}
                                                className="px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => handleApproveRequest(req.id)}
                                                className="px-3 py-1 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
                                            >
                                                Approve
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900">Staff Members ({staff.length})</h3>
                        </div>

                        {staff.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <p>No staff members in your facility.</p>
                                <p className="text-sm mt-1">Add pharmacists to your team to get started.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Staff Member</th>
                                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                                            <th className="text-right py-3 px-4 font-semibold text-gray-700">Patients</th>
                                            <th className="text-right py-3 px-4 font-semibold text-gray-700">Today</th>
                                            <th className="text-right py-3 px-4 font-semibold text-gray-700">This Week</th>
                                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Last Active</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {staff.map(member => (
                                            <tr key={member.pharmacist_id} className="hover:bg-gray-50">
                                                <td className="py-3 px-4">
                                                    <div>
                                                        <p className="font-medium text-gray-900">{member.pharmacist_name}</p>
                                                        {member.pharmacist_email && (
                                                            <p className="text-xs text-gray-500">{member.pharmacist_email}</p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full capitalize">
                                                        {member.role}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right font-medium">{member.patient_count}</td>
                                                <td className="py-3 px-4 text-right">
                                                    <span className={`font-medium ${member.prescriptions_today > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                        {member.prescriptions_today}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right font-medium">{member.prescriptions_week}</td>
                                                <td className="py-3 px-4 text-gray-500 text-xs">
                                                    {member.last_active
                                                        ? new Date(member.last_active).toLocaleString()
                                                        : 'Never'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Performance Tab */}
            {activeTab === 'performance' && (
                <div className="space-y-6">
                    {staff.length > 0 ? (
                        <>
                            {/* Prescriptions Comparison Chart */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6">
                                <h3 className="font-bold text-gray-900 mb-4">Staff Prescriptions Comparison</h3>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={staffChartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip />
                                            <Bar dataKey="today" name="Today" fill="#6366f1" />
                                            <Bar dataKey="week" name="This Week" fill="#a5b4fc" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Patient Distribution */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6">
                                <h3 className="font-bold text-gray-900 mb-4">Patient Distribution</h3>
                                <div className="space-y-3">
                                    {staff.sort((a, b) => b.patient_count - a.patient_count).map(member => {
                                        const maxPatients = Math.max(...staff.map(s => s.patient_count), 1);
                                        return (
                                            <div key={member.pharmacist_id} className="flex items-center gap-4">
                                                <span className="w-32 text-sm text-gray-600 truncate">{member.pharmacist_name}</span>
                                                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 rounded-full transition-all"
                                                        style={{ width: `${(member.patient_count / maxPatients) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="w-12 text-right text-sm font-medium">{member.patient_count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                            <p>No staff data to display.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminStaffPanel;

import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User, UserRole, getRoleDisplayName } from '../types';

interface UserAdminTableProps {
    onUserSelect?: (user: User) => void;
}

const UserAdminTable: React.FC<UserAdminTableProps> = ({ onUserSelect }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [blockReason, setBlockReason] = useState('');
    const [editForm, setEditForm] = useState({ full_name: '', phone: '', role: '' as UserRole });
    const [actionLoading, setActionLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch =
            user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.phone?.includes(searchQuery);

        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'blocked' && user.is_blocked) ||
            (statusFilter === 'active' && !user.is_blocked);

        return matchesSearch && matchesRole && matchesStatus;
    });

    const handleEditUser = (user: User) => {
        setSelectedUser(user);
        setEditForm({
            full_name: user.full_name || '',
            phone: user.phone || '',
            role: user.role,
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!selectedUser) return;
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: editForm.full_name,
                    phone: editForm.phone || null,
                    role: editForm.role,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', selectedUser.id);

            if (error) throw error;

            setFeedback({ message: 'User updated successfully', isError: false });
            setShowEditModal(false);
            fetchUsers();
        } catch (err: any) {
            setFeedback({ message: err.message || 'Failed to update user', isError: true });
        } finally {
            setActionLoading(false);
        }
    };

    const handleBlockUser = (user: User) => {
        setSelectedUser(user);
        setBlockReason('');
        setShowBlockModal(true);
    };

    const confirmBlockUser = async () => {
        if (!selectedUser) return;
        setActionLoading(true);
        try {
            const isBlocking = !selectedUser.is_blocked;
            const { error } = await supabase
                .from('profiles')
                .update({
                    is_blocked: isBlocking,
                    blocked_reason: isBlocking ? blockReason : null,
                    blocked_at: isBlocking ? new Date().toISOString() : null,
                })
                .eq('id', selectedUser.id);

            if (error) throw error;

            setFeedback({
                message: isBlocking ? 'User blocked successfully' : 'User unblocked successfully',
                isError: false
            });
            setShowBlockModal(false);
            fetchUsers();
        } catch (err: any) {
            setFeedback({ message: err.message || 'Action failed', isError: true });
        } finally {
            setActionLoading(false);
        }
    };

    const handleResetPassword = async (user: User) => {
        if (!user.email) {
            setFeedback({ message: 'User has no email address', isError: true });
            return;
        }

        setActionLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (error) throw error;

            setFeedback({ message: `Password reset email sent to ${user.email}`, isError: false });
        } catch (err: any) {
            setFeedback({ message: err.message || 'Failed to send reset email', isError: true });
        } finally {
            setActionLoading(false);
        }
    };

    const getRoleBadgeColor = (role: UserRole) => {
        switch (role) {
            case UserRole.CUSTOMER: return 'bg-blue-100 text-blue-800';
            case UserRole.PHARMACIST: return 'bg-emerald-100 text-emerald-800';
            case UserRole.ADMIN: return 'bg-amber-100 text-amber-800';
            case UserRole.SUPER_ADMIN_BMS: return 'bg-purple-100 text-purple-800';
            case UserRole.SUPER_ADMIN_DEV: return 'bg-slate-800 text-white';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // Clear feedback after 3 seconds
    useEffect(() => {
        if (feedback) {
            const timer = setTimeout(() => setFeedback(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [feedback]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Feedback Toast */}
            {feedback && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-right ${feedback.isError ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                    }`}>
                    {feedback.message}
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search */}
                    <div className="flex-1">
                        <input
                            type="text"
                            placeholder="Search by name, email, or phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                    </div>

                    {/* Role Filter */}
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="all">All Roles</option>
                        <option value={UserRole.CUSTOMER}>Patients</option>
                        <option value={UserRole.PHARMACIST}>Pharmacists</option>
                        <option value={UserRole.ADMIN}>Admins</option>
                        <option value={UserRole.SUPER_ADMIN_BMS}>BMS Admins</option>
                        <option value={UserRole.SUPER_ADMIN_DEV}>Dev Admins</option>
                    </select>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="blocked">Blocked</option>
                    </select>
                </div>

                <div className="mt-3 text-sm text-gray-500">
                    Showing {filteredUsers.length} of {users.length} users
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">User</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden md:table-cell">Email</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Role</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden lg:table-cell">Last Active</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                                {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{user.full_name || 'No Name'}</p>
                                                <p className="text-xs text-gray-500 md:hidden">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{user.email || 'N/A'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                                            {getRoleDisplayName(user.role)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                                        {user.last_active_at
                                            ? new Date(user.last_active_at).toLocaleDateString()
                                            : 'Never'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {user.is_blocked ? (
                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Blocked</span>
                                        ) : (
                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handleEditUser(user)}
                                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                                title="Edit User"
                                            >
                                                <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleBlockUser(user)}
                                                className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${user.is_blocked ? 'text-green-600' : 'text-red-600'}`}
                                                title={user.is_blocked ? 'Unblock User' : 'Block User'}
                                            >
                                                {user.is_blocked ? (
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                    </svg>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleResetPassword(user)}
                                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-amber-600"
                                                title="Reset Password"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredUsers.length === 0 && (
                        <div className="py-8 text-center text-gray-500">
                            No users found matching your criteria
                        </div>
                    )}
                </div>
            </div>

            {/* Edit User Modal */}
            {showEditModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Edit User</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    value={editForm.full_name}
                                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <input
                                    type="tel"
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                <select
                                    value={editForm.role}
                                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value={UserRole.CUSTOMER}>Patient</option>
                                    <option value={UserRole.PHARMACIST}>Pharmacist</option>
                                    <option value={UserRole.ADMIN}>Admin</option>
                                    <option value={UserRole.SUPER_ADMIN_BMS}>BMS Super Admin</option>
                                    <option value={UserRole.SUPER_ADMIN_DEV}>Developer Super Admin</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={actionLoading}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {actionLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Block User Modal */}
            {showBlockModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowBlockModal(false)}>
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                            {selectedUser.is_blocked ? 'Unblock User' : 'Block User'}
                        </h3>
                        <p className="text-gray-600 mb-4">
                            {selectedUser.is_blocked
                                ? `Are you sure you want to unblock ${selectedUser.full_name}?`
                                : `Are you sure you want to block ${selectedUser.full_name}? They will not be able to access the system.`
                            }
                        </p>

                        {!selectedUser.is_blocked && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for blocking</label>
                                <textarea
                                    value={blockReason}
                                    onChange={(e) => setBlockReason(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    rows={3}
                                    placeholder="Enter reason..."
                                />
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowBlockModal(false)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmBlockUser}
                                disabled={actionLoading}
                                className={`flex-1 px-4 py-2 rounded-lg text-white disabled:opacity-50 ${selectedUser.is_blocked ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                                    }`}
                            >
                                {actionLoading ? 'Processing...' : selectedUser.is_blocked ? 'Unblock' : 'Block User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserAdminTable;

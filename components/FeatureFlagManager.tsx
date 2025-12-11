import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { FeatureFlag, UserRole } from '../types';

interface FeatureFlagManagerProps {
    currentUserId: string;
}

const FeatureFlagManager: React.FC<FeatureFlagManagerProps> = ({ currentUserId }) => {
    const [flags, setFlags] = useState<FeatureFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
    const [formData, setFormData] = useState({
        flag_name: '',
        flag_description: '',
        is_enabled: false,
        applies_to_roles: [] as string[],
    });
    const [actionLoading, setActionLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

    useEffect(() => {
        fetchFlags();
    }, []);

    const fetchFlags = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('feature_flags')
                .select('*')
                .order('flag_name', { ascending: true });

            if (error) throw error;
            setFlags(data || []);
        } catch (err: any) {
            console.error('Error fetching flags:', err);
            // If table doesn't exist yet, show empty state
            setFlags([]);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleFlag = async (flag: FeatureFlag) => {
        try {
            const { error } = await supabase
                .from('feature_flags')
                .update({
                    is_enabled: !flag.is_enabled,
                    updated_by: currentUserId,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', flag.id);

            if (error) throw error;

            setFeedback({
                message: `${flag.flag_name} ${!flag.is_enabled ? 'enabled' : 'disabled'}`,
                isError: false
            });
            fetchFlags();
        } catch (err: any) {
            setFeedback({ message: err.message || 'Failed to toggle flag', isError: true });
        }
    };

    const handleAddFlag = () => {
        setEditingFlag(null);
        setFormData({
            flag_name: '',
            flag_description: '',
            is_enabled: false,
            applies_to_roles: [],
        });
        setShowAddModal(true);
    };

    const handleEditFlag = (flag: FeatureFlag) => {
        setEditingFlag(flag);
        setFormData({
            flag_name: flag.flag_name,
            flag_description: flag.flag_description || '',
            is_enabled: flag.is_enabled,
            applies_to_roles: flag.applies_to_roles || [],
        });
        setShowAddModal(true);
    };

    const handleSaveFlag = async () => {
        if (!formData.flag_name.trim()) {
            setFeedback({ message: 'Flag name is required', isError: true });
            return;
        }

        setActionLoading(true);
        try {
            if (editingFlag) {
                // Update existing
                const { error } = await supabase
                    .from('feature_flags')
                    .update({
                        flag_name: formData.flag_name.toLowerCase().replace(/\s+/g, '_'),
                        flag_description: formData.flag_description,
                        is_enabled: formData.is_enabled,
                        applies_to_roles: formData.applies_to_roles,
                        updated_by: currentUserId,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingFlag.id);

                if (error) throw error;
                setFeedback({ message: 'Feature flag updated', isError: false });
            } else {
                // Create new
                const { error } = await supabase
                    .from('feature_flags')
                    .insert({
                        flag_name: formData.flag_name.toLowerCase().replace(/\s+/g, '_'),
                        flag_description: formData.flag_description,
                        is_enabled: formData.is_enabled,
                        applies_to_roles: formData.applies_to_roles,
                        created_by: currentUserId,
                        updated_by: currentUserId,
                    });

                if (error) throw error;
                setFeedback({ message: 'Feature flag created', isError: false });
            }

            setShowAddModal(false);
            fetchFlags();
        } catch (err: any) {
            setFeedback({ message: err.message || 'Failed to save flag', isError: true });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteFlag = async (flag: FeatureFlag) => {
        if (!confirm(`Delete feature flag "${flag.flag_name}"?`)) return;

        try {
            const { error } = await supabase
                .from('feature_flags')
                .delete()
                .eq('id', flag.id);

            if (error) throw error;

            setFeedback({ message: 'Feature flag deleted', isError: false });
            fetchFlags();
        } catch (err: any) {
            setFeedback({ message: err.message || 'Failed to delete flag', isError: true });
        }
    };

    const toggleRole = (role: string) => {
        setFormData(prev => ({
            ...prev,
            applies_to_roles: prev.applies_to_roles.includes(role)
                ? prev.applies_to_roles.filter(r => r !== role)
                : [...prev.applies_to_roles, role],
        }));
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

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Feature Flags</h2>
                    <p className="text-sm text-gray-500">Control feature rollouts and system settings</p>
                </div>
                <button
                    onClick={handleAddFlag}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                    <span>+</span> Add Flag
                </button>
            </div>

            {/* Flags Grid */}
            {flags.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <div className="text-4xl mb-3">🚩</div>
                    <p className="text-gray-600">No feature flags yet.</p>
                    <p className="text-sm text-gray-400 mt-1">Run migration 035 to create default flags.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {flags.map(flag => (
                        <div
                            key={flag.id}
                            className={`bg-white rounded-xl border ${flag.is_enabled ? 'border-green-200' : 'border-gray-200'} p-4 transition-all hover:shadow-md`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900 text-sm">{flag.flag_name}</h3>
                                    {flag.flag_description && (
                                        <p className="text-xs text-gray-500 mt-1">{flag.flag_description}</p>
                                    )}
                                </div>

                                {/* Toggle Switch */}
                                <button
                                    onClick={() => handleToggleFlag(flag)}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${flag.is_enabled ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                >
                                    <span
                                        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${flag.is_enabled ? 'translate-x-7' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>

                            {/* Role Tags */}
                            {flag.applies_to_roles && flag.applies_to_roles.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                    {flag.applies_to_roles.map(role => (
                                        <span key={role} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                                            {role.replace('_', ' ')}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                <button
                                    onClick={() => handleEditFlag(flag)}
                                    className="text-xs text-gray-500 hover:text-indigo-600 transition-colors"
                                >
                                    Edit
                                </button>
                                <span className="text-gray-300">|</span>
                                <button
                                    onClick={() => handleDeleteFlag(flag)}
                                    className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-gray-900 mb-4">
                            {editingFlag ? 'Edit Feature Flag' : 'New Feature Flag'}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Flag Name</label>
                                <input
                                    type="text"
                                    value={formData.flag_name}
                                    onChange={(e) => setFormData({ ...formData, flag_name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="e.g. dark_mode"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={formData.flag_description}
                                    onChange={(e) => setFormData({ ...formData, flag_description: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    rows={2}
                                    placeholder="What does this flag control?"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Applies to Roles</label>
                                <div className="flex flex-wrap gap-2">
                                    {Object.values(UserRole).map(role => (
                                        <button
                                            key={role}
                                            type="button"
                                            onClick={() => toggleRole(role)}
                                            className={`px-3 py-1 text-xs rounded-full transition-colors ${formData.applies_to_roles.includes(role)
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {role.replace(/_/g, ' ')}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Leave empty to apply to all roles</p>
                            </div>

                            <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_enabled}
                                        onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                                <span className="text-sm text-gray-700">Enable by default</span>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveFlag}
                                disabled={actionLoading}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {actionLoading ? 'Saving...' : editingFlag ? 'Update Flag' : 'Create Flag'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FeatureFlagManager;

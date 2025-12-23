import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';

interface LinkedProfile {
    id: string;
    primary_user_id: string;
    linked_user_id: string | null;
    relationship: 'child' | 'parent' | 'spouse' | 'caregiver' | 'other';
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    invite_email?: string;
    linked_user?: {
        full_name: string;
        avatar_url?: string;
    };
    created_at: string;
}

interface FamilyManagerProps {
    currentUser: User;
}

const FamilyManager: React.FC<FamilyManagerProps> = ({ currentUser }) => {
    const [links, setLinks] = useState<LinkedProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    // Invite Form State
    const [inviteEmail, setInviteEmail] = useState('');
    const [relationship, setRelationship] = useState<string>('child');

    useEffect(() => {
        fetchLinks();
    }, [currentUser.id]);

    const fetchLinks = async () => {
        setLoading(true);
        try {
            // Fetch profiles where I am the primary user (I invited them)
            const { data, error } = await supabase
                .from('linked_profiles')
                .select('*, linked_user:profiles!linked_profiles_linked_user_id_fkey(full_name, avatar_url)')
                .eq('primary_user_id', currentUser.id);

            if (error) throw error;
            setLinks(data || []);
        } catch (err) {
            console.error('Error fetching family links:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Simple invite logic: just create the record with the email
            // In a real app, this would trigger an email via Edge Function
            const { error } = await supabase.from('linked_profiles').insert({
                primary_user_id: currentUser.id,
                invite_email: inviteEmail,
                relationship,
                status: 'PENDING'
            });

            if (error) throw error;

            alert('Invitation sent! (Simulated)');
            setIsInviteModalOpen(false);
            setInviteEmail('');
            fetchLinks(); // Refresh
        } catch (err: any) {
            alert('Error sending invite: ' + err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this family member?')) return;
        try {
            const { error } = await supabase.from('linked_profiles').delete().eq('id', id);
            if (error) throw error;
            setLinks(prev => prev.filter(l => l.id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <span>👨‍👩‍👧‍👦</span> Family & Care Team
                </h3>
                <button
                    onClick={() => setIsInviteModalOpen(true)}
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition"
                >
                    + Add Member
                </button>
            </div>

            <div className="p-4">
                {loading ? (
                    <div className="text-center py-4 text-gray-500">Loading family members...</div>
                ) : links.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        <p>No family members linked yet.</p>
                        <p className="text-xs mt-1">Add children or parents to manage their health.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {links.map(link => (
                            <div key={link.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                        {link.linked_user?.full_name?.charAt(0) || link.invite_email?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">
                                            {link.linked_user?.full_name || link.invite_email}
                                        </p>
                                        <p className="text-xs text-gray-500 capitalize">
                                            {link.relationship} • {link.status.toLowerCase()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {link.status === 'ACCEPTED' && (
                                        <button className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100">
                                            View Profile
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(link.id)}
                                        className="text-gray-400 hover:text-red-500 p-1"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Invite Modal */}
            {isInviteModalOpen && (
                <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95">
                        <h3 className="text-lg font-bold mb-4">Invite Family Member</h3>
                        <form onSubmit={handleInvite} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
                                <input
                                    type="email" required
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="member@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Relationship</label>
                                <select
                                    value={relationship}
                                    onChange={e => setRelationship(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="child">Child</option>
                                    <option value="parent">Parent</option>
                                    <option value="spouse">Spouse</option>
                                    <option value="caregiver">Caregiver</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsInviteModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold"
                                >
                                    Send Invite
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FamilyManager;

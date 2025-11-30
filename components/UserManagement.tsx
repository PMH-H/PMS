import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { UserRole } from '../types';

const UserManagement: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.SUPER_ADMIN_BMS);
    const [loading, setLoading] = useState(false);

    const superAdminRoles = [
        { value: UserRole.SUPER_ADMIN_BMS, label: 'BMS Administrator' },
        { value: UserRole.SUPER_ADMIN_DEV, label: 'System Administrator' }
    ];

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase.functions.invoke('create-super-admin', {
                body: {
                    email,
                    password,
                    role: selectedRole.toLowerCase(),
                    fullName
                }
            });

            if (error) throw error;

            alert(`Successfully created user: ${email}`);
            setEmail('');
            setPassword('');
            setFullName('');

        } catch (error: any) {
            console.error('Error creating user:', error);
            alert(`Failed to create user: ${error.message || error}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Create Super Admin</h3>

            <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Email
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Password
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        required
                        minLength={8}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Full Name
                    </label>
                    <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Role
                    </label>
                    <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    >
                        {superAdminRoles.map(role => (
                            <option key={role.value} value={role.value}>
                                {role.label}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                    {loading ? 'Creating...' : 'Create Super Admin'}
                </button>
            </form>


        </div>
    );
};

export default UserManagement;

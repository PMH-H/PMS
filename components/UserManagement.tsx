import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { UserRole } from '../types';

const UserManagement: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.SUPER_ADMIN_BMS);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', isError: false });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback({ message: '', isError: false });

    if (password.length < 6) {
      setFeedback({ message: 'Password must be at least 6 characters long.', isError: true });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
      });

      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ role: role })
          .eq('id', data.user.id);

        if (profileError) throw profileError;

        setFeedback({ message: `Successfully created user: ${email} with role ${role}.`, isError: false });
        setEmail('');
        setPassword('');
      } else {
        throw new Error('User creation returned no data.');
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      setFeedback({ message: `Error: ${error.message || 'An unknown error occurred.'}`, isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
      <h3 className="text-xl font-bold text-slate-900 mb-6">Create Super Admin User</h3>
      <form onSubmit={handleCreateUser} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Temporary Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
          >
            <option value={UserRole.SUPER_ADMIN_BMS}>BMS Super Admin</option>
            <option value={UserRole.SUPER_ADMIN_DEV}>Developer Super Admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating User...' : 'Create User'}
        </button>
        {feedback.message && (
          <p className={`text-sm mt-4 text-center font-medium ${feedback.isError ? 'text-red-600' : 'text-green-600'}`}>
            {feedback.message}
          </p>
        )}
      </form>
    </div>
  );
};

export default UserManagement;

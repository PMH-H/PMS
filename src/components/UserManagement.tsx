import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { UserRole } from '../types';

const UserManagement: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.SUPER_ADMIN_BMS);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', isError: false });
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  React.useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, email, phone')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setUsers(data);
    }
  };

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
        fetchUsers(); // Refresh list
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

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setFeedback({ message: 'Role updated successfully.', isError: false });
      fetchUsers(); // Refresh list
    } catch (error: any) {
      setFeedback({ message: 'Update failed: ' + error.message, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
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

      {/* User List Section */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-900">Existing Users</h3>
          <input
            type="text"
            placeholder="Search users..."
            className="px-4 py-2 border rounded-lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="p-3">Name</th>
                <th className="p-3">Role</th>
                <th className="p-3">ID</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.id} className="border-b hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-medium">{user.full_name || 'No Name'}</div>
                    <div className="text-sm text-slate-500">{user.email}</div>
                  </td>
                  <td className="p-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleUpdateRole(user.id, e.target.value as UserRole)}
                      className="px-2 py-1 border rounded text-sm"
                      disabled={loading}
                    >
                      {Object.values(UserRole).map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-xs font-mono text-slate-400">{user.id.substring(0, 8)}...</td>
                  <td className="p-3">
                    <button
                      onClick={() => { setSelectedUser(user); setShowResetModal(true); }}
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                    >
                      Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset Modal */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-96 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Reset Password for {selectedUser.full_name}</h3>
            <p className="text-sm text-slate-500 mb-4">Enter a new temporary password for this user. This action will be audited.</p>
            <input
              type="text"
              placeholder="New Password"
              className="w-full border p-2 rounded mb-4"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={!resetPassword || loading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

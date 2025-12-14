import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { User, getRoleDisplayName } from '../types';

interface ProfileSettingsProps {
  currentUser: User;
  onUpdate: (user: User) => void;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ currentUser, onUpdate }) => {
  const [fullName, setFullName] = useState(currentUser.full_name);
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      alert("Password updated successfully");
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error("Error updating password:", error);
      alert("Failed to update password: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);
      if (error) throw error;
      onUpdate({ ...currentUser, full_name: fullName, phone: phone || undefined });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Profile Settings</h2>
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Personal Info Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Personal Information</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Account Type
              </label>
              <input
                type="text"
                value={getRoleDisplayName(currentUser.role)}
                disabled
                className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-500 cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-1">
                Contact support to change your account type
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                placeholder="+260 97 000 0000"
              />
            </div>
          </div>

          {/* Preferences Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Preferences & Privacy</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <div className="font-medium text-slate-900">AI Features</div>
                  <div className="text-xs text-slate-500">Allow AI to analyze your data for insights</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked={currentUser.privacySettings?.allowAI} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <div className="font-medium text-slate-900">Share Usage Data</div>
                  <div className="text-xs text-slate-500">Help us improve PharmAI by sharing anonymous usage stats</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked={currentUser.privacySettings?.shareBrowsing} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </div>


          {/* Security Tools Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Security Tools</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="p-4 border border-slate-200 rounded-xl hover:bg-slate-50 text-left group transition-colors"
              >
                <div className="font-bold text-slate-900 group-hover:text-emerald-600">Change Password</div>
                <div className="text-xs text-slate-500 mt-1">Update your login credentials</div>
              </button>
              <button type="button" className="p-4 border border-slate-200 rounded-xl hover:bg-slate-50 text-left group transition-colors">
                <div className="font-bold text-slate-900 group-hover:text-emerald-600">Active Sessions</div>
                <div className="text-xs text-slate-500 mt-1">Manage devices logged into your account</div>
              </button>
              <button type="button" className="p-4 border border-slate-200 rounded-xl hover:bg-slate-50 text-left group transition-colors">
                <div className="font-bold text-slate-900 group-hover:text-emerald-600">Export Data</div>
                <div className="text-xs text-slate-500 mt-1">Download a copy of your personal data</div>
              </button>
              <button type="button" className="p-4 border border-red-200 rounded-xl hover:bg-red-50 text-left group transition-colors">
                <div className="font-bold text-red-600">Delete Account</div>
                <div className="text-xs text-red-400 mt-1">Permanently remove your account</div>
              </button>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-emerald-200"
            >
              {loading ? 'Saving Changes...' : success ? '✓ Settings Saved!' : 'Save All Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-96 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Change Password</h3>
            <form onSubmit={handlePasswordChange}>
              <input
                type="password"
                placeholder="New Password"
                className="w-full border p-2 rounded mb-3"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
              <input
                type="password"
                placeholder="Confirm New Password"
                className="w-full border p-2 rounded mb-4"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowPasswordModal(false); setNewPassword(''); setConfirmPassword(''); }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !newPassword}
                  className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProfileSettings;

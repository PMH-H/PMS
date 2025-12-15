import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { UserRole } from '../types';

const CreateUserForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.CUSTOMER);
  const [facilityId, setFacilityId] = useState<string>('');
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', isError: false });

  useEffect(() => {
    const fetchFacilities = async () => {
      const { data, error } = await supabase.from('facilities').select('id, name');
      if (error) {
        console.error('Error fetching facilities:', error);
      } else {
        setFacilities(data);
      }
    };
    fetchFacilities();
  }, []);

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
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
      });

      if (authError) throw authError;

      if (authData.user) {
        const profileData: { role: UserRole; full_name: string; facility_id?: string } = {
          role: role,
          full_name: fullName,
        };
        if (role === UserRole.PHARMACIST || role === UserRole.ADMIN) {
          profileData.facility_id = facilityId;
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', authData.user.id);

        if (profileError) throw profileError;

        setFeedback({ message: `Successfully created user: ${email} with role ${role}.`, isError: false });
        setEmail('');
        setPassword('');
        setFullName('');
        setRole(UserRole.CUSTOMER);
        setFacilityId('');
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
    <form onSubmit={handleCreateUser} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          required
        />
      </div>
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
          {Object.values(UserRole).map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>
      {(role === UserRole.PHARMACIST || role === UserRole.ADMIN) && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Facility</label>
          <select
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            required
          >
            <option value="">Select a facility</option>
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <button
        type="submit"
        disabled={loading || !email || !password || !fullName}
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
  );
};

export default CreateUserForm;

import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { UserRole, getRoleDisplayName } from '../types';

interface ProfileSetupProps {
  userId: string;
  email: string;
  onProfileCreated: () => void;
  allowRoleSelection?: boolean; // For signup vs settings
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ userId, email, onProfileCreated, allowRoleSelection = true }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.CUSTOMER);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'role' | 'profile'>('role');

  // Available roles for signup
  const signupRoles = [
    { value: UserRole.CUSTOMER, label: 'Patient', description: 'I want to manage my prescriptions and health' },
    { value: UserRole.PHARMACIST, label: 'Pharmacist', description: 'I work at a pharmacy and manage inventory' },
    { value: UserRole.ADMIN, label: 'Shop Owner', description: 'I own/manage a pharmacy' }
  ];

  const handleRoleSelection = (role: UserRole) => {
    setSelectedRole(role);
    setStep('profile');
  };

  const handleSkipProfile = async () => {
    // Create minimal profile with just role
    await createProfile({ full_name: email.split('@')[0] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProfile({ full_name: fullName, phone });
  };

  const createProfile = async (data: { full_name: string; phone?: string }) => {
    setLoading(true);
    setError('');
    try {
      const defaultProfile = {
        id: userId,
        full_name: data.full_name,
        phone: data.phone || null,
        role: selectedRole,
        preferences: {
          shareBrowsing: true,
          sharePurchaseHistory: true,
          allowAI: true,
          anonymousMode: false,
          allowCamera: false
        }
      };
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([defaultProfile]);

      if (insertError) {
        throw insertError;
      }
      onProfileCreated();
    } catch (err: any) {
      console.error("Error creating profile:", err);
      if (err.code === '23505') {
        console.log("Profile already exists, reloading...");
        window.location.reload();
        return;
      }
      setError(err.message || "Failed to create profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-2xl w-full">
        {/* Step 1: Role Selection */}
        {step === 'role' && allowRoleSelection && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome to PharmAI</h1>
              <p className="text-slate-600">Choose your account type to get started</p>
            </div>
            <div className="space-y-4">
              {signupRoles.map(role => (
                <button
                  key={role.value}
                  onClick={() => handleRoleSelection(role.value)}
                  className="w-full p-6 border-2 border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600">
                        {role.label}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">{role.description}</p>
                    </div>
                    <svg
                      className="w-6 h-6 text-slate-400 group-hover:text-emerald-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Profile Information */}
        {step === 'profile' && (
          <>
            <div className="text-center mb-8">
               <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
                 <span className="text-2xl">
                   {selectedRole === UserRole.CUSTOMER ? '👤' : selectedRole === UserRole.PHARMACIST ? '💊' : '🏪'}
                 </span>
               </div>
              <h1 className="text-2xl font-bold text-slate-900">Complete Your Profile</h1>
              <p className="text-slate-500 mt-2">
                Signing up as <span className="font-semibold text-emerald-600">{getRoleDisplayName(selectedRole)}</span>
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="text"
                  value={email}
                  disabled
                  className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name <span className="text-red-500"></span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="Enter your full name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone Number <span className="text-slate-400 text-xs">(Optional)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="+260 97 000 0000"
                />
              </div>

              <div className="flex gap-3">
                 <button
                    type="button"
                    onClick={handleSkipProfile}
                    disabled={loading}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
                  >
                   Skip for Now
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !fullName}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating Profile...' : 'Complete Setup'}
                  </button>
              </div>
            </form>
            {allowRoleSelection && (
               <button onClick={() => setStep('role')} className="mt-4 text-sm text-slate-500 hover:text-slate-700 w-full text-center">
                ← Change account type
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileSetup;

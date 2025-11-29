import React, { useState } from 'react';
import { supabase } from '../services/supabase';

interface ProfileSetupProps {
    userId: string;
    email: string;
    onProfileCreated: () => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ userId, email, onProfileCreated }) => {
    const [fullName, setFullName] = useState(email.split('@')[0]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const defaultProfile = {
                id: userId,
                full_name: fullName,
                role: 'customer', // Default role
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

            // If profile already exists (duplicate key error), just reload
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
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">Complete Your Profile</h1>
                    <p className="text-slate-500 mt-2">Please set up your account details to continue.</p>
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
                            Full Name
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

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creating Profile...' : 'Get Started'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ProfileSetup;

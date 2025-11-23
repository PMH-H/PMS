
import React from 'react';
import { UserRole, User } from '../types';

interface NavbarProps {
  currentUser: User;
}

const Navbar: React.FC<NavbarProps> = ({ currentUser }) => {
  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case UserRole.CUSTOMER: return 'Patient Portal';
      case UserRole.PHARMACIST: return 'Pharmacist Dashboard';
      case UserRole.ADMIN: return 'Admin Console';
      case UserRole.SUPER_ADMIN_BMS: return 'BMS Command Center';
      case UserRole.SUPER_ADMIN_DEV: return 'System Architect Console';
      default: return 'App';
    }
  };

  const handleSignOut = async () => {
    const { error } = await import('../services/supabase').then(m => m.signOut());
    if (error) console.error('Error signing out:', error);
    window.location.reload();
  };

  return (
    <nav className="bg-indigo-700 text-white shadow-lg sticky top-0 z-50 backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center gap-2">
              <img src="/assets/logo.png" alt="PharmAI" className="h-8 w-auto bg-white/10 rounded p-1" />
              <span className="font-bold text-2xl tracking-tight">
                Pharm<span className="text-indigo-300">AI</span>
              </span>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <span className={`px-3 py-2 rounded-md text-sm font-medium ${currentUser.role === UserRole.SUPER_ADMIN_BMS ? 'bg-purple-900 text-purple-100 border border-purple-500' :
                  currentUser.role === UserRole.SUPER_ADMIN_DEV ? 'bg-slate-900 text-slate-100 border border-slate-500' : 'bg-indigo-800'
                  }`}>
                  {getRoleLabel(currentUser.role)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-indigo-200 hidden sm:block">
              Logged in as: <span className="font-semibold text-white">{currentUser.name}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="bg-indigo-800 hover:bg-indigo-600 px-3 py-1 rounded text-xs border border-indigo-500 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

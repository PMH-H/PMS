
import React from 'react';
import { UserRole, User } from '../types';

interface NavbarProps {
  currentUser: User;
  onSwitchRole: (role: UserRole) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentUser, onSwitchRole }) => {
  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case UserRole.PATIENT: return 'Patient Portal';
      case UserRole.PHARMACIST: return 'Pharmacist Dashboard';
      case UserRole.ADMIN: return 'Admin Console';
      case UserRole.SUPER_ADMIN: return 'BMS Command Center';
      case UserRole.SUPER_ADMIN_DEV: return 'System Architect Console';
      default: return 'App';
    }
  };

  return (
    <nav className="bg-indigo-700 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 font-bold text-2xl tracking-tight">
              Pharm<span className="text-indigo-300">AI</span>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <span className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentUser.role === UserRole.SUPER_ADMIN ? 'bg-purple-900 text-purple-100 border border-purple-500' :
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
            <div className="relative group">
                <button className="bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded text-xs border border-indigo-500">
                    Switch Role
                </button>
                <div className="absolute right-0 mt-0 w-48 bg-white rounded-md shadow-lg py-1 hidden group-hover:block border border-gray-200 z-50">
                    {Object.values(UserRole).map((role) => (
                        <button
                            key={role}
                            onClick={() => onSwitchRole(role)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                            {role.replace(/_/g, ' ')}
                        </button>
                    ))}
                </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

import React, { useState, useRef, useEffect } from 'react';
import { UserRole, User } from '../types';
import { useShop } from '../context/ShopContext';
import { ShoppingCart } from 'lucide-react';
import { CartDrawer } from './CartDrawer';

interface NavbarProps {
  currentUser: User;
  onNavigateToProfile?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentUser, onNavigateToProfile }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { itemCount } = useShop();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.CUSTOMER: return 'bg-emerald-100 text-emerald-800';
      case UserRole.PHARMACIST: return 'bg-indigo-100 text-indigo-800';
      case UserRole.ADMIN: return 'bg-amber-100 text-amber-800';
      case UserRole.SUPER_ADMIN_BMS: return 'bg-purple-100 text-purple-800';
      case UserRole.SUPER_ADMIN_DEV: return 'bg-slate-100 text-slate-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSignOut = async () => {
    try {
      const { supabase } = await import('../services/supabase');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        alert('Error signing out. Please try again.');
        return;
      }
      // Clear local storage and reload
      localStorage.removeItem('pharmai_cart');
      window.location.href = '/';
    } catch (err) {
      console.error('Sign out error:', err);
      // Force logout anyway
      localStorage.clear();
      window.location.href = '/';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <nav className="bg-indigo-700 text-white shadow-lg sticky top-0 z-50 backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center gap-2">
              <img src="/assets/logo.png" alt="PharmAI" className="h-7 sm:h-8 w-auto bg-white/10 rounded p-1" />
              <span className="font-bold text-xl sm:text-2xl tracking-tight">
                Pharm<span className="text-indigo-300">AI</span>
              </span>
            </div>
            {/* Role Badge - Hidden on mobile */}
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

          {/* Cart Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="p-2 mr-2 sm:mr-4 rounded-full hover:bg-indigo-600 transition-colors relative focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <ShoppingCart size={22} />
            {itemCount > 0 && (
              <span className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm animate-in zoom-in">
                {itemCount}
              </span>
            )}
          </button>

          {/* Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-lg hover:bg-indigo-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {/* Avatar */}
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-bold border-2 border-indigo-300">
                {getInitials(currentUser.name || currentUser.full_name || 'U')}
              </div>
              {/* Name - Hidden on mobile */}
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-white truncate max-w-[120px]">{currentUser.name || currentUser.full_name}</p>
                <p className="text-xs text-indigo-200 truncate max-w-[120px]">{currentUser.email}</p>
              </div>
              {/* Dropdown Arrow */}
              <svg className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 sm:w-72 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* User Info Header */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="font-semibold text-gray-900 truncate">{currentUser.name || currentUser.full_name}</p>
                  <p className="text-sm text-gray-500 truncate">{currentUser.email}</p>
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(currentUser.role)}`}>
                    {getRoleLabel(currentUser.role)}
                  </span>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onNavigateToProfile?.();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <div>
                      <p className="font-medium">Profile Settings</p>
                      <p className="text-xs text-gray-500">Update your personal info</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setIsDropdownOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <div>
                      <p className="font-medium">Notifications</p>
                      <p className="text-xs text-gray-500">Manage alert preferences</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setIsDropdownOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <div>
                      <p className="font-medium">Privacy & Security</p>
                      <p className="text-xs text-gray-500">Manage account security</p>
                    </div>
                  </button>
                </div>

                {/* Sign Out */}
                <div className="border-t border-gray-100 pt-2 mt-1">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <div>
                      <p className="font-medium">Sign Out</p>
                      <p className="text-xs text-red-400">Log out of your account</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} currentUser={currentUser} />
    </nav>
  );
};

export default Navbar;

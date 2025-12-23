

import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import Navbar from '@/components/Navbar';
import ChatAssistant from '@/components/ChatAssistant';
import Login from '@/components/Login';
import ProfileSetup from '@/components/ProfileSetup';
import ProfileSettings from '@/pages/ProfileSettings';
import { NotificationProvider } from '@/context/NotificationContext';
import { AppProvider } from '@/context/AppContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { ShopProvider } from '@/context/ShopContext';


const PatientDashboard = React.lazy(() => import('@/pages/PatientDashboard'));
const PharmacistDashboard = React.lazy(() => import('@/pages/PharmacistDashboard'));
const AdminDashboard = React.lazy(() => import('@/pages/AdminDashboard'));
const SuperAdminDashboard = React.lazy(() => import('@/pages/SuperAdminDashboard'));
const DevDashboard = React.lazy(() => import('@/pages/DevDashboard'));
const PrescriberDashboard = React.lazy(() => import('@/components/prescriber/PrescriberDashboard'));

import { supabase } from '@/services/supabase';
import {
  processSale,
  createPrescription,
  updatePrescriptionStatus,
  createSearchLog,
  createAuditLog
} from '@/services/database';
import { UserRole, User, Prescription, Notification, Drug, DrugBatch, Sale, AuditLog, SearchLog, InventoryItem, PrescriberProfile } from '@/types';
import { useIdleTimer } from '@/hooks/useIdleTimer';
import { useDashboardData } from '@/hooks/useDashboardData';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [prescriberProfile, setPrescriberProfile] = useState<PrescriberProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [pendingUserData, setPendingUserData] = useState<{ userId: string; email: string } | null>(null);

  const {
    prescriptions,
    inventory,
    batches,
    sales,
    loading: dataLoading,
    adminMetrics,
    refresh
  } = useDashboardData(currentUser);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setPrescriberProfile(null);
  };

  useIdleTimer(handleLogout, 15 * 60 * 1000);

  // Realtime is now handled in NotificationContext and specific hooks
  // But we might want to trigger a data refresh on certain events?
  // ideally useDashboardData should handle its own subscriptions or we pass a signal.
  // For now, relying on NotificationContext to notify user, and they might refresh, or we can add auto-refresh logic later.

  useEffect(() => {
    const initializeApp = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchUserProfile(session.user.id, session.user.email || '');
      } else {
        setAuthLoading(false);
      }
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user && !currentUser) {
          fetchUserProfile(session.user.id, session.user.email || '');
        } else if (!session?.user && currentUser) {
          setCurrentUser(null);
          setPrescriberProfile(null);
        }
      });
      return () => subscription.unsubscribe();
    };
    initializeApp();
  }, []);

  const fetchUserProfile = async (userId: string, email: string) => {
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const user: User = {
          id: data.id,
          full_name: data.full_name || (typeof email === 'string' ? email.split('@')[0] : 'New User'),
          phone: data.phone,
          role: data.role as UserRole,
          facility_id: data.facility_id,
          avatar: data.avatar_url,
          privacySettings: data.preferences || {}
        };
        setCurrentUser(user);

        if (user.role === UserRole.PRESCRIBER) {
          const { data: profile, error: profileError } = await supabase
            .from('prescriber_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (profileError && profileError.code !== 'PGRST116') {
            console.error("Error fetching prescriber profile:", profileError);
          } else {
            setPrescriberProfile(profile as PrescriberProfile);
          }
        }

      } else {
        setPendingUserData({ userId, email });
        setShowProfileSetup(true);
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      await supabase.auth.signOut();
      setCurrentUser(null);
      setPrescriberProfile(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleProfileCreated = () => {
    setShowProfileSetup(false);
    if (pendingUserData) {
      fetchUserProfile(pendingUserData.userId, pendingUserData.email);
    }
  };

  const [showProfileModal, setShowProfileModal] = useState(false);
  const loading = authLoading || (currentUser && dataLoading && currentUser.role !== UserRole.PRESCRIBER); // Prescriber manages own loading

  if (authLoading) {
    const tips = [
      "💊 PharmAI uses AI to detect drug interactions",
      "📦 Track your inventory with ABC analysis",
      "🔒 Your data is encrypted and secure",
      "📱 Works offline for essential features"
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-blue-50">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-200 rounded-full animate-pulse"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-emerald-600 rounded-full animate-spin"></div>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Loading PharmAI</h2>
            <p className="text-sm text-gray-500 max-w-xs">{randomTip}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return showProfileSetup && pendingUserData ?
      <ProfileSetup userId={pendingUserData.userId} email={pendingUserData.email} onProfileCreated={handleProfileCreated} /> :
      <Login />;
  }

  const renderDashboard = () => {
    const commonProps = { currentUser: currentUser!, onUpdateUser: setCurrentUser };

    const safeDrugs = Array.isArray(inventory) ? inventory : [];
    const safeBatches = Array.isArray(batches) ? batches : [];

    const inventorySummary: InventoryItem[] = safeDrugs.map(drug => {
      // Get all batches for this drug
      const drugBatches = safeBatches.filter(b => b.item_id === drug.id);
      const currentStock = drugBatches.reduce((sum, b) => sum + (b.current_quantity || 0), 0);
      // Get cost from latest batch (or average if needed)
      const latestBatch = drugBatches.sort((a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )[0];
      const costPerUnit = latestBatch?.cost_per_unit || 0;
      // Get earliest expiry date from batches
      const expiryDates = drugBatches.map(b => b.expiry_date).filter(Boolean);
      const earliestExpiry = expiryDates.length > 0
        ? expiryDates.sort()[0]
        : 'N/A';

      return {
        id: drug.id,
        name: drug.name,
        unit: drug.unit,
        category: drug.category,
        currentStock,
        expirationDate: earliestExpiry,
        minLevel: (drug as any).min_level || 10,  // From items table
        maxLevel: (drug as any).max_level || 100, // From items table
        leadTime: (drug as any).lead_time || 7,   // From items table
        costPerUnit,
        abcCategory: drug.category || 'C'
      };
    });

    // Create inventory with prices for customer shop
    const inventoryWithPrices = safeDrugs.map(drug => {
      const drugBatches = safeBatches.filter(b => b.item_id === drug.id);
      const latestBatch = drugBatches.sort((a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )[0];
      return {
        ...drug,
        price_cents: latestBatch?.cost_per_unit || drug.price_cents || 0
      };
    });

    switch (currentUser.role) {
      case UserRole.CUSTOMER:
        return <PatientDashboard {...commonProps} prescriptions={prescriptions} inventory={inventoryWithPrices} inventoryStock={batches} onAddPrescription={(p) => createPrescription(p as any)} logAIAction={() => { }} notifications={[]} onMarkNotificationAsRead={(id) => { }} userPrivacy={currentUser.privacySettings} onUpdatePrivacy={(s) => { }} onLogSearch={() => { }} />;
      case UserRole.PHARMACIST:
        return <PharmacistDashboard {...commonProps} inventory={inventorySummary} alerts={[]} sales={sales} prescriptions={prescriptions} onAddPrescription={(p) => createPrescription(p as any)} onProcessSale={(s) => processSale(currentUser.facility_id!, s as any)} onUpdateStatus={(id, s) => updatePrescriptionStatus(id, s)} onAddInventory={(item) => { }} onUpdateInventory={(id, updates) => { }} onDeleteInventory={(id) => { }} onReconcileInventory={(id, count) => { }} />;
      case UserRole.ADMIN:
        return <AdminDashboard {...commonProps} inventory={inventorySummary} alerts={[]} sales={sales} staff={[]} onAddStaff={(s) => { }} onUpdateStaff={(s) => { }} />;
      case UserRole.SUPER_ADMIN_BMS:
        return <SuperAdminDashboard {...commonProps} metrics={adminMetrics} />;
      case UserRole.SUPER_ADMIN_DEV:
        return <DevDashboard {...commonProps} metrics={adminMetrics} />;
      case UserRole.PRESCRIBER:
        if (!prescriberProfile) {
          return <div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div><div>Loading prescriber profile...</div></div>;
        }
        return <PrescriberDashboard {...commonProps} prescriberProfile={prescriberProfile} />;
      default:
        return <div>Unsupported role. Please contact support.</div>;
    }
  };

  return (
    <AppProvider>
      <ShopProvider>
        <LanguageProvider>
          <NotificationProvider currentUser={currentUser}>
            <div className="min-h-screen bg-slate-50 font-sans">
              <Toaster richColors position="top-center" closeButton />
              <Navbar currentUser={currentUser} onNavigateToProfile={() => setShowProfileModal(true)} />
              <main className="pb-20">
                <React.Suspense fallback={
                  <div className="flex items-center justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  </div>
                }>
                  {renderDashboard()}
                </React.Suspense>
              </main>
              {currentUser && currentUser.role !== UserRole.CUSTOMER && <ChatAssistant role={currentUser.role} />}

              {showProfileModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowProfileModal(false)}>
                  <div
                    className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
                      <h2 className="text-lg font-bold text-gray-900">Profile Settings</h2>
                      <button
                        onClick={() => setShowProfileModal(false)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="p-4">
                      <ProfileSettings
                        currentUser={currentUser}
                        onUpdate={(updatedUser) => {
                          setCurrentUser(updatedUser);
                          setShowProfileModal(false);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </NotificationProvider>
        </LanguageProvider>
      </ShopProvider>
    </AppProvider>
  );
};

export default App;

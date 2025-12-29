

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
import { NotificationStack } from '@/components/NotificationStack';


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
  createAuditLog,
  getSystemAlerts
} from '@/services/database';
import { UserRole, User, Prescription, Notification, Drug, DrugBatch, Sale, AuditLog, SearchLog, InventoryItem, PrescriberProfile, SystemAlert } from '@/types';
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
  const [systemStatus, setSystemStatus] = useState<'healthy' | 'db_down' | 'api_down'>('healthy');
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);

  // Monitor Database & API Connection (Global Sentinel)
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { checkSupabaseConnection } = await import('@/services/supabase');
        // Check DB
        const isDbConnected = await checkSupabaseConnection();

        // Check API (Quick timeout)
        let isApiHealthy = false;
        try {
          // Assuming API is at /api or relative if proxy set, or absolute.
          // Using relative /health assuming proxy is set in Vite.
          // If dev, it might be http://localhost:3000/health
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const res = await fetch('/api/health', { signal: controller.signal });
          clearTimeout(timeoutId);
          isApiHealthy = res.ok;
        } catch (e) { /* ignore fetch error */ }

        if (!isDbConnected) {
          setSystemStatus('db_down');
        } else if (!isApiHealthy && isDbConnected) {
          // If DB is up but API is down, it's a Backend failure
          setSystemStatus('api_down');
        } else {
          setSystemStatus('healthy');
        }
      } catch (e) {
        setSystemStatus('db_down');
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch System Alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const alerts = await getSystemAlerts(true);
        setSystemAlerts(alerts);
      } catch (e) { console.error('Error fetching alerts', e); }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

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
    } catch (err: any) {
      console.error("Error fetching user profile:", err);
      // Only sign out if the profile is truly missing (PGRST116)
      // Prevents logout on network flakiness when switching tabs/apps
      if (err.code === 'PGRST116') {
        await supabase.auth.signOut();
        setCurrentUser(null);
        setPrescriberProfile(null);
      } else {
        // For other errors (e.g., Network), keep the session but maybe show a toast
        // We set authLoading false so at least it doesn't spin forever, 
        // though without profile data the app might look weird.
        // Ideally we'd have a 'Retrying...' state.
      }
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
          <NotificationProvider>

            <div className="min-h-screen bg-slate-50 flex flex-col">
              {/* System Offline Alert */}
              {systemStatus !== 'healthy' && (
                <div className={`px-4 py-2 text-center text-sm font-bold flex items-center justify-center gap-2 z-50 ${systemStatus === 'db_down' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                  }`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {systemStatus === 'db_down'
                    ? '⚠️ SYSTEM ALERT: Database Disconnected. Functionality will be limited.'
                    : '⚠️ SYSTEM WARN: Backend API Unreachable. Real-time features paused.'
                  }
                </div>
              )}
              {systemAlerts.map(alert => (
                <div key={alert.id} className={`px-4 py-2 text-center text-sm font-bold flex items-center justify-center gap-2 z-50 ${alert.type === 'critical' ? 'bg-red-600 text-white' :
                    alert.type === 'warning' ? 'bg-amber-500 text-white' :
                      alert.type === 'maintenance' ? 'bg-purple-600 text-white' :
                        'bg-blue-600 text-white'
                  }`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {alert.type === 'maintenance' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )}
                  </svg>
                  <span>{alert.message}</span>
                </div>
              ))}
              <Toaster richColors position="top-center" closeButton />
              <NotificationStack />
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

              {showProfileSetup && pendingUserData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                  <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <ProfileSetup
                      userId={pendingUserData.userId}
                      email={pendingUserData.email}
                      onComplete={() => {
                        setShowProfileSetup(false);
                        fetchUserProfile(pendingUserData.userId, pendingUserData.email);
                      }}
                    />
                  </div>
                </div>
              )}

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

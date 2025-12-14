
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'dotlottie-wc': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { src?: string; autoplay?: boolean; loop?: boolean; style?: React.CSSProperties }, HTMLElement>;
    }
  }
}

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import ChatAssistant from '@/components/ChatAssistant';
import Login from '@/components/Login';
import ProfileSetup from '@/components/ProfileSetup';
import ProfileSettings from '@/pages/ProfileSettings';
import NotificationSystem from '@/components/NotificationSystem';
// Lazy load dashboards to reduce initial bundle size
const PatientDashboard = React.lazy(() => import('@/pages/PatientDashboard'));
const PharmacistDashboard = React.lazy(() => import('@/pages/PharmacistDashboard'));
const AdminDashboard = React.lazy(() => import('@/pages/AdminDashboard'));
const SuperAdminDashboard = React.lazy(() => import('@/pages/SuperAdminDashboard'));
const DevDashboard = React.lazy(() => import('@/pages/DevDashboard'));
const PrescriberDashboard = React.lazy(() => import('@/components/prescriber/PrescriberDashboard'));

import { supabase } from '@/services/supabase';
import {
  getItems,
  getBatches,
  processSale,
  getStockAlerts,
  createPrescription,
  getPrescriptions,
  updatePrescriptionStatus,
  createSearchLog,
  createAuditLog
} from '@/services/database';
import { UserRole, User, Prescription, Notification, Drug, DrugBatch, Sale, AuditLog, SearchLog, InventoryItem, PrescriberProfile } from '@/types';
import { useIdleTimer } from '@/hooks/useIdleTimer';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [prescriberProfile, setPrescriberProfile] = useState<PrescriberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [pendingUserData, setPendingUserData] = useState<{ userId: string; email: string } | null>(null);

  // Data state initialized with empty arrays to prevent crashes
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [batches, setBatches] = useState<DrugBatch[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setPrescriberProfile(null);
    setDrugs([]); setBatches([]); setSales([]); setPrescriptions([]); setNotifications([]);
  };

  useIdleTimer(handleLogout, 15 * 60 * 1000);

  useRealtimeSubscription(
    currentUser ? ['prescriptions', 'alerts', 'items', 'item_batches', 'sales'] : [],
    (table, payload) => {
      if (currentUser) {
        console.log(`Realtime update on ${table}:`, payload);
        fetchAllData(currentUser.role, currentUser.id, currentUser.facility_id);
      }
    }
  );

  useEffect(() => {
    const initializeApp = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchUserProfile(session.user.id, session.user.email || '');
      } else {
        setLoading(false);
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
    setLoading(true);
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

        await fetchAllData(user.role, user.id, user.facility_id);
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
      setLoading(false);
    }
  };

  const fetchAllData = async (role: UserRole, userId: string, facilityId?: string) => {
    if (role === UserRole.PRESCRIBER) return;

    const [itemsResult, patientPrescriptionsResult] = await Promise.allSettled([
      getItems(),
      role === UserRole.CUSTOMER ? getPrescriptions(userId) : Promise.resolve([])
    ]);

    if (itemsResult.status === 'fulfilled') {
      setDrugs(itemsResult.value || []);
    }
    if (patientPrescriptionsResult.status === 'fulfilled') {
      setPrescriptions(patientPrescriptionsResult.value || []);
    }

    if (facilityId) {
      const [batchesResult, salesResult, alertsResult, facilityRxsResult] = await Promise.allSettled([
        getBatches({ facilityId }),
        supabase.from('sales').select('*').eq('facility_id', facilityId),
        getStockAlerts(facilityId),
        getPrescriptions(undefined, facilityId) // Fetch all for facility
      ]);

      const newBatches = batchesResult.status === 'fulfilled' ? batchesResult.value || [] : [];
      const newSales = salesResult.status === 'fulfilled' ? salesResult.value.data || [] : [];
      const newNotifications = alertsResult.status === 'fulfilled' ? alertsResult.value || [] : [];
      const facilityRxs = facilityRxsResult.status === 'fulfilled' ? facilityRxsResult.value || [] : [];

      setBatches(newBatches);
      setSales(newSales);
      setNotifications(newNotifications as Notification[]);

      const combined = [...prescriptions, ...facilityRxs];
      setPrescriptions(Array.from(new Map(combined.map(p => [p.id, p])).values()));
    }
  };

  const handleProfileCreated = () => {
    setShowProfileSetup(false);
    if (pendingUserData) {
      fetchUserProfile(pendingUserData.userId, pendingUserData.email);
    }
  };

  const [showProfileModal, setShowProfileModal] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <dotlottie-wc
          src="https://lottie.host/d2f497fb-70bb-4c87-833e-ff90caf7c9eb/Rl8upijqbt.lottie"
          style={{ width: '300px', height: '300px' }}
          autoplay
          loop
        ></dotlottie-wc>
      </div>
    );
  }

  if (!currentUser) {
    return showProfileSetup && pendingUserData ?
      <ProfileSetup userId={pendingUserData.userId} email={pendingUserData.email} onProfileCreated={handleProfileCreated} /> :
      <Login onLoginSuccess={() => fetchUserProfile(supabase.auth.getUser().id, supabase.auth.getUser().email)} />;
  }

  const renderDashboard = () => {
    const commonProps = { currentUser: currentUser!, onUpdateUser: setCurrentUser };

    const safeDrugs = Array.isArray(drugs) ? drugs : [];
    const safeBatches = Array.isArray(batches) ? batches : [];

    const inventorySummary: InventoryItem[] = safeDrugs.map(drug => ({
      id: drug.id, name: drug.name, unit: drug.unit, category: drug.category,
      currentStock: safeBatches.filter(b => b.item_id === drug.id).reduce((sum, b) => sum + b.current_quantity, 0),
      expirationDate: 'N/A', minLevel: 0, maxLevel: 0, leadTime: 0, costPerUnit: 0
    }));

    switch (currentUser.role) {
      case UserRole.CUSTOMER:
        return <PatientDashboard {...commonProps} prescriptions={prescriptions} inventory={drugs} inventoryStock={batches} onAddPrescription={(p) => createPrescription(p as any)} logAIAction={() => { }} notifications={notifications} onMarkNotificationAsRead={(id) => { }} userPrivacy={currentUser.privacySettings} onUpdatePrivacy={(s) => { }} onLogSearch={() => { }} />;
      case UserRole.PHARMACIST:
        return <PharmacistDashboard {...commonProps} inventory={inventorySummary} notifications={notifications} sales={sales} prescriptions={prescriptions} onAddPrescription={(p) => createPrescription(p as any)} onProcessSale={(s) => processSale(currentUser.facility_id!, s as any)} onUpdateStatus={(id, s) => updatePrescriptionStatus(id, s)} onAddInventory={(item) => { }} onUpdateInventory={(id, updates) => { }} onDeleteInventory={(id) => { }} onReconcileInventory={(id, count) => { }} />;
      case UserRole.ADMIN:
        return <AdminDashboard {...commonProps} inventory={drugs} alerts={notifications} sales={sales} staff={[]} onAddStaff={(s) => { }} onUpdateStaff={(s) => { }} />;
      case UserRole.SUPER_ADMIN_BMS:
        return <SuperAdminDashboard {...commonProps} />;
      case UserRole.SUPER_ADMIN_DEV:
        return <DevDashboard {...commonProps} />;
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
    <div className="min-h-screen bg-slate-50 font-sans">
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
      {currentUser && <NotificationSystem userId={currentUser.id} />}

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
  );
};

export default App;

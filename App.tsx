
import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import ChatAssistant from '@/components/ChatAssistant';
import Login from '@/components/Login';
import ProfileSetup from '@/components/ProfileSetup';
import PatientDashboard from '@/pages/PatientDashboard';
import PharmacistDashboard from '@/pages/PharmacistDashboard';
import AdminDashboard from '@/pages/AdminDashboard';
import SuperAdminDashboard from '@/pages/SuperAdminDashboard';
import DevDashboard from '@/pages/DevDashboard';
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
import { UserRole, User, Prescription, Notification, Drug, DrugBatch, Sale, AuditLog, SearchLog, InventoryItem } from '@/types';
import { useIdleTimer } from '@/hooks/useIdleTimer';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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
    setDrugs([]); setBatches([]); setSales([]); setPrescriptions([]); setNotifications([]);
  };

  useIdleTimer(handleLogout, 15 * 60 * 1000);

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
        await fetchAllData(user.role, user.id, user.facility_id);
      } else {
        setPendingUserData({ userId, email });
        setShowProfileSetup(true);
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      await supabase.auth.signOut();
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAllData = async (role: UserRole, userId: string, facilityId?: string) => {
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

        // Combine patient and facility prescriptions, ensuring no duplicates
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
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>;
  }

  if (!currentUser) {
    return showProfileSetup && pendingUserData ? 
      <ProfileSetup userId={pendingUserData.userId} email={pendingUserData.email} onProfileCreated={handleProfileCreated} /> : 
      <Login />;
  }

  const renderDashboard = () => {
    const commonProps = { currentUser: currentUser!, onUpdateUser: setCurrentUser };
    
    // Defensive check to prevent crashes if `drugs` or `batches` are not ready
    const safeDrugs = Array.isArray(drugs) ? drugs : [];
    const safeBatches = Array.isArray(batches) ? batches : [];

    const inventorySummary: InventoryItem[] = safeDrugs.map(drug => ({
        id: drug.id, name: drug.name, unit: drug.unit, category: drug.category,
        currentStock: safeBatches.filter(b => b.item_id === drug.id).reduce((sum, b) => sum + b.current_quantity, 0),
        expirationDate: 'N/A', minLevel: 0, maxLevel: 0, leadTime: 0, costPerUnit: 0
      }));

    switch (currentUser.role) {
      case UserRole.CUSTOMER:
        return <PatientDashboard {...commonProps} prescriptions={prescriptions} inventory={drugs} inventoryStock={batches} onAddPrescription={(p) => createPrescription(p as any)} logAIAction={() => {}} notifications={notifications} onMarkNotificationAsRead={(id) => {}} userPrivacy={currentUser.privacySettings} onUpdatePrivacy={(s) => {}} onLogSearch={() => {}} />;
      case UserRole.PHARMACIST:
        return <PharmacistDashboard {...commonProps} inventory={inventorySummary} alerts={notifications} sales={sales} prescriptions={prescriptions} onProcessSale={(s) => processSale(currentUser.facility_id!, s as any)} onUpdatePrescriptionStatus={(id,s) => updatePrescriptionStatus(id,s)} />;
      case UserRole.ADMIN:
        return <AdminDashboard {...commonProps} inventory={inventorySummary} alerts={notifications} sales={sales} staff={[]} onAddStaff={(s) => {}} onUpdateStaff={(s) => {}} />;
      case UserRole.SUPER_ADMIN_BMS:
        return <SuperAdminDashboard {...commonProps} />;
      case UserRole.SUPER_ADMIN_DEV:
        return <DevDashboard {...commonProps} />;
      default:
        return <div>Unsupported role. Please contact support.</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Navbar currentUser={currentUser} onLogout={handleLogout} />
      <main className="pb-20">
        {renderDashboard()}
      </main>
      {currentUser && currentUser.role !== UserRole.CUSTOMER && <ChatAssistant role={currentUser.role} />}
    </div>
  );
};

export default App;

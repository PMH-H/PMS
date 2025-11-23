
import React, { useState, useEffect, useMemo } from 'react';
import Navbar from './components/Navbar';
import ChatAssistant from './components/ChatAssistant';
import Login from './components/Login';
import PatientDashboard from './pages/PatientDashboard';
import PharmacistDashboard from './pages/PharmacistDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DispensaryDashboard from './pages/DispensaryDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import DevDashboard from './pages/DevDashboard';
import { checkSupabaseConnection, supabase, getCurrentUser } from './services/supabase';
import {
  UserRole, User, Prescription, PrescriptionStatus, Notification, AILog,
  Drug, DrugBatch, Sale, InventoryAdjustment, AuditLog, InventoryItem, SaleItem, SearchLog
} from './types';

// Initial Data Seeding (Keep for now as fallback/demo data)
const INITIAL_DRUGS: Drug[] = [
  {
    id: 'd1',
    sku: 'AMOX-500',
    name: 'Amoxicillin 500mg',
    generic_name: 'Amoxicillin',
    barcode: '111000',
    default_unit: 'capsules',
    dosage_form: 'Capsule',
    category: 'B',
    min_level: 200,
    max_level: 1000,
    created_at: new Date().toISOString(),
    active_ingredients: ['Amoxicillin Trihydrate'],
    common_uses: ['Bacterial Infections', 'Dental Abscess', 'Respiratory Tract Infection'],
    side_effects: ['Nausea', 'Rash', 'Diarrhea'],
    usage_warning: 'Complete the full course even if you feel better. Do not take if allergic to Penicillin.',
    price_estimate: 45.00
  },
  {
    id: 'd2',
    sku: 'LIS-10',
    name: 'Lisinopril 10mg',
    generic_name: 'Lisinopril',
    barcode: '222000',
    default_unit: 'tablets',
    dosage_form: 'Tablet',
    category: 'A',
    min_level: 150,
    max_level: 500,
    created_at: new Date().toISOString(),
    active_ingredients: ['Lisinopril'],
    common_uses: ['Hypertension (High Blood Pressure)', 'Heart Failure'],
    side_effects: ['Dizziness', 'Dry Cough', 'Headache'],
    usage_warning: 'May cause dizziness. Do not use if pregnant.',
    price_estimate: 120.50
  },
  {
    id: 'd3',
    sku: 'ATOR-20',
    name: 'Atorvastatin 20mg',
    generic_name: 'Atorvastatin',
    barcode: '333000',
    default_unit: 'tablets',
    dosage_form: 'Tablet',
    category: 'C',
    min_level: 300,
    max_level: 1500,
    created_at: new Date().toISOString(),
    active_ingredients: ['Atorvastatin Calcium'],
    common_uses: ['High Cholesterol', 'Heart Disease Prevention'],
    side_effects: ['Muscle Pain', 'Digestive Issues'],
    usage_warning: 'Avoid grapefruit juice while taking this medication.',
    price_estimate: 300.00
  },
];

const getFutureDate = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const INITIAL_BATCHES: DrugBatch[] = [
  { id: 'b1', drug_id: 'd1', batch_no: 'B001', expiry_date: getFutureDate(365), received_units: 500, current_units: 500, cost_per_unit: 0.15, created_at: new Date().toISOString() },
  { id: 'b2', drug_id: 'd2', batch_no: 'B002', expiry_date: getFutureDate(15), received_units: 200, current_units: 120, cost_per_unit: 1.20, created_at: new Date().toISOString() },
  { id: 'b3', drug_id: 'd3', batch_no: 'B003', expiry_date: getFutureDate(200), received_units: 1000, current_units: 800, cost_per_unit: 0.05, created_at: new Date().toISOString() },
  // Multiple batch example for d1
  { id: 'b4', drug_id: 'd1', batch_no: 'B001-OLD', expiry_date: getFutureDate(30), received_units: 100, current_units: 50, cost_per_unit: 0.14, created_at: new Date().toISOString() },
];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // -- Legacy State (Prescriptions) --
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [aiLogs, setAiLogs] = useState<AILog[]>([]);

  // -- New Dispensary State --
  const [drugs, setDrugs] = useState<Drug[]>(INITIAL_DRUGS);
  const [batches, setBatches] = useState<DrugBatch[]>(INITIAL_BATCHES);
  const [sales, setSales] = useState<Sale[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchLogs, setSearchLogs] = useState<SearchLog[]>([]);

  // -- Derived State for Legacy Dashboard Compatibility --
  // This maps the new robust batch system to the simple InventoryItem list expected by the old dashboard
  const inventorySummary: InventoryItem[] = useMemo(() => {
    return drugs.map(drug => {
      const drugBatches = batches.filter(b => b.drug_id === drug.id);
      const totalStock = drugBatches.reduce((sum, b) => sum + b.current_units, 0);

      // Find earliest expiry
      const earliestExpiry = drugBatches.length > 0
        ? drugBatches.sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())[0].expiry_date
        : getFutureDate(365);

      // Average cost (weighted)
      const totalValue = drugBatches.reduce((sum, b) => sum + (b.current_units * b.cost_per_unit), 0);
      const avgCost = totalStock > 0 ? totalValue / totalStock : 0;

      return {
        id: drug.id,
        name: drug.name,
        currentStock: totalStock,
        unit: drug.default_unit,
        expirationDate: earliestExpiry,
        category: drug.category,
        minLevel: drug.min_level,
        maxLevel: drug.max_level,
        leadTime: 3, // Mock
        costPerUnit: avgCost,
        lastCountDate: new Date().toISOString().split('T')[0] // Mock
      };
    });
  }, [drugs, batches]);

  // -- Helpers --

  const addAuditLog = (resourceType: AuditLog['resource_type'], action: AuditLog['action'], resourceId: string, payload: any) => {
    if (!currentUser) return;
    const newLog: AuditLog = {
      id: crypto.randomUUID(),
      resource_type: resourceType,
      resource_id: resourceId,
      action,
      payload,
      performed_by: currentUser.id,
      created_at: new Date().toISOString()
    };
    setAuditLogs(prev => [...prev, newLog]);
  };

  const addAILog = (action: string, details: string, status: 'SUCCESS' | 'ERROR') => {
    setAiLogs(prev => [...prev, {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      model: 'gemini-2.5-flash',
      status,
      latencyMs: Math.floor(Math.random() * 500) + 200,
      details
    }]);
  };

  const handleLogSearch = (term: string, category: 'PRODUCT' | 'SYMPTOM') => {
    setSearchLogs(prev => [...prev, {
      id: crypto.randomUUID(),
      term,
      category,
      timestamp: new Date().toISOString()
    }]);
  };

  // -- Handlers --

  const handleCreateDrug = (drug: Drug) => {
    setDrugs(prev => [...prev, drug]);
    addAuditLog('DRUG', 'CREATE', drug.id, drug);
  };

  const handleAddBatch = (batch: DrugBatch) => {
    setBatches(prev => [...prev, batch]);
    addAuditLog('BATCH', 'CREATE', batch.id, batch);

    // Check notifications
    const drug = drugs.find(d => d.id === batch.drug_id);
    if (drug) {
      setNotifications(prev => [...prev, {
        id: crypto.randomUUID(),
        message: `New Batch Added: ${drug.name} (${batch.batch_no})`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'STOCK_UPDATE'
      }]);
    }
  };

  // CORE LOGIC: Process Sale with FEFO
  const handleProcessSale = (items: SaleItem[], customerInfo?: string) => {
    if (!currentUser) return;
    const newSaleId = crypto.randomUUID();
    let updatedBatches = [...batches];
    let insufficientStock = false;

    // Simulate Transaction
    items.forEach(item => {
      let remainingUnitsToSell = item.units;

      // If batch specified, use it
      if (item.batch_id) {
        const batchIndex = updatedBatches.findIndex(b => b.id === item.batch_id);
        if (batchIndex === -1 || updatedBatches[batchIndex].current_units < remainingUnitsToSell) {
          insufficientStock = true;
          return;
        }
        updatedBatches[batchIndex] = {
          ...updatedBatches[batchIndex],
          current_units: updatedBatches[batchIndex].current_units - remainingUnitsToSell
        };
      } else {
        // FEFO Logic: Find batches for drug, sort by expiry ASC
        const drugBatches = updatedBatches
          .map((b, idx) => ({ ...b, originalIdx: idx }))
          .filter(b => b.drug_id === item.drug_id && b.current_units > 0)
          .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

        if (drugBatches.reduce((acc, b) => acc + b.current_units, 0) < remainingUnitsToSell) {
          insufficientStock = true;
          return;
        }

        for (const batch of drugBatches) {
          if (remainingUnitsToSell <= 0) break;
          const take = Math.min(batch.current_units, remainingUnitsToSell);

          updatedBatches[batch.originalIdx] = {
            ...updatedBatches[batch.originalIdx],
            current_units: updatedBatches[batch.originalIdx].current_units - take
          };
          remainingUnitsToSell -= take;
        }
      }
    });

    if (insufficientStock) {
      alert("Transaction Failed: Insufficient Stock for one or more items.");
      return;
    }

    // Commit Transaction
    setBatches(updatedBatches);

    const sale: Sale = {
      id: newSaleId,
      items,
      total_price: items.reduce((sum, item) => sum + (item.units * item.unit_price), 0),
      sold_by_user_id: currentUser.id,
      customer_info: customerInfo,
      created_at: new Date().toISOString()
    };

    setSales(prev => [sale, ...prev]);
    addAuditLog('SALE', 'SALE', newSaleId, sale);
  };

  // CORE LOGIC: Reconciliation
  const handleReconcile = (adjustmentsInput: InventoryAdjustment[]) => {
    if (!currentUser) return;
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.PHARMACIST && currentUser.role !== UserRole.SUPER_ADMIN && currentUser.role !== UserRole.SUPER_ADMIN_DEV) {
      alert("Unauthorized");
      return;
    }

    let updatedBatches = [...batches];

    adjustmentsInput.forEach(adj => {
      const batchIdx = updatedBatches.findIndex(b => b.id === adj.drug_batch_id);
      if (batchIdx !== -1) {
        updatedBatches[batchIdx] = {
          ...updatedBatches[batchIdx],
          current_units: updatedBatches[batchIdx].current_units + adj.change_units
        };
      }
    });

    setBatches(updatedBatches);
    setAdjustments(prev => [...prev, ...adjustmentsInput]);

    // Log one entry per adjustment
    adjustmentsInput.forEach(adj => {
      addAuditLog('ADJUSTMENT', 'RECONCILE', adj.drug_batch_id, adj);
    });
  };

  // Legacy Handlers (mapped to new logic where possible)
  const handleLegacyUpdateStatus = (id: string, status: PrescriptionStatus) => {
    setPrescriptions(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  // Initial Seed for Prescriptions
  useEffect(() => {
    if (prescriptions.length === 0) {
      setPrescriptions([{
        id: 'rx-seed-1', patientName: 'John Doe', date: '2023-10-25', status: PrescriptionStatus.PICKED_UP,
        medications: [{ id: 'm1', name: 'Ibuprofen', dosage: '400mg', frequency: 'As needed' }]
      }]);
    }
  }, []);

  // Supabase Auth & Connection Check
  useEffect(() => {
    const initializeApp = async () => {
      // 1. Check Connection
      const isConnected = await checkSupabaseConnection();
      if (isConnected) {
        console.log("Supabase Connected Successfully");
      } else {
        console.log("Running in Mock Mode (Supabase disconnected)");
      }

      // 2. Check Auth Session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchUserProfile(session.user.id, session.user.email || '');
      } else {
        setLoading(false);
      }

      // 3. Subscribe to Auth Changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await fetchUserProfile(session.user.id, session.user.email || '');
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setLoading(false);
        }
      });

      return () => subscription.unsubscribe();
    };

    initializeApp();
  }, []);

  const fetchUserProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        // Fallback or handle error (maybe user has no profile yet)
        setLoading(false);
        return;
      }

      if (data) {
        setCurrentUser({
          id: data.id,
          name: data.full_name || email.split('@')[0],
          role: data.role as UserRole,
          // Default privacy settings for now
          privacySettings: {
            shareBrowsing: true,
            sharePurchaseHistory: true,
            allowAI: true,
            anonymousMode: false
          }
        });
      }
    } catch (err) {
      console.error("Unexpected error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-700"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={() => { }} />; // onLoginSuccess handled by auth state listener
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar currentUser={currentUser} />

      <main className="flex-grow w-full mx-auto">

        {currentUser.role === UserRole.PATIENT && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <PatientDashboard
              prescriptions={prescriptions}
              inventory={drugs}
              inventoryStock={batches}
              onAddPrescription={p => setPrescriptions(prev => [p, ...prev])}
              logAIAction={addAILog}
              notifications={notifications}
              onMarkNotificationAsRead={id => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
              userPrivacy={currentUser.privacySettings}
              onUpdatePrivacy={(newSettings) => setCurrentUser(prev => prev ? ({ ...prev, privacySettings: newSettings }) : null)}
              onLogSearch={handleLogSearch}
            />
          </div>
        )}

        {currentUser.role === UserRole.PHARMACIST && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">Pharmacist Overview</h1>
            </div>

            <PharmacistDashboard
              prescriptions={prescriptions}
              inventory={inventorySummary}
              onUpdateStatus={handleLegacyUpdateStatus}
              onAddInventory={() => alert("Please use Dispensary Module")}
              onUpdateInventory={() => alert("Please use Dispensary Module")}
              onDeleteInventory={() => alert("Please use Dispensary Module")}
              onReconcileInventory={() => alert("Please use Dispensary Module")}
            />

            <hr className="border-gray-300" />

            <DispensaryDashboard
              currentUser={currentUser}
              drugs={drugs}
              batches={batches}
              sales={sales}
              onProcessSale={handleProcessSale}
              onCreateDrug={handleCreateDrug}
              onAddBatch={handleAddBatch}
              onReconcile={handleReconcile}
            />
          </div>
        )}

        {currentUser.role === UserRole.ADMIN && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <DispensaryDashboard
              currentUser={currentUser}
              drugs={drugs}
              batches={batches}
              sales={sales}
              onProcessSale={handleProcessSale}
              onCreateDrug={handleCreateDrug}
              onAddBatch={handleAddBatch}
              onReconcile={handleReconcile}
            />
            <AdminDashboard
              logs={aiLogs}
              users={[]} // TODO: Fetch real users
              sales={sales}
              auditLogs={auditLogs}
              inventory={drugs}
              batches={batches}
              searchLogs={searchLogs}
            />
          </div>
        )}

        {currentUser.role === UserRole.SUPER_ADMIN && (
          <SuperAdminDashboard />
        )}

        {currentUser.role === UserRole.SUPER_ADMIN_DEV && (
          <DevDashboard />
        )}

      </main>

      {currentUser.role !== UserRole.PATIENT && currentUser.role !== UserRole.SUPER_ADMIN && currentUser.role !== UserRole.SUPER_ADMIN_DEV && <ChatAssistant role={currentUser.role} />}
    </div>
  );
};

export default App;

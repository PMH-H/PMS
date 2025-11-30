
import React, { useState, useEffect, useMemo } from 'react';
import Navbar from './components/Navbar';
import ChatAssistant from './components/ChatAssistant';
import Login from './components/Login';
import ProfileSetup from './components/ProfileSetup';
import PatientDashboard from './pages/PatientDashboard';
import PharmacistDashboard from './pages/PharmacistDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DispensaryDashboard from './pages/DispensaryDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import DevDashboard from './pages/DevDashboard';
import { checkSupabaseConnection, supabase, getCurrentUser } from './services/supabase';
import { createItem, updateItem, addBatch as createBatch, getItems, getBatches, processSale, submitCycleCountResult, createAuditLog, createAlert, getStockAlerts, createPrescription, getPrescriptions, updatePrescriptionStatus, createSearchLog } from './services/database';
import { subscribeToFacilityUpdates } from './services/realtime';
import { analyzePrescriptionImage, checkDrugInteractions } from './services/geminiService';
import { generateUUID } from './utils/uuid';
import {
  UserRole, User, Prescription, PrescriptionStatus, Notification, AILog,
  Drug, DrugBatch, Sale, InventoryAdjustment, AuditLog, InventoryItem, SaleItem, SearchLog,
  getRoleDisplayName, hasPharmacistPermissions, normalizeRole
} from './types';

// Initial Data Seeding (Keep for now as fallback/demo data)
const INITIAL_DRUGS: Drug[] = [
  {
    id: 'd1',
    sku: 'AMOX-500',
    name: 'Amoxicillin 500mg',
    generic_name: 'Amoxicillin',
    barcode: '111000',
    unit: 'capsules',
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
    unit: 'tablets',
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
    unit: 'tablets',
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

// Note: INITIAL_BATCHES are not used directly anymore since batches require facility_id
// They are kept here for reference only
const INITIAL_BATCHES_REFERENCE: any[] = [
  { id: 'b4', item_id: 'd1', batch_no: 'B001-OLD', expiry_date: getFutureDate(30), received_quantity: 100, current_quantity: 50, cost_per_unit: 0.14, created_at: new Date().toISOString() },
];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [pendingUserData, setPendingUserData] = useState<{ userId: string; email: string } | null>(null);

  // -- Legacy State (Prescriptions) --
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [aiLogs, setAiLogs] = useState<AILog[]>([]);

  // -- New Dispensary State --
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [batches, setBatches] = useState<DrugBatch[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchLogs, setSearchLogs] = useState<SearchLog[]>([]);
  const [adminView, setAdminView] = useState<'BUSINESS' | 'POS' | 'PHARMACIST' | 'PATIENT'>('BUSINESS');
  const [devAdminView, setDevAdminView] = useState<'PATIENT' | 'PHARMACIST' | 'ADMIN' | 'BMS' | 'DEV'>('DEV');

  // -- Derived State for Legacy Dashboard Compatibility --
  // This maps the new robust batch system to the simple InventoryItem list expected by the old dashboard
  const inventorySummary: InventoryItem[] = useMemo(() => {
    return drugs.map(drug => {
      const drugBatches = batches.filter(b => b.item_id === drug.id);
      const totalStock = drugBatches.reduce((sum, b) => sum + b.current_quantity, 0);

      // Find earliest expiry
      const earliestExpiry = drugBatches.length > 0
        ? drugBatches.sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())[0].expiry_date
        : getFutureDate(365);

      // Average cost (weighted)
      const totalValue = drugBatches.reduce((sum, b) => sum + (b.current_quantity * b.cost_per_unit), 0);
      const avgCost = totalStock > 0 ? totalValue / totalStock : 0;

      return {
        id: drug.id,
        name: drug.name,
        currentStock: totalStock,
        unit: drug.unit,
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

  // Helper: map high-level entity names to actual DB table names
  const auditTableNameFor = (entity: string) => {
    const map: Record<string, string> = {
      'INVENTORY': 'items',
      'DRUG': 'items',
      'ITEM': 'items',
      'BATCH': 'item_batches',
      'SALE': 'sales',
      'PRESCRIPTION': 'prescriptions',
      'ALERT': 'alerts',
      'USER': 'profiles',
      // add more mappings as needed
    };
    return map[entity] || entity.toLowerCase();
  };

  /**
   * Centralized audit logger — maps app-level names to DB column names and persists safely.
   * Non-fatal: will never throw to the UI if audit insert fails (database.createAuditLog is defensive).
   */
  const addAuditLog = async (entity: string, action: string, entityId: string, details: any) => {
    if (!currentUser) return;

    // Build DB-friendly payload (snake_case keys expected by DB)
    const tableName = auditTableNameFor(entity);

    const dbPayload: Partial<AuditLog> = {
      table_name: tableName,                // required in DB (NOT NULL)
      record_id: entityId ?? null,
      action: action ?? null,
      user_id: currentUser.id ?? null,
      previous_data: details?.previous ?? null,
      new_data: details?.new ?? details ?? null,
      created_at: new Date().toISOString()
    };

    // Optimistic UI update (keep shape used in your UI)
    try {
      setAuditLogs(prev => [...prev, {
        ...dbPayload,
        // For local UI we might want id — create a temporary one so UI shows it immediately
        id: dbPayload.record_id ? dbPayload.record_id.toString() : generateUUID()
      } as AuditLog]);

      // Persist to DB — database.ts' createAuditLog is defensive and will not throw on insert errors
      await createAuditLog(dbPayload);
    } catch (err) {
      // Defensive: ensure we never break the main user flow because audit logging failed
      console.error('addAuditLog failed (non-fatal):', err);
    }
  };


  const addAILog = (action: string, details: string, status: 'SUCCESS' | 'ERROR') => {
    setAiLogs(prev => [...prev, {
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      action,
      model: 'gemini-2.5-flash',
      status,
      latencyMs: Math.floor(Math.random() * 500) + 200,
      details
    }]);
  };

  const handleUpdateInventory = async (id: string, updates: Partial<InventoryItem>) => {
    try {
      const drug = drugs.find(d => d.id === id);
      if (!drug) {
        alert('Drug not found');
        return;
      }

      // Only update fields that exist in the items table
      // Note: currentStock, expirationDate, costPerUnit are in item_batches, not items
      const updatedDrug: Partial<Drug> = {
        name: updates.name || drug.name,
        min_level: updates.minLevel ?? drug.min_level,
        max_level: updates.maxLevel ?? drug.max_level,
        category: (updates.category as 'A' | 'B' | 'C') || drug.category,
        unit: updates.unit || drug.unit
      };

      // Update in database
      await updateItem(id, updatedDrug);
      setDrugs(prev => prev.map(d => d.id === id ? { ...d, ...updatedDrug } : d));

      addAuditLog('INVENTORY', 'UPDATE', id, updates);

      // Inform user if they tried to update stock
      if (updates.currentStock !== undefined) {
        alert('Drug details updated! Note: To update stock quantities, use the Reconciliation feature or Add Batch.');
      } else {
        alert('Drug details updated successfully!');
      }
    } catch (error) {
      console.error('Error updating inventory:', error);
      alert('Failed to update drug details.');
    }
  };

  const handleLogSearch = async (term: string, category: 'PRODUCT' | 'SYMPTOM') => {
    const newLog = {
      id: generateUUID(),
      term,
      category,
      timestamp: new Date().toISOString()
    };

    setSearchLogs(prev => [...prev, newLog]);

    // Persist to DB
    await createSearchLog(newLog);
  };

  // ===== INVENTORY CRUD HANDLERS =====

  const handleAddInventory = async (item: Omit<InventoryItem, 'id'>) => {
    try {
      const newDrug: Drug = {
        id: generateUUID(),
        sku: `SKU-${item.name.substring(0, 3).toUpperCase()}-${generateUUID().substring(0, 8)}`,
        name: item.name,
        barcode: `BAR-${generateUUID().substring(0, 12)}`,
        unit: item.unit || 'units',
        category: item.category as 'A' | 'B' | 'C',
        min_level: item.minLevel,
        max_level: item.maxLevel,
        created_at: new Date().toISOString()
      };

      await createItem(newDrug);
      setDrugs(prev => [...prev, newDrug]);

      // If initial stock provided, create a batch
      if (item.currentStock > 0) {
        // Get user's facility_id
        const { data: profile } = await supabase.from('profiles').select('facility_id').eq('id', currentUser?.id).single();
        const facilityId = profile?.facility_id;

        if (!facilityId) {
          throw new Error('User not assigned to a facility');
        }

        const newBatch: DrugBatch = {
          id: generateUUID(),
          item_id: newDrug.id,
          facility_id: facilityId,
          batch_no: `BATCH-${Date.now()}`,
          expiry_date: item.expirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          manufacture_date: new Date().toISOString().split('T')[0],
          received_quantity: item.currentStock,
          current_quantity: item.currentStock,
          cost_per_unit: item.costPerUnit || 0,
          created_at: new Date().toISOString()
        };
        await handleAddBatch(newBatch);
      }

      addAuditLog('INVENTORY', 'CREATE', newDrug.id, newDrug);
    } catch (error) {
      console.error('Error adding inventory:', error);
      alert('Failed to add inventory item.');
    }
  };

  const handleDeleteInventory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item? This will also delete all batches.')) return;

    try {
      // Delete from database
      await supabase.from('items').delete().eq('id', id);
      setDrugs(prev => prev.filter(d => d.id !== id));
      setBatches(prev => prev.filter(b => b.drug_id !== id));

      addAuditLog('INVENTORY', 'DELETE', id, {});
    } catch (error) {
      console.error('Error deleting inventory:', error);
      alert('Failed to delete inventory item.');
    }
  };

  const handleReconcileInventory = async (id: string, physicalCount: number) => {
    try {
      const drugBatches = batches.filter(b => b.item_id === id).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      if (drugBatches.length === 0) {
        alert('No batches found for this item.');
        return;
      }

      const batch = drugBatches[0];
      const difference = physicalCount - batch.current_quantity;

      const adjustment: InventoryAdjustment = {
        id: generateUUID(),
        batch_id: batch.id,
        item_id: id,
        quantity_change: difference,
        reason: 'Physical count reconciliation',
        adjusted_by: currentUser?.id || '',
        created_at: new Date().toISOString()
      };

      await handleReconcile([adjustment]);
    } catch (error) {
      console.error('Error reconciling inventory:', error);
      alert('Failed to reconcile inventory.');
    }
  };

  // ===== END INVENTORY CRUD HANDLERS =====

  // -- Handlers --

  const handleCreateDrug = async (drug: Drug) => {
    try {
      const created = await createItem(drug);
      setDrugs(prev => [...prev, created as Drug]);
      addAuditLog('DRUG', 'CREATE', created.id, created);
    } catch (error) {
      console.error('Error creating drug:', error);
      alert('Failed to create drug. Please try again.');
      throw error;
    }
  };

  const handleAddBatch = async (batch: DrugBatch) => {
    try {
      // Get user's facility_id
      const { data: profile } = await supabase.from('profiles').select('facility_id').eq('id', currentUser?.id).single();
      const facilityId = profile?.facility_id;

      if (!facilityId) {
        alert('Error: User not assigned to a facility. Cannot add batch.');
        return;
      }

      // Insert batch with facility_id
      const { data, error } = await supabase
        .from('item_batches')
        .insert([{
          id: batch.id,
          item_id: batch.item_id,
          facility_id: facilityId,
          batch_no: batch.batch_no,
          expiry_date: batch.expiry_date,
          manufacture_date: batch.manufacture_date,
          received_quantity: batch.received_quantity,
          current_quantity: batch.current_quantity,
          cost_per_unit: batch.cost_per_unit
        }])
        .select()
        .single();

      if (error) throw error;

      setBatches(prev => [...prev, batch]);
      addAuditLog('BATCH', 'CREATE', batch.id, batch);

      // Check notifications
      const drug = drugs.find(d => d.id === batch.item_id);
      if (drug) {
        const newNotification: Notification = {
          id: generateUUID(),
          message: `New Batch Added: ${drug.name} (${batch.batch_no})`,
          timestamp: new Date().toISOString(),
          read: false,
          type: 'STOCK_UPDATE'
        };
        setNotifications(prev => [...prev, newNotification]);

        // Persist to DB
        // Fetch facility ID
        const { data: profile } = await supabase.from('profiles').select('facility_id').eq('id', currentUser?.id).single();
        if (profile?.facility_id) {
          await createAlert({
            facility_id: profile.facility_id,
            type: 'STOCK_UPDATE',
            message: newNotification.message,
            item_id: drug.id
          });
        }
      }

      // Fetch prescriptions if user is a customer
      if (currentUser.role === UserRole.CUSTOMER) {
        const rxData = await getPrescriptions(currentUser.id);
        if (rxData) {
          // Map DB schema to frontend Prescription type
          const mapped: Prescription[] = rxData.map(rx => ({
            id: rx.id,
            patientName: currentUser.name,
            date: new Date(rx.created_at).toISOString().split('T')[0],
            medications: rx.medications as any,
            status: rx.status as any,
            imageUrl: rx.image_url,
            interactions: rx.interactions as any
          }));
          setPrescriptions(mapped);
        }
      }

    } catch (error) {
      console.error('Error adding batch:', error);
      alert('Failed to add batch. Please try again.');
    }
  };

  // CORE LOGIC: Process Sale with FEFO
  const handleProcessSale = async (items: SaleItem[], customerInfo?: string) => {
    if (!currentUser) return;

    try {
      // Use database service to process sale transaction
      // Note: processSale expects facilityId. We'll use a default or fetch from user profile
      // For now, assuming facility_id is required, we might need to get it from currentUser
      // But currentUser type doesn't have facility_id yet. 
      // Let's assume a default facility ID for now or fetch it.
      // Ideally: const facilityId = currentUser.facility_id;
      // For MVP: Use the first facility found or a hardcoded one if needed, 
      // but better to fetch it.

      // Fetch user's facility (quick fix)
      const { data: profile } = await supabase.from('profiles').select('facility_id').eq('id', currentUser.id).single();
      const facilityId = profile?.facility_id;

      if (!facilityId) {
        alert("Error: User not assigned to a facility. Cannot process sale.");
        return;
      }

      const sale = await processSale(facilityId, items, customerInfo);

      setSales(prev => [sale, ...prev]);
      addAuditLog('SALE', 'SALE', sale.id, sale);

      // Refresh batches to reflect stock changes
      await fetchInventoryData();

      alert("Sale processed successfully!");
    } catch (error: any) {
      console.error("Transaction Failed:", error);
      alert(`Transaction Failed: ${error.message || "Insufficient Stock"}`);
    }
  };

  // CORE LOGIC: Reconciliation
  const handleReconcile = async (adjustmentsInput: InventoryAdjustment[]) => {
    if (!currentUser) return;

    try {
      // Create a cycle count record first (implied by reconciliation action)
      // For this MVP flow, we'll just process each adjustment individually 
      // or create a dummy cycle count.
      // Let's iterate and update batches directly via Supabase for now, 
      // as submitCycleCountResult requires a cycleCountId.

      // Alternative: Use a direct batch update if no cycle count exists.
      // But database.ts has updateBatchQuantity.

      for (const adj of adjustmentsInput) {
        // Fetch current quantity first
        const { data: batch } = await supabase.from('item_batches').select('current_quantity').eq('id', adj.batch_id).single();

        if (batch) {
          const newQty = batch.current_quantity + adj.quantity_change;

          // Update batch quantity
          await supabase.from('item_batches').update({ current_quantity: newQty }).eq('id', adj.batch_id);

          // Record movement
          await supabase.from('stock_movements').insert([{
            item_id: adj.item_id,
            batch_id: adj.batch_id,
            facility_id: (await supabase.from('profiles').select('facility_id').eq('id', currentUser.id).single()).data?.facility_id,
            movement_type: adj.quantity_change > 0 ? 'ADJUST_UP' : 'ADJUST_DOWN',
            quantity: Math.abs(adj.quantity_change),
            reason: adj.reason,
            performed_by: currentUser.id
          }]);
        }
      }

      setAdjustments(prev => [...prev, ...adjustmentsInput]);
      // Refresh inventory
      await fetchInventoryData();

      // Log
      addAuditLog('INVENTORY', 'RECONCILE', 'BATCH', { count: adjustmentsInput.length });

    } catch (error) {
      console.error("Reconciliation failed:", error);
      alert("Failed to process reconciliation.");
    }
  };

  const handleAddPrescription = async (rx: Prescription) => {
    try {
      // Add patient_id from currentUser
      const prescriptionWithUser = {
        ...rx,
        patient_id: currentUser?.id || ''
      };

      await createPrescription(prescriptionWithUser);
      setPrescriptions(prev => [...prev, rx]);

      // Log the action
      addAuditLog('PRESCRIPTION', 'CREATE', rx.id, rx);
    } catch (error) {
      console.error('Error saving prescription:', error);
      alert('Failed to save prescription. Please try again.');
    }
  };

  // Initial Seed for Prescriptions - Remove this, we fetch from DB now
  // useEffect(() => {
  //   if (prescriptions.length === 0) {
  //     setPrescriptions([{
  //       id: 'rx-seed-1', patientName: 'John Doe', date: '2023-10-25', status: PrescriptionStatus.PICKED_UP,
  //       medications: [{ id: 'm1', name: 'Ibuprofen', dosage: '400mg', frequency: 'As needed' }]
  //     }]);
  //   }
  // }, []);

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

  // Setup real-time subscriptions
  useEffect(() => {
    if (!currentUser?.facility_id) return;

    const unsubscribe = subscribeToFacilityUpdates(currentUser.facility_id, {
      onBatchChange: () => { }, // Using custom events instead
      onSaleAdded: () => { },
      onNotificationAdded: () => { }
    });

    // Subscribe to prescriptions
    const rxChannel = supabase
      .channel('prescriptions_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'prescriptions' },
        (payload) => {
          // Filter by facility for staff, or patient_id for customers
          const newRx = payload.new;
          if (
            (currentUser?.role === UserRole.CUSTOMER && newRx.patient_id === currentUser.id) ||
            (currentUser?.role !== UserRole.CUSTOMER && newRx.facility_id === currentUser?.facility_id)
          ) {
            // Dispatch event for UI updates
            const event = new CustomEvent('rx-added', { detail: newRx });
            window.dispatchEvent(event);
          }
        }
      )
      .subscribe();

    // Listen to custom events from realtime service
    const handleBatchChange = (e: any) => {
      const { event, data } = e.detail;
      if (event === 'INSERT') {
        setBatches(prev => [{
          id: data.id, item_id: data.item_id, facility_id: data.facility_id,
          batch_no: data.batch_no, expiry_date: data.expiry_date, manufacture_date: data.manufacture_date,
          received_quantity: data.received_quantity, current_quantity: data.current_quantity,
          cost_per_unit: data.cost_per_unit, created_at: data.created_at
        }, ...prev]);
      } else if (event === 'UPDATE') {
        setBatches(prev => prev.map(b => b.id === data.id ? { ...b, current_quantity: data.current_quantity } : b));
      } else if (event === 'DELETE') {
        setBatches(prev => prev.filter(b => b.id !== data.id));
      }
    };

    const handleSaleAdded = (e: any) => {
      const data = e.detail;
      setSales(prev => [{
        id: data.id, items: data.items, total_price: data.total_price,
        sold_by_user_id: data.sold_by_user_id, timestamp: data.created_at, created_at: data.created_at
      }, ...prev]);
    };

    const handleNotificationAdded = (e: any) => {
      const data = e.detail;
      setNotifications(prev => [{
        id: data.id, message: data.title || data.description || 'New alert',
        timestamp: data.created_at, read: false, type: data.alert_type || 'info'
      }, ...prev]);
    };

    const handleRxAdded = (e: any) => {
      const data = e.detail;
      const mappedRx: Prescription = {
        id: data.id,
        patientName: 'New Patient',
        date: new Date(data.created_at).toISOString().split('T')[0],
        medications: data.medications || [],
        status: data.status,
        imageUrl: data.image_url,
        interactions: data.interactions || []
      };

      setPrescriptions(prev => [mappedRx, ...prev]);

      setNotifications(prev => [{
        id: `notif-${Date.now()}`,
        message: `New Prescription Received`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'info'
      }, ...prev]);
    };

    window.addEventListener('batch-changed', handleBatchChange);
    window.addEventListener('sale-added', handleSaleAdded);
    window.addEventListener('notification-added', handleNotificationAdded);
    window.addEventListener('rx-added', handleRxAdded);

    return () => {
      unsubscribe();
      supabase.removeChannel(rxChannel);
      window.removeEventListener('batch-changed', handleBatchChange);
      window.removeEventListener('sale-added', handleSaleAdded);
      window.removeEventListener('notification-added', handleNotificationAdded);
      window.removeEventListener('rx-added', handleRxAdded);
    };
  }, [currentUser?.facility_id, currentUser?.role, currentUser?.id]);

  const fetchUserProfile = async (userId: string, email: string) => {
    try {
      console.log("App Version: 1.2 - Fetching Profile");
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .limit(1);

      if (error) {
        console.error("Error fetching profile:", error);
        setLoading(false);
        return;
      }

      if (data && data[0]) {
        const profile = data[0];
        const normalizedRole = (profile.role || 'customer').toLowerCase();

        setCurrentUser({
          id: profile.id,
          full_name: profile.full_name || email.split('@')[0],
          role: normalizedRole as UserRole,
          facility_id: profile.facility_id,
          preferences: profile.preferences || {},
          privacySettings: profile.privacy_settings || {
            profileVisibility: 'private',
            showActivityStatus: false,
            allowDataCollection: false
          }
        });
      } else {
        // Handle the case where no profile was found
        console.warn("No profile found for user:", userId, email);
        setPendingUserData({ userId, email });
        setShowProfileSetup(true);
        setLoading(false);
        return;
      }

      // Fetch inventory data
      await fetchInventoryData();
    } catch (err) {
      console.error("Unexpected error fetching profile:", err);
      alert("An unexpected error occurred. Please try logging in again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryData = async () => {
    try {
      // Get current user's role and facility_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('facility_id, role').eq('id', user.id).single();
      const userRole = profile?.role as UserRole;
      const facilityId = profile?.facility_id;

      // Determine if user should see all data or only their facility
      const isSuperAdmin = userRole === UserRole.SUPER_ADMIN_BMS || userRole === UserRole.SUPER_ADMIN_DEV;

      // Fetch drugs (items are global, not facility-specific)
      const items = await getItems();
      setDrugs(items as Drug[] || []);

      // Fetch batches - filter by facility for non-super-admins
      let batchQuery = supabase
        .from('item_batches')
        .select('*')
        .order('expiry_date');

      if (!isSuperAdmin && facilityId) {
        batchQuery = batchQuery.eq('facility_id', facilityId);
      }

      const { data: batchData } = await batchQuery;

      if (batchData) {
        const mappedBatches: DrugBatch[] = batchData.map(b => ({
          id: b.id,
          item_id: b.item_id,
          facility_id: b.facility_id,
          batch_no: b.batch_no,
          expiry_date: b.expiry_date,
          manufacture_date: b.manufacture_date,
          received_quantity: b.received_quantity,
          current_quantity: b.current_quantity,
          cost_per_unit: b.cost_per_unit,
          created_at: b.created_at
        }));
        setBatches(mappedBatches);
      }

      // Fetch alerts - always filter by facility if user has one
      if (facilityId) {
        const alerts = await getStockAlerts(facilityId);
        if (alerts) {
          const mappedNotifications: Notification[] = alerts.map(a => ({
            id: a.id,
            message: a.message,
            timestamp: a.created_at,
            read: a.is_read,
            type: a.type as any
          }));
          setNotifications(mappedNotifications);
        }
      }

      // Fetch sales - filter by facility for non-super-admins
      let salesQuery = supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isSuperAdmin && facilityId) {
        salesQuery = salesQuery.eq('facility_id', facilityId);
      }

      const { data: salesData } = await salesQuery;

      if (salesData) {
        const mappedSales: Sale[] = salesData.map(s => ({
          id: s.id,
          items: s.items,
          total_price: s.total_price,
          sold_by_user_id: s.sold_by_user_id,
          customer_info: s.customer_info,
          created_at: s.created_at
        }));
        setSales(mappedSales);
      }

      // Fetch prescriptions (filter by patient_id for customers)
      let rxQuery = supabase
        .from('prescriptions')
        .select('*, profiles:patient_id(full_name)')
        .order('created_at', { ascending: false });

      if (userRole === UserRole.CUSTOMER) {
        rxQuery = rxQuery.eq('patient_id', user.id);
      }

      const { data: rxData } = await rxQuery;

      if (rxData) {
        const mappedRx: Prescription[] = rxData.map(rx => ({
          id: rx.id,
          patientName: (rx.profiles as any)?.full_name || 'Unknown Patient',
          date: rx.created_at.split('T')[0],
          medications: rx.medications,
          status: rx.status as PrescriptionStatus,
          imageUrl: rx.image_url,
          interactions: rx.interactions
        }));
        setPrescriptions(mappedRx);
      }

    } catch (error) {
      console.error("Error fetching inventory:", error);
    }
  };

  // Legacy Handlers (mapped to new logic where possible)
  const handleLegacyUpdateStatus = async (id: string, status: PrescriptionStatus) => {
    try {
      await updatePrescriptionStatus(id, status);
      setPrescriptions(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    } catch (error) {
      console.error('Error updating prescription status:', error);
    }
  };

  // ===== RENDER =====
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!currentUser) {
    if (showProfileSetup && pendingUserData) {
      return (
        <ProfileSetup
          userId={pendingUserData.userId}
          email={pendingUserData.email}
          onProfileCreated={() => window.location.reload()}
        />
      );
    }
    return <Login onLoginSuccess={() => { }} />; // Login handled by signIn function
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation Bar */}
      <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500 p-2 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">PharmAI <span className="text-emerald-400">Pro</span></h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Intelligent Pharmacy OS</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-white">{currentUser.full_name}</p>
                <p className="text-xs text-emerald-400 font-medium">{getRoleDisplayName(currentUser.role)}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
                title="Logout"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="pb-20">
        {/* Customer (Patient) Dashboard */}
        {currentUser.role === UserRole.CUSTOMER && (
          <PatientDashboard
            currentUser={currentUser}
            onUpdateUser={setCurrentUser}
            prescriptions={prescriptions}
            inventory={drugs}
            inventoryStock={batches}
            onAddPrescription={handleAddPrescription}
            logAIAction={(action, details, status) => addAuditLog('AI', action, 'AI_AGENT', { details, status })}
            notifications={notifications}
            onMarkNotificationAsRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
            userPrivacy={currentUser.privacySettings}
            onUpdatePrivacy={(settings) => setCurrentUser(prev => ({ ...prev!, privacySettings: settings }))}
            onLogSearch={handleLogSearch}
          />
        )}

        {/* Pharmacist Dashboard (includes worker, cashier) */}
        {(currentUser.role === UserRole.PHARMACIST ||
          currentUser.role === UserRole.WORKER ||
          currentUser.role === UserRole.CASHIER) && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <PharmacistDashboard
                currentUser={currentUser}
                onUpdateUser={setCurrentUser}
                prescriptions={prescriptions}
                inventory={inventorySummary}
                onUpdateStatus={handleLegacyUpdateStatus}
                onAddInventory={handleAddInventory}
                onUpdateInventory={handleUpdateInventory}
                onDeleteInventory={handleDeleteInventory}
                onReconcileInventory={handleReconcileInventory}
                onAddPrescription={handleAddPrescription}
              />
            </div>
          )}

        {/* Admin (Shop Owner) Dashboard with Multi-View Switcher */}
        {currentUser.role === UserRole.ADMIN && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Admin Dashboard Switcher */}
            <div className="flex justify-center mb-8">
              <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 inline-flex">
                {(['BUSINESS', 'POS', 'PHARMACIST', 'PATIENT'] as const).map(view => (
                  <button
                    key={view}
                    onClick={() => setAdminView(view)}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${adminView === view ? 'bg-slate-900 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                  >
                    {view === 'BUSINESS' ? 'Business Dashboard' :
                      view === 'POS' ? 'Dispensary POS' :
                        view === 'PHARMACIST' ? 'Pharmacist View' : 'Patient View'}
                  </button>
                ))}
              </div>
            </div>

            {adminView === 'BUSINESS' && (
              <AdminDashboard
                currentUser={currentUser}
                onUpdateUser={setCurrentUser}
                logs={aiLogs}
                users={[]}
                sales={sales}
                auditLogs={auditLogs}
                inventory={drugs}
                batches={batches}
                searchLogs={searchLogs}
              />
            )}

            {adminView === 'POS' && (
              <DispensaryDashboard
                currentUser={currentUser}
                onUpdateUser={setCurrentUser}
                drugs={drugs}
                batches={batches}
                sales={sales}
                onProcessSale={handleProcessSale}
                onCreateDrug={handleCreateDrug}
                onAddBatch={handleAddBatch}
                onReconcile={handleReconcile}
              />
            )}

            {adminView === 'PHARMACIST' && (
              <PharmacistDashboard
                currentUser={currentUser}
                onUpdateUser={setCurrentUser}
                prescriptions={prescriptions}
                inventory={inventorySummary}
                onUpdateStatus={handleLegacyUpdateStatus}
                onAddInventory={handleAddInventory}
                onUpdateInventory={handleUpdateInventory}
                onDeleteInventory={handleDeleteInventory}
                onReconcileInventory={handleReconcileInventory}
                onAddPrescription={handleAddPrescription}
              />
            )}

            {adminView === 'PATIENT' && (
              <div className="border-4 border-dashed border-slate-200 rounded-3xl p-4">
                <div className="mb-4 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">Patient View Preview</div>
                <PatientDashboard
                  prescriptions={prescriptions}
                  inventory={drugs}
                  inventoryStock={batches}
                  onAddPrescription={handleAddPrescription}
                  logAIAction={(action, details, status) => addAuditLog('AI', action, 'AI_AGENT', { details, status })}
                  notifications={notifications}
                  onMarkNotificationAsRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
                  userPrivacy={currentUser.privacySettings}
                  onUpdatePrivacy={(settings) => setCurrentUser(prev => ({ ...prev!, privacySettings: settings }))}
                  onLogSearch={handleLogSearch}
                />
              </div>
            )}
          </div>
        )}

        {/* BMS Super Admin Dashboard */}
        {currentUser.role === UserRole.SUPER_ADMIN_BMS && (
          <SuperAdminDashboard />
        )}

        {/* Dev Super Admin Dashboard with ALL Permissions */}
        {currentUser.role === UserRole.SUPER_ADMIN_DEV && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Dev Admin 5-Way Switcher */}
            <div className="flex justify-center mb-8">
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-1 rounded-xl shadow-lg inline-flex">
                {(['PATIENT', 'PHARMACIST', 'ADMIN', 'BMS', 'DEV'] as const).map(view => (
                  <button
                    key={view}
                    onClick={() => setDevAdminView(view)}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${devAdminView === view
                      ? 'bg-white text-purple-600 shadow-md'
                      : 'text-white hover:bg-white/20'
                      }`}
                  >
                    {view === 'PATIENT' ? '👤 Patient' :
                      view === 'PHARMACIST' ? '💊 Pharmacist' :
                        view === 'ADMIN' ? '🏪 Shop Owner' :
                          view === 'BMS' ? '📊 BMS Admin' : '⚙️ Dev Tools'}
                  </button>
                ))}
              </div>
            </div>

            {devAdminView === 'PATIENT' && (
              <div className="border-4 border-dashed border-purple-200 rounded-3xl p-4">
                <div className="mb-4 text-center text-purple-600 text-xs font-bold uppercase tracking-wider">Patient Dashboard (Dev View)</div>
                <PatientDashboard
                  prescriptions={prescriptions}
                  inventory={drugs}
                  inventoryStock={batches}
                  onAddPrescription={handleAddPrescription}
                  logAIAction={(action, details, status) => addAuditLog('AI', action, 'AI_AGENT', { details, status })}
                  notifications={notifications}
                  onMarkNotificationAsRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
                  userPrivacy={currentUser.privacySettings}
                  onUpdatePrivacy={(settings) => setCurrentUser(prev => ({ ...prev!, privacySettings: settings }))}
                  onLogSearch={handleLogSearch}
                />
              </div>
            )}

            {devAdminView === 'PHARMACIST' && (
              <div className="border-4 border-dashed border-purple-200 rounded-3xl p-4">
                <div className="mb-4 text-center text-purple-600 text-xs font-bold uppercase tracking-wider">Pharmacist Dashboard (Dev View)</div>
                <PharmacistDashboard
                  prescriptions={prescriptions}
                  inventory={inventorySummary}
                  onUpdateStatus={handleLegacyUpdateStatus}
                  onAddInventory={handleAddInventory}
                  onUpdateInventory={handleUpdateInventory}
                  onDeleteInventory={handleDeleteInventory}
                  onReconcileInventory={handleReconcileInventory}
                  onAddPrescription={handleAddPrescription}
                />
              </div>
            )}

            {devAdminView === 'ADMIN' && (
              <div className="border-4 border-dashed border-purple-200 rounded-3xl p-4">
                <div className="mb-4 text-center text-purple-600 text-xs font-bold uppercase tracking-wider">Shop Owner Dashboard (Dev View)</div>
                <AdminDashboard
                  logs={aiLogs}
                  users={[]}
                  sales={sales}
                  auditLogs={auditLogs}
                  inventory={drugs}
                  batches={batches}
                  searchLogs={searchLogs}
                />
              </div>
            )}

            {devAdminView === 'BMS' && (
              <div className="border-4 border-dashed border-purple-200 rounded-3xl p-4">
                <div className="mb-4 text-center text-purple-600 text-xs font-bold uppercase tracking-wider">BMS Dashboard (Dev View)</div>
                <SuperAdminDashboard />
              </div>
            )}

            {devAdminView === 'DEV' && (
              <DevDashboard />
            )}
          </div>
        )}

      </main>

      {currentUser.role !== UserRole.CUSTOMER && currentUser.role !== UserRole.SUPER_ADMIN_BMS && currentUser.role !== UserRole.SUPER_ADMIN_DEV && <ChatAssistant role={currentUser.role} />}
    </div>
  );
};

export default App;

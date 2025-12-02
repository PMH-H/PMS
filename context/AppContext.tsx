import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from \'react\';
import { supabase, checkSupabaseConnection } from \'@/services/supabase\';
import { getItems, getBatches, getStockAlerts, getPrescriptions, createAuditLog, updatePrescriptionStatus, createItem, processSale, createPrescription, updateItem } from \'@/services/database\';
import { generateUUID } from \'@/utils/uuid\';
import { UserRole, User, Prescription, PrescriptionStatus, Notification, AILog, Drug, DrugBatch, Sale, InventoryAdjustment, InventoryItem, SaleItem, SearchLog } from \'@/types\';

interface AppContextState {
  currentUser: User | null;
  loading: boolean;
  prescriptions: Prescription[];
  notifications: Notification[];
  aiLogs: AILog[];
  drugs: Drug[];
  batches: DrugBatch[];
  sales: Sale[];
  adjustments: InventoryAdjustment[];
  auditLogs: AuditLog[];
  searchLogs: SearchLog[];
  inventorySummary: InventoryItem[];
  logout: () => Promise<void>;
  addAuditLog: (entity: string, action: string, entityId: string, details: any) => void;
  addAILog: (action: string, details: string, status: \'SUCCESS\' | \'ERROR\') => void;
  handleUpdateInventory: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  handleLogSearch: (term: string, category: \'PRODUCT\' | \'SYMPTOM\') => void;
  handleAddInventory: (item: Omit<InventoryItem, \'id\'>) => Promise<void>;
  handleDeleteInventory: (id: string) => Promise<void>;
  handleReconcileInventory: (id: string, physicalCount: number) => Promise<void>;
  handleCreateDrug: (drug: Drug) => Promise<void>;
  handleAddBatch: (batch: DrugBatch) => Promise<void>;
  handleProcessSale: (items: SaleItem[], customerInfo?: string) => Promise<void>;
  handleReconcile: (adjustmentsInput: InventoryAdjustment[]) => Promise<void>;
  handleAddPrescription: (rx: Prescription) => Promise<void>;
  handleUpdatePrescriptionStatus: (id: string, status: PrescriptionStatus) => Promise<void>;
}

const AppContext = createContext<AppContextState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [aiLogs, setAiLogs] = useState<AILog[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [batches, setBatches] = useState<DrugBatch[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchLogs, setSearchLogs] = useState<SearchLog[]>([]);

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const inventorySummary: InventoryItem[] = useMemo(() => {
    return drugs.map(drug => {
      const drugBatches = batches.filter(b => b.item_id === drug.id);
      const totalStock = drugBatches.reduce((sum, b) => sum + b.current_quantity, 0);
      const earliestExpiry = drugBatches.length > 0
        ? drugBatches.sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())[0].expiry_date
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split(\'T\')[0];
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
        leadTime: 3,
        costPerUnit: avgCost,
        lastCountDate: new Date().toISOString().split(\'T\')[0]
      };
    });
  }, [drugs, batches]);

  const auditTableNameFor = (entity: string) => {
    const map: Record<string, string> = {
        \'INVENTORY\': \'items\',
        \'DRUG\': \'items\',
        \'ITEM\': \'items\',
        \'BATCH\': \'item_batches\',
        \'SALE\': \'sales\',
        \'PRESCRIPTION\': \'prescriptions\',
        \'ALERT\': \'alerts\',
        \'USER\': \'profiles\',
    };
    return map[entity] || entity.toLowerCase();
  };

  const addAuditLog = useCallback(async (entity: string, action: string, entityId: string, details: any) => {
    if (!currentUser) return;
    const tableName = auditTableNameFor(entity);
    const dbPayload: Partial<AuditLog> = {
      table_name: tableName,
      record_id: entityId ?? null,
      action: action ?? null,
      user_id: currentUser.id ?? null,
      previous_data: details?.previous ?? null,
      new_data: details?.new ?? details ?? null,
    };
    try {
      const tempId = generateUUID();
      setAuditLogs(prev => [...prev, { id: tempId, created_at: new Date().toISOString(), ...dbPayload } as AuditLog]);
      await createAuditLog(dbPayload);
    } catch (err) {
      console.error(\'addAuditLog failed (non-fatal):\', err);
    }
  }, [currentUser]);

  const addAILog = (action: string, details: string, status: \'SUCCESS\' | \'ERROR\') => {
    setAiLogs(prev => [...prev, {
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      action,
      model: \'gemini-pro\',
      status,
      latencyMs: Math.floor(Math.random() * 500) + 200,
      details
    }]);
  };

  const handleUpdateInventory = async (id: string, updates: Partial<InventoryItem>) => {
    try {
      const drug = drugs.find(d => d.id === id);
      if (!drug) {
        alert(\'Drug not found\');
        return;
      }
      const updatedDrug: Partial<Drug> = {
        name: updates.name || drug.name,
        min_level: updates.minLevel ?? drug.min_level,
        max_level: updates.maxLevel ?? drug.max_level,
        category: (updates.category as \'A\' | \'B\' | \'C\') || drug.category,
        unit: updates.unit || drug.unit
      };

      await updateItem(id, updatedDrug);
      setDrugs(prev => prev.map(d => d.id === id ? { ...d, ...updatedDrug } : d));
      addAuditLog(\'INVENTORY\', \'UPDATE\', id, updates);
      if (updates.currentStock !== undefined) {
        alert(\'Drug details updated! Note: To update stock quantities, use the Reconciliation feature or Add Batch.\');
      } else {
        alert(\'Drug details updated successfully!\');
      }
    } catch (error) {
      console.error(\'Error updating inventory:\', error);
      alert(\'Failed to update drug details.\');
    }
  };

  const handleLogSearch = (term: string, category: \'PRODUCT\' | \'SYMPTOM\') => {
    setSearchLogs(prev => [...prev, {
      id: generateUUID(),
      term,
      category,
      timestamp: new Date().toISOString()
    }]);
  };

  const handleAddInventory = async (item: Omit<InventoryItem, \'id\'>) => {
    try {
      const newDrug: Drug = {
        id: generateUUID(),
        sku: `SKU-${item.name.substring(0, 3).toUpperCase()}-${generateUUID().substring(0, 8)}`,
        name: item.name,
        barcode: `BAR-${generateUUID().substring(0, 12)}`,
        unit: item.unit || \'units\',
        category: item.category as \'A\' | \'B\' | \'C\',
        min_level: item.minLevel,
        max_level: item.maxLevel,
        created_at: new Date().toISOString()
      };

      await createItem(newDrug);
      setDrugs(prev => [...prev, newDrug]);

      if (item.currentStock > 0 && currentUser) {
        const newBatch: DrugBatch = {
          id: generateUUID(),
          item_id: newDrug.id,
          facility_id: currentUser.facility_id,
          batch_no: `BATCH-${Date.now()}`,
          expiry_date: item.expirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split(\'T\')[0],
          manufacture_date: new Date().toISOString().split(\'T\')[0],
          received_quantity: item.currentStock,
          current_quantity: item.currentStock,
          cost_per_unit: item.costPerUnit || 0,
          created_at: new Date().toISOString()
        };
        await handleAddBatch(newBatch);
      }

      addAuditLog(\'INVENTORY\', \'CREATE\', newDrug.id, newDrug);
    } catch (error) {
      console.error(\'Error adding inventory:\', error);
      alert(\'Failed to add inventory item.\');
    }
  };

  const handleDeleteInventory = async (id: string) => {
    if (!confirm(\'Are you sure you want to delete this item? This will also delete all batches.\')) return;

    try {
      await supabase.from(\'items\').delete().eq(\'id\', id);
      setDrugs(prev => prev.filter(d => d.id !== id));
      setBatches(prev => prev.filter(b => b.item_id !== id));
      addAuditLog(\'INVENTORY\', \'DELETE\', id, {});
    } catch (error) {
      console.error(\'Error deleting inventory:\', error);
      alert(\'Failed to delete inventory item.\');
    }
  };

  const handleReconcileInventory = async (id: string, physicalCount: number) => {
    if (!currentUser) return;
    try {
      const drugBatches = batches.filter(b => b.item_id === id).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      if (drugBatches.length === 0) {
        alert(\'No batches found for this item.\');
        return;
      }

      const batch = drugBatches[0];
      const difference = physicalCount - batch.current_quantity;

      const adjustment: InventoryAdjustment = {
        id: generateUUID(),
        batch_id: batch.id,
        item_id: id,
        quantity_change: difference,
        reason: \'Physical count reconciliation\',
        adjusted_by: currentUser.id,
        created_at: new Date().toISOString()
      };

      await handleReconcile([adjustment]);
    } catch (error) {
      console.error(\'Error reconciling inventory:\', error);
      alert(\'Failed to reconcile inventory.\');
    }
  };

  const handleCreateDrug = async (drug: Drug) => {
    try {
      const created = await createItem(drug);
      setDrugs(prev => [...prev, created as Drug]);
      addAuditLog(\'DRUG\', \'CREATE\', created.id, created);
    } catch (error) {
      console.error(\'Error creating drug:\', error);
      alert(\'Failed to create drug. Please try again.\');
      throw error;
    }
  };

  const handleAddBatch = async (batch: DrugBatch) => {
    if (!currentUser) {
        alert(\'You must be logged in to add a batch.\');
        return;
    }
    try {
      const { data, error } = await supabase
        .from(\'item_batches\')
        .insert([
            { ...batch, facility_id: currentUser.facility_id }
        ])
        .select()
        .single();

      if (error) throw error;
      
      const newBatch = data as DrugBatch;
      setBatches(prev => [...prev, newBatch]);
      addAuditLog(\'BATCH\', \'CREATE\', newBatch.id, newBatch);

      const drug = drugs.find(d => d.id === newBatch.item_id);
      if (drug && currentUser.facility_id) {
        const newNotification: Notification = {
          id: generateUUID(),
          message: `New Batch Added: ${drug.name} (${newBatch.batch_no})`,
          timestamp: new Date().toISOString(),
          read: false,
          type: \'STOCK_UPDATE\'
        };
        setNotifications(prev => [newNotification, ...prev]);

        await supabase.from(\'alerts\').insert([{\
            facility_id: currentUser.facility_id,\
            type: \'STOCK_UPDATE\',\
            message: newNotification.message,\
            item_id: drug.id\
        }]);
      }
    } catch (error) {
      console.error(\'Error adding batch:\', error);
      alert(\'Failed to add batch. Please try again.\');
    }
  };

  const handleProcessSale = async (items: SaleItem[], customerInfo?: string) => {
    if (!currentUser?.facility_id) {
        alert("Error: User not assigned to a facility. Cannot process sale.");
        return;
    }
    try {
      const sale = await processSale(currentUser.facility_id, items, customerInfo);
      setSales(prev => [sale, ...prev]);
      addAuditLog(\'SALE\', \'CREATE\', sale.id, sale);
      await fetchInventoryData(currentUser.facility_id);
      alert("Sale processed successfully!");
    } catch (error: any) {
      console.error("Transaction Failed:", error);
      alert(`Transaction Failed: ${error.message || "Insufficient Stock"}`);
    }
  };

  const handleReconcile = async (adjustmentsInput: InventoryAdjustment[]) => {
    if (!currentUser?.facility_id) return;

    try {
      for (const adj of adjustmentsInput) {
        const { data: batch } = await supabase.from(\'item_batches\').select(\'current_quantity\').eq(\'id\', adj.batch_id).single();
        if (batch) {
          const newQty = batch.current_quantity + adj.quantity_change;
          await supabase.from(\'item_batches\').update({ current_quantity: newQty }).eq(\'id\', adj.batch_id);

          await supabase.from(\'stock_movements\').insert([{\
            item_id: adj.item_id,\
            batch_id: adj.batch_id,\
            facility_id: currentUser.facility_id,\
            movement_type: adj.quantity_change > 0 ? \'ADJUST_UP\' : \'ADJUST_DOWN\',\
            quantity: Math.abs(adj.quantity_change),\
            reason: adj.reason,\
            performed_by: currentUser.id\
          }]);
        }
      }

      setAdjustments(prev => [...prev, ...adjustmentsInput]);
      await fetchInventoryData(currentUser.facility_id);
      addAuditLog(\'INVENTORY\', \'RECONCILE\', \'BATCH\', { count: adjustmentsInput.length });

    } catch (error) {
      console.error("Reconciliation failed:", error);
      alert("Failed to process reconciliation.");
    }
  };

  const handleAddPrescription = async (rx: Prescription) => {
    if(!currentUser) return;
    try {
      const prescriptionWithUser = { ...rx, patient_id: currentUser.id };
      await createPrescription(prescriptionWithUser);
      setPrescriptions(prev => [rx, ...prev]);
      addAuditLog(\'PRESCRIPTION\', \'CREATE\', rx.id, rx);
    } catch (error) {
      console.error(\'Error saving prescription:\', error);
      alert(\'Failed to save prescription. Please try again.\');
    }
  };

  const handleUpdatePrescriptionStatus = async (id: string, status: PrescriptionStatus) => {
    try {
      await updatePrescriptionStatus(id, status);
      setPrescriptions(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    } catch (error) {
      console.error(\'Error updating prescription status:\', error);
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      setLoading(true);
      await checkSupabaseConnection();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchUserProfile(session.user.id, session.user.email || \'\');
      } else {
        setLoading(false);
      }
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === \'SIGNED_IN\' && session?.user) {
          await fetchUserProfile(session.user.id, session.user.email || \'\');
        } else if (event === \'SIGNED_OUT\') {
          setCurrentUser(null);
        }
      });
      return () => subscription.unsubscribe();
    };
    initializeApp();
  }, []);

  const fetchUserProfile = async (userId: string, email: string) => {
    let attempts = 0;
    const maxAttempts = 5;
    const delay = 1000; // 1 second

    while (attempts < maxAttempts) {
        try {
            const { data, error } = await supabase.from(\'profiles\').select(\'*\').eq(\'id\', userId).single();

            if (error && error.code === \'PGRST116\') { // "The result contains 0 rows"
                // Profile not found, wait and retry
                attempts++;
                if (attempts >= maxAttempts) {
                    setLoading(false);
                    throw new Error(`Profile not found after ${maxAttempts} attempts.`);
                }
                console.warn(`Attempt ${attempts}: Profile not found. Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
                continue; // Retry the loop
            }
            
            if (error) {
                // For other errors, throw immediately
                throw error;
            }

            if (data) {
                // Profile found, set the user and exit
                setCurrentUser({
                    id: data.id,
                    full_name: data.full_name || email.split(\'@\')[0],
                    role: data.role as UserRole,
                    facility_id: data.facility_id,
                    privacySettings: data.preferences || { shareBrowsing: true, sharePurchaseHistory: true, allowAI: true, anonymousMode: false, allowCamera: false }
                });
                setLoading(false);
                return; // Success
            }

        } catch (err) {
            console.error("Error fetching profile:", err);
            setLoading(false);
            return; // Exit on other errors
        }
    }
  };

  useEffect(() => {
    if(currentUser?.facility_id) fetchInventoryData(currentUser.facility_id);
    if(currentUser?.role === UserRole.CUSTOMER) fetchPrescriptionData(currentUser.id);
  }, [currentUser]);

  const fetchInventoryData = async (facilityId: string) => {
    try {
      const [items, batchData, alerts] = await Promise.all([ getItems(), getBatches(facilityId), getStockAlerts(facilityId) ]);
      setDrugs(items as Drug[] || []);
      setBatches(batchData as DrugBatch[] || []);
      if (alerts) {
        const mappedNotifications: Notification[] = alerts.map(a => ({ id: a.id, message: a.message, timestamp: a.created_at, read: a.is_read, type: a.type as any }));
        setNotifications(mappedNotifications);
      }
    } catch (error) {
      console.error("Error fetching inventory data:", error);
    }
  };

  const fetchPrescriptionData = async (patientId: string) => {
    try {
        const rxData = await getPrescriptions(patientId);
        if (rxData) {
            const mapped: Prescription[] = rxData.map(rx => ({ id: rx.id, patientName: currentUser?.full_name ?? \'N/A\', date: new Date(rx.created_at).toISOString().split(\'T\')[0], medications: rx.medications as any, status: rx.status as any, imageUrl: rx.image_url, interactions: rx.interactions as any }));
            setPrescriptions(mapped);
        }
    } catch (error) {
        console.error("Error fetching prescriptions:", error);
    }
  }

  const value = {
    currentUser,
    loading,
    prescriptions,
    notifications,
    aiLogs,
    drugs,
    batches,
    sales,
    adjustments,
    auditLogs,
    searchLogs,
    inventorySummary,
    logout,
    addAuditLog,
    addAILog,
    handleUpdateInventory,
    handleLogSearch,
    handleAddInventory,
    handleDeleteInventory,
    handleReconcileInventory,
    handleCreateDrug,
    handleAddBatch,
    handleProcessSale,
    handleReconcile,
    handleAddPrescription,
    handleUpdatePrescriptionStatus
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error(\'useAppContext must be used within an AppProvider\');
  }
  return context;
};

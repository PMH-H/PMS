import React, { useState, useMemo, useRef } from 'react';
import { Drug, DrugBatch, SaleItem, User, UserRole, InventoryAdjustment, Sale, Medication, EntryMethod } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import { extractDrugDetails, analyzePrescriptionImage } from '../services/geminiService';
import { generateUUID } from '../utils/uuid';

interface DispensaryDashboardProps {
    currentUser: User;
    drugs: Drug[];
    batches: DrugBatch[];
    sales?: Sale[];
    onProcessSale: (items: SaleItem[], customerInfo?: string) => void;
    onCreateDrug: (drug: Drug) => Promise<void>;
    onUpdateDrug: (id: string, updates: Partial<Drug>) => void;
    onDeleteDrug: (id: string) => void;
    onAddBatch: (batch: DrugBatch) => void;
    onReconcile: (adjustments: InventoryAdjustment[]) => void;
}

const DispensaryDashboard: React.FC<DispensaryDashboardProps> = ({
    currentUser, drugs, batches, sales = [], onProcessSale, onCreateDrug, onUpdateDrug, onDeleteDrug, onAddBatch, onReconcile
}) => {
    const [activeTab, setActiveTab] = useState<'POS' | 'INVENTORY' | 'RECONCILE' | 'REPORTS'>('POS');

    // -- POS State --
    const [cart, setCart] = useState<SaleItem[]>([]);
    const [barcodeInput, setBarcodeInput] = useState('');
    const [posError, setPosError] = useState('');
    const [posWarning, setPosWarning] = useState('');
    const [lastScannedDrug, setLastScannedDrug] = useState<Drug | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showRxModal, setShowRxModal] = useState(false);
    const [showManualSaleModal, setShowManualSaleModal] = useState(false);

    // POS Edit State
    const [editingCartItem, setEditingCartItem] = useState<{ index: number, item: SaleItem } | null>(null);

    // Manual Sale Form
    const [manualSaleForm, setManualSaleForm] = useState<{ drugId: string, qty: number, price: number, nameQuery: string }>({
        drugId: '', qty: 1, price: 0, nameQuery: ''
    });

    // Payment & Success Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [lastSaleDetails, setLastSaleDetails] = useState<{ id: string, total: number, change: number, customer: string } | null>(null);

    // Payment Form State
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'MOBILE_MONEY'>('CASH');
    const [amountTendered, setAmountTendered] = useState<string>('');
    const [customerName, setCustomerName] = useState('');

    // -- Inventory State --
    const [showDrugModal, setShowDrugModal] = useState(false);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [selectedDrugId, setSelectedDrugId] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [formError, setFormError] = useState('');

    // -- Scanner State --
    const [isScanning, setIsScanning] = useState(false);
    const [scanContext, setScanContext] = useState<'POS' | 'CREATE_DRUG' | 'INVENTORY_LOOKUP'>('POS');

    // Forms
    interface DrugForm extends Partial<Drug> {
        initialStock?: number;
        expiryDate?: string;
        manufactureDate?: string; // MFD
        costPerUnit?: number;
        batchNo?: string;
    }

    const [drugForm, setDrugForm] = useState<DrugForm>({ category: 'B', unit: 'units' });
    const [batchForm, setBatchForm] = useState<Partial<DrugBatch>>({});

    // -- Reconciliation State --
    const [reconcileCounts, setReconcileCounts] = useState<{ [batchId: string]: number }>({});
    const [showReconcilePreview, setShowReconcilePreview] = useState(false);

    // --- POS HELPERS ---

    const checkExpiryWarning = (drugId: string) => {
        const drugBatches = batches.filter(b => b.item_id === drugId && b.current_quantity > 0);
        if (drugBatches.length === 0) return null;

        // Sort by expiry
        drugBatches.sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
        const nearest = drugBatches[0];

        const daysUntilExpiry = (new Date(nearest.expiry_date).getTime() - Date.now()) / (1000 * 3600 * 24);
        if (daysUntilExpiry < 30) {
            return `⚠️ Warning: Batch ${nearest.batch_no} expires in ${Math.ceil(daysUntilExpiry)} days!`;
        }
        return null;
    };

    const processScanCode = (code: string) => {
        if (scanContext === 'POS') {
            const drug = drugs.find(d => d.barcode === code || d.sku === code);
            if (drug) {
                addDrugToCart(drug, 'SCAN');
                setBarcodeInput('');
            } else {
                setPosError(`Item not found: ${code}`);
                setLastScannedDrug(null);
            }
        } else if (scanContext === 'CREATE_DRUG') {
            setDrugForm(prev => ({ ...prev, barcode: code }));
        } else if (scanContext === 'INVENTORY_LOOKUP') {
            const drug = drugs.find(d => d.barcode === code || d.sku === code);
            if (drug) {
                setSelectedDrugId(drug.id);
                setShowBatchModal(true);
            } else {
                setDrugForm(prev => ({ ...prev, barcode: code, category: 'B', unit: 'units' }));
                setShowDrugModal(true);
            }
        }
        setIsScanning(false);
    };

    const addDrugToCart = (drug: Drug, method: EntryMethod, overrideQty?: number, overridePrice?: number) => {
        const drugBatches = batches.filter(b => b.item_id === drug.id);
        const totalStock = drugBatches.reduce((sum, b) => sum + b.current_quantity, 0);
        const price = overridePrice !== undefined ? overridePrice : (drug.price_estimate || (drugBatches.length > 0 ? drugBatches[0].cost_per_unit : 0));
        const qty = overrideQty || 1;

        setLastScannedDrug(drug);
        setPosError('');
        setPosWarning('');

        if (totalStock <= 0) {
            setPosError(`Out of Stock: ${drug.name}`);
        } else {
            const warning = checkExpiryWarning(drug.id);
            if (warning) setPosWarning(warning);

            setCart(prev => {
                if (method === 'SCAN' || method === 'SEARCH') {
                    const existing = prev.find(item => item.item_id === drug.id && item.unit_price === price);
                    if (existing) {
                        return prev.map(item => item.item_id === drug.id && item.unit_price === price ? { ...item, quantity: item.quantity + qty } : item);
                    }
                }
                return [...prev, { item_id: drug.id, quantity: qty, unit_price: price, entry_method: method }];
            });
        }
    };

    const handleManualScanSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPosError('');
        const drug = drugs.find(d => d.barcode === barcodeInput || d.sku === barcodeInput);
        if (drug) {
            addDrugToCart(drug, 'MANUAL');
            setBarcodeInput('');
        } else {
            setPosError(`Item not found: ${barcodeInput}`);
        }
    };

    const handleSearchSelect = (drug: Drug) => {
        addDrugToCart(drug, 'SEARCH');
        setSearchTerm('');
    };

    const submitManualSale = () => {
        if (!manualSaleForm.drugId) return;
        const drug = drugs.find(d => d.id === manualSaleForm.drugId);
        if (drug) {
            addDrugToCart(drug, 'MANUAL', manualSaleForm.qty, manualSaleForm.price);
            setShowManualSaleModal(false);
            setManualSaleForm({ drugId: '', qty: 1, price: 0, nameQuery: '' });
        }
    };

    const handleRxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const meds = await analyzePrescriptionImage(base64);

            let matchedCount = 0;
            meds.forEach(m => {
                const match = drugs.find(d => d.name.toLowerCase().includes(m.name.toLowerCase()) || d.generic_name?.toLowerCase().includes(m.name.toLowerCase()));
                if (match) {
                    addDrugToCart(match, 'SCAN');
                    matchedCount++;
                }
            });

            setIsAnalyzing(false);
            setShowRxModal(false);
            if (matchedCount > 0) {
                alert(`Added ${matchedCount} detected items to cart.`);
            } else {
                alert("Could not automatically match items. Please search manually.");
            }
        };
    };

    const updateCartItem = (idx: number, updates: Partial<SaleItem>) => {
        setCart(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));
    };

    const handleCheckoutClick = () => {
        if (cart.length === 0) return;
        setAmountTendered('');
        setCustomerName('');
        setPaymentMethod('CASH');
        setShowPaymentModal(true);
    };

    const cartTotal = cart.reduce((acc, i) => acc + (i.quantity * i.unit_price), 0);
    const changeAmount = paymentMethod === 'CASH' && amountTendered
        ? Math.max(0, parseFloat(amountTendered) - cartTotal)
        : 0;

    const handlePaymentComplete = () => {
        onProcessSale(cart, customerName || "Walk-in Customer");

        setLastSaleDetails({
            id: generateUUID().split('-')[0].toUpperCase(),
            total: cartTotal,
            change: changeAmount,
            customer: customerName || "Walk-in Customer"
        });

        setCart([]);
        setLastScannedDrug(null);
        setPosError('');
        setPosWarning('');
        setShowPaymentModal(false);
        setShowReceiptModal(true);
    };

    const openScanner = (context: 'POS' | 'CREATE_DRUG' | 'INVENTORY_LOOKUP') => {
        setScanContext(context);
        setIsScanning(true);
    };

    // --- INVENTORY HELPERS ---

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'front_image_url' | 'back_image_url') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setDrugForm(prev => ({ ...prev, [field]: base64 }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAIAutoFill = async (imageSrc: string | undefined, formType: 'DRUG' | 'BATCH') => {
        if (!imageSrc) {
            alert("Please upload an image first.");
            return;
        }

        setIsAnalyzing(true);
        const base64Data = imageSrc.split(',')[1];
        const extracted = await extractDrugDetails(base64Data);

        if (extracted) {
            if (formType === 'DRUG') {
                setDrugForm(prev => ({
                    ...prev,
                    name: extracted.name || prev.name,
                    batchNo: extracted.batch_no || prev.batchNo,
                    expiryDate: extracted.expiry_date || prev.expiryDate,
                    manufactureDate: extracted.manufacture_date || prev.manufacture_date,
                    sku: extracted.sku || prev.sku || prev.barcode
                }));
            } else {
                setBatchForm(prev => ({
                    ...prev,
                    batch_no: extracted.batch_no || prev.batch_no,
                    expiry_date: extracted.expiry_date || prev.expiry_date,
                    manufacture_date: extracted.manufacture_date || prev.manufacture_date
                }));
            }
        }
        setIsAnalyzing(false);
    };

    const submitDrug = async () => {
        setFormError('');
        if (!drugForm.name || !drugForm.category || !drugForm.unit) {
            setFormError("Name, Category, and Unit are required.");
            return;
        }
        if (drugForm.initialStock && drugForm.initialStock > 0) {
            if (!drugForm.batchNo || !drugForm.expiryDate || !drugForm.manufactureDate) {
                setFormError("Batch No, Expiry Date (EPD), and Manufacture Date (MFD) are required for stock entry.");
                return;
            }
        }

        const newDrugId = generateUUID();
        // Ensure SKU exists or generate one
        const finalSku = drugForm.sku || `SKU-${drugForm.name.substring(0, 3).toUpperCase()}-${generateUUID().substring(0, 8)}`;

        const newDrug: Drug = {
            id: newDrugId,
            sku: finalSku,
            name: drugForm.name,
            barcode: drugForm.barcode || `BAR-${generateUUID().substring(0, 12)}`,
            front_image_url: drugForm.front_image_url,
            back_image_url: drugForm.back_image_url,
            category: drugForm.category || 'B',
            unit: drugForm.unit || 'units',
            min_level: drugForm.min_level || 0,
            max_level: drugForm.max_level || 0,
            price_cents: drugForm.price_cents || 0,
            created_at: new Date().toISOString()
        };

        try {
            await onCreateDrug(newDrug);

            if (drugForm.initialStock && drugForm.initialStock > 0) {
                const newBatch: DrugBatch = {
                    id: generateUUID(),
                    item_id: newDrugId,
                    facility_id: currentUser.facility_id || '', // Required field
                    batch_no: drugForm.batchNo!,
                    expiry_date: drugForm.expiryDate!,
                    manufacture_date: drugForm.manufactureDate,
                    received_quantity: drugForm.initialStock,
                    current_quantity: drugForm.initialStock,
                    cost_per_unit: drugForm.costPerUnit || 0,
                    created_at: new Date().toISOString()
                };
                onAddBatch(newBatch);
            }

            setDrugForm({ category: 'B', unit: 'units' });
        } catch (error) {
            console.error("Error creating drug:", error);
            setFormError("Failed to create drug. SKU might be duplicate.");
        }
    };

    const submitBatch = () => {
        setFormError('');
        if (!selectedDrugId) return;
        if (!batchForm.batch_no || !batchForm.expiry_date || !batchForm.manufacture_date || !batchForm.received_quantity) {
            setFormError("Batch No, MFD, EPD, and Quantity are mandatory.");
            return;
        }

        onAddBatch({
            ...batchForm,
            id: generateUUID(),
            item_id: selectedDrugId,
            facility_id: currentUser.facility_id || '',
            current_quantity: batchForm.received_quantity,
            created_at: new Date().toISOString()
        } as DrugBatch);
        setShowBatchModal(false);
        setBatchForm({});
    };

    // --- RECONCILIATION HELPERS ---

    const previewReconciliation = useMemo(() => {
        const deltas: { batch: DrugBatch, drug: Drug, system: number, physical: number, delta: number, val: number }[] = [];

        Object.entries(reconcileCounts).forEach(([batchId, count]) => {
            const qty = count as number;
            const batch = batches.find(b => b.id === batchId);
            const drug = drugs.find(d => d.id === batch?.item_id);
            if (batch && drug) {
                const delta = qty - batch.current_quantity;
                if (delta !== 0) {
                    deltas.push({
                        batch, drug,
                        system: batch.current_quantity,
                        physical: qty,
                        delta,
                        val: delta * batch.cost_per_unit
                    });
                }
            }
        });
        return deltas;
    }, [reconcileCounts, batches, drugs]);

    const confirmReconciliation = () => {
        const adjs: InventoryAdjustment[] = previewReconciliation.map(d => ({
            id: generateUUID(),
            drug_batch_id: d.batch.id,
            drug_id: d.drug.id,
            change_quantity: d.delta,
            reason: 'Audit Reconciliation',
            adjusted_by: currentUser.id,
            created_at: new Date().toISOString()
        }));
        onReconcile(adjs);
        setShowReconcilePreview(false);
        setReconcileCounts({});
        alert(`Successfully processed ${adjs.length} adjustments.`);
    };

    // --- REPORTS ---
    const todaySales = sales.filter(s => s.created_at.split('T')[0] === new Date().toISOString().split('T')[0]);
    const todayTotal = todaySales.reduce((sum, s) => sum + s.total_price, 0);

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-[600px] flex flex-col relative w-full">

            {/* Camera Scanner Overlay */}
            {isScanning && (
                <BarcodeScanner
                    onScan={processScanCode}
                    onClose={() => setIsScanning(false)}
                />
            )}

            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2 self-start md:self-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-emerald-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.74-.39 2.323-1.019.582.63 1.425 1.019 2.323 1.019.896 0 1.74-.39 2.323-1.019A2.993 2.993 0 0017.25 9.35m-15.122 0h15.122" />
                    </svg>
                    <h2 className="text-xl font-bold tracking-wide">Dispensary Module</h2>
                </div>
                <div className="flex gap-2 text-sm font-semibold w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                    {['POS', 'INVENTORY', 'RECONCILE', 'REPORTS'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-emerald-500 text-white' : 'hover:bg-slate-800 text-slate-400'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-grow p-4 sm:p-6 bg-slate-50">
                {/* --- POS TAB --- */}
                {activeTab === 'POS' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                        <div className="lg:col-span-2 space-y-6">
                            {/* Actions / Inputs */}
                            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 w-full space-y-4">
                                <div className="flex flex-col md:flex-row gap-3">
                                    {/* Mobile: Grid, Desktop: Flex */}
                                    <div className="grid grid-cols-2 gap-3 md:flex md:flex-none">
                                        <button
                                            type="button"
                                            onClick={() => openScanner('POS')}
                                            className="bg-slate-800 text-white px-4 py-3 rounded-lg hover:bg-slate-700 flex items-center justify-center gap-2"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /></svg>
                                            <span className="truncate">Scan</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowManualSaleModal(true)}
                                            className="bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                                            <span className="truncate">Manual</span>
                                        </button>
                                    </div>
                                    <div className="relative flex-grow">
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="Quick search drug..."
                                            className="w-full h-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none min-w-0"
                                        />
                                        {searchTerm && (
                                            <div className="absolute top-full left-0 right-0 bg-white shadow-xl border border-gray-200 mt-1 rounded-lg z-50 max-h-48 overflow-y-auto">
                                                {drugs.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())).map(d => (
                                                    <div
                                                        key={d.id}
                                                        onClick={() => handleSearchSelect(d)}
                                                        className="p-3 hover:bg-emerald-50 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-0"
                                                    >
                                                        <span className="font-medium">{d.name}</span>
                                                        <span className="text-xs text-gray-400">{d.sku}</span>
                                                    </div>
                                                ))}
                                                {drugs.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                                                    <div className="p-3 text-gray-400 text-sm">No match found.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <form onSubmit={handleManualScanSubmit} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={barcodeInput}
                                        onChange={e => setBarcodeInput(e.target.value)}
                                        placeholder="Or enter SKU / Barcode directly..."
                                        className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm min-w-0"
                                    />
                                    <button type="submit" className="bg-gray-200 text-gray-700 px-6 rounded-lg font-bold hover:bg-gray-300 flex-shrink-0">ADD</button>
                                </form>

                                {/* Alerts */}
                                {posError && <p className="text-red-600 font-bold bg-red-50 p-2 rounded border border-red-200 text-sm">{posError}</p>}
                                {posWarning && <p className="text-orange-600 font-bold bg-orange-50 p-2 rounded border border-orange-200 text-sm">{posWarning}</p>}
                            </div>

                            {/* Quick Select Grid */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-gray-500 font-bold text-xs uppercase mb-4">Quick Add (Common Items)</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {drugs.slice(0, 4).map(d => (
                                        <button
                                            key={d.id}
                                            onClick={() => addDrugToCart(d, 'SEARCH')}
                                            className="p-3 border border-gray-200 rounded-lg hover:border-emerald-400 hover:bg-emerald-50 text-left transition-all"
                                        >
                                            <div className="font-bold text-gray-800 truncate text-sm">{d.name}</div>
                                            <div className="text-xs text-gray-400">{d.sku}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Cart */}
                        <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col h-full mt-6 lg:mt-0">
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-gray-800">Current Sale</h3>
                                    <p className="text-xs text-gray-500">New Order</p>
                                </div>
                                <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded font-bold">{cart.length} Items</span>
                            </div>
                            <div className="flex-grow overflow-y-auto p-4 space-y-3 min-h-[200px] lg:min-h-0">
                                {cart.length === 0 && (
                                    <div className="text-center text-gray-400 mt-10">Cart is empty</div>
                                )}
                                {cart.map((item, idx) => {
                                    const d = drugs.find(drug => drug.id === item.item_id);
                                    const isEditing = editingCartItem?.index === idx;
                                    const warning = checkExpiryWarning(item.item_id);
                                    return (
                                        <div key={idx} className="border-b border-gray-100 pb-2">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="font-medium text-gray-900 text-sm">{d?.name}</div>
                                                <div className="font-bold text-gray-800 text-sm">ZMW {(item.quantity * item.unit_price).toFixed(2)}</div>
                                            </div>
                                            {warning && <div className="text-[10px] text-orange-600 bg-orange-50 px-1 mb-1 rounded">{warning}</div>}

                                            {isEditing ? (
                                                <div className="flex gap-2 items-center bg-gray-50 p-2 rounded">
                                                    <div>
                                                        <label className="text-[10px] uppercase text-gray-500 font-bold">Qty</label>
                                                        <input
                                                            type="number" min="1"
                                                            className="w-16 border rounded p-1 text-sm"
                                                            value={editingCartItem!.item.quantity}
                                                            onChange={e => setEditingCartItem(prev => ({ ...prev!, item: { ...prev!.item, quantity: parseInt(e.target.value) || 1 } }))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] uppercase text-gray-500 font-bold">Price</label>
                                                        <input
                                                            type="number" min="0" step="0.1"
                                                            className="w-20 border rounded p-1 text-sm"
                                                            value={editingCartItem!.item.unit_price}
                                                            onChange={e => setEditingCartItem(prev => ({ ...prev!, item: { ...prev!.item, unit_price: parseFloat(e.target.value) || 0 } }))}
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => { updateCartItem(idx, editingCartItem!.item); setEditingCartItem(null); }}
                                                        className="bg-green-500 text-white px-3 py-1 rounded text-xs ml-auto"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between items-center text-sm text-gray-500">
                                                    <span>{item.quantity} x {item.unit_price.toFixed(2)}</span>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setEditingCartItem({ index: idx, item: { ...item } })} className="text-indigo-600 hover:text-indigo-800 text-xs font-bold">Edit</button>
                                                        <button onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 text-xs font-bold">Remove</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="p-4 bg-gray-50 border-t border-gray-200">
                                <div className="flex justify-between items-center mb-4 text-xl font-bold text-gray-900">
                                    <span>Total</span>
                                    <span>ZMW {cartTotal.toFixed(2)}</span>
                                </div>
                                <button
                                    onClick={handleCheckoutClick}
                                    disabled={cart.length === 0}
                                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    CHECKOUT
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- RENDER OTHER TABS --- */}
                {/* --- INVENTORY TAB --- */}
                {activeTab === 'INVENTORY' && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">Stock Management</h3>
                                <p className="text-sm text-gray-500">Scan items to add stock or create new products.</p>
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                                <button
                                    onClick={() => openScanner('INVENTORY_LOOKUP')}
                                    className="flex-1 sm:flex-none bg-slate-800 text-white px-4 py-2 rounded-lg font-medium shadow hover:bg-slate-700 flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75zM15 18.75h1.5M16.5 15h1.5" />
                                    </svg>
                                    Scan to Receive
                                </button>
                                <button
                                    onClick={() => { setDrugForm({ category: 'B', unit: 'units' }); setShowDrugModal(true); }}
                                    className="flex-1 sm:flex-none bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium shadow hover:bg-indigo-700 flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                    New Product
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
                            <table className="w-full text-left text-sm min-w-[700px]">
                                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-4">Drug Details</th>
                                        <th className="px-6 py-4">Category</th>
                                        <th className="px-6 py-4">Total Stock</th>
                                        <th className="px-6 py-4">Batches</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {drugs.map(drug => {
                                        const drugBatches = batches.filter(b => b.item_id === drug.id);
                                        const totalStock = drugBatches.reduce((sum, b) => sum + b.current_quantity, 0);
                                        return (
                                            <tr key={drug.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {drug.image_front ? (
                                                            <img src={drug.image_front} alt="" className="w-12 h-12 object-cover rounded border" />
                                                        ) : (
                                                            <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-400">Img</div>
                                                        )}
                                                        <div>
                                                            <div className="font-bold text-gray-900">{drug.name}</div>
                                                            <div className="text-xs text-gray-500">SKU: {drug.sku} | Barcode: {drug.barcode}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${drug.category === 'A' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        Class {drug.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`font-mono font-bold ${totalStock < drug.min_level ? 'text-red-600' : 'text-emerald-600'}`}>
                                                        {totalStock} {drug.unit}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1">
                                                        {drugBatches.map(b => {
                                                            // Highlight expiry
                                                            const isExpiring = new Date(b.expiry_date).getTime() < (Date.now() + 1000 * 3600 * 24 * 30);
                                                            return (
                                                                <div key={b.id} className={`text-xs px-2 py-1 rounded flex justify-between ${isExpiring ? 'bg-red-100 text-red-800' : 'bg-gray-100'}`}>
                                                                    <span>{b.batch_no} (Exp: {b.expiry_date})</span>
                                                                    <span className="font-bold">{b.current_quantity}</span>
                                                                </div>
                                                            );
                                                        })}
                                                        {drugBatches.length === 0 && <span className="text-xs text-gray-400 italic">No batches</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <button
                                                            onClick={() => {
                                                                setDrugForm({
                                                                    ...drug,
                                                                    category: drug.category || 'B',
                                                                    unit: drug.unit || 'units'
                                                                });
                                                                setShowDrugModal(true);
                                                            }}
                                                            className="text-xs bg-white border border-indigo-300 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-50"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`Delete ${drug.name}? This will also delete all batches.`)) {
                                                                    onDeleteDrug(drug.id);
                                                                }
                                                            }}
                                                            className="text-xs bg-white border border-red-300 text-red-600 px-2 py-1 rounded hover:bg-red-50"
                                                        >
                                                            Del
                                                        </button>
                                                        <button
                                                            onClick={() => { setSelectedDrugId(drug.id); setShowBatchModal(true); }}
                                                            className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-50"
                                                        >
                                                            + Batch
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- REPORTS TAB --- */}
                {activeTab === 'REPORTS' && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h3 className="font-bold text-xl text-gray-900 mb-4">Daily Sales Summary</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                <div className="bg-indigo-50 p-4 rounded-lg">
                                    <p className="text-sm text-indigo-800 font-bold uppercase">Today's Revenue</p>
                                    <p className="text-3xl font-bold text-indigo-900">ZMW {todayTotal.toFixed(2)}</p>
                                </div>
                                <div className="bg-emerald-50 p-4 rounded-lg">
                                    <p className="text-sm text-emerald-800 font-bold uppercase">Transactions</p>
                                    <p className="text-3xl font-bold text-emerald-900">{todaySales.length}</p>
                                </div>
                                <div className="bg-orange-50 p-4 rounded-lg">
                                    <p className="text-sm text-orange-800 font-bold uppercase">Items Sold</p>
                                    <p className="text-3xl font-bold text-orange-900">{todaySales.reduce((acc, s) => acc + s.items.reduce((a, i) => a + i.quantity, 0), 0)}</p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 uppercase text-xs text-gray-500">
                                        <tr>
                                            <th className="px-4 py-3">Time</th>
                                            <th className="px-4 py-3">ID</th>
                                            <th className="px-4 py-3">Customer</th>
                                            <th className="px-4 py-3">Items</th>
                                            <th className="px-4 py-3 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {todaySales.slice().reverse().map(sale => (
                                            <tr key={sale.id} className="border-b hover:bg-gray-50">
                                                <td className="px-4 py-3">{new Date(sale.created_at).toLocaleTimeString()}</td>
                                                <td className="px-4 py-3 font-mono text-xs">{sale.id.slice(0, 8)}</td>
                                                <td className="px-4 py-3">{sale.customer_info}</td>
                                                <td className="px-4 py-3">{sale.items.length}</td>
                                                <td className="px-4 py-3 text-right font-bold">ZMW {sale.total_price.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        {todaySales.length === 0 && (
                                            <tr><td colSpan={5} className="text-center py-8 text-gray-400">No sales today.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- RECONCILIATION TAB --- */}
                {activeTab === 'RECONCILE' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                            <div className="p-4 bg-indigo-50 border-b border-indigo-100">
                                <h3 className="font-bold text-indigo-900">Physical Count Entry</h3>
                                <p className="text-xs text-indigo-700">Enter counts for batches found on shelf.</p>
                            </div>
                            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                                {drugs.map(drug => {
                                    const drugBatches = batches.filter(b => b.item_id === drug.id);
                                    if (drugBatches.length === 0) return null;
                                    return (
                                        <div key={drug.id} className="border border-gray-200 rounded-lg p-3">
                                            <div className="font-bold text-gray-700 mb-2">{drug.name}</div>
                                            <div className="space-y-2">
                                                {drugBatches.map(b => (
                                                    <div key={b.id} className="flex items-center justify-between text-sm">
                                                        <div className="text-gray-500">
                                                            Batch <span className="font-mono text-gray-800">{b.batch_no}</span>
                                                            <span className="text-xs ml-2">(Sys: {b.current_quantity})</span>
                                                        </div>
                                                        <input
                                                            type="number"
                                                            placeholder="Actual"
                                                            value={reconcileCounts[b.id] ?? ''}
                                                            onChange={e => setReconcileCounts(prev => ({ ...prev, [b.id]: parseInt(e.target.value) || 0 }))}
                                                            className="w-24 border border-gray-300 rounded px-2 py-1 text-right bg-white text-gray-900"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="p-4 bg-gray-50 border-t border-gray-200">
                                <button
                                    onClick={() => setShowReconcilePreview(true)}
                                    className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700"
                                >
                                    Preview Adjustments
                                </button>
                            </div>
                        </div>

                        {/* Preview Panel */}
                        {showReconcilePreview && (
                            <div className="bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-right-4">
                                <div className="p-4 bg-yellow-50 border-b border-yellow-100 flex justify-between items-center">
                                    <h3 className="font-bold text-yellow-800">Review Discrepancies</h3>
                                    <button onClick={() => setShowReconcilePreview(false)} className="text-gray-400">✕</button>
                                </div>
                                <div className="flex-grow overflow-y-auto p-4">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-xs text-gray-500 uppercase border-b">
                                                <th className="text-left py-2">Batch</th>
                                                <th className="text-right py-2">System</th>
                                                <th className="text-right py-2">Physical</th>
                                                <th className="text-right py-2">Delta</th>
                                                <th className="text-right py-2">Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewReconciliation.length === 0 ? (
                                                <tr><td colSpan={5} className="text-center py-8 text-green-600 font-bold">No Discrepancies Found!</td></tr>
                                            ) : (
                                                previewReconciliation.map((r, i) => (
                                                    <tr key={i} className="border-b border-gray-50">
                                                        <td className="py-2">
                                                            <div className="font-medium">{r.drug.name}</div>
                                                            <div className="text-xs text-gray-400">{r.batch.batch_no}</div>
                                                        </td>
                                                        <td className="text-right">{r.system}</td>
                                                        <td className="text-right font-bold">{r.physical}</td>
                                                        <td className={`text-right font-bold ${r.delta < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                            {r.delta > 0 ? '+' : ''}{r.delta}
                                                        </td>
                                                        <td className="text-right text-gray-500">ZMW {r.val.toFixed(2)}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-4 bg-gray-50 border-t border-gray-200">
                                    <div className="flex justify-between font-bold text-gray-800 mb-4">
                                        <span>Net Value Impact</span>
                                        <span className={previewReconciliation.reduce((a, b) => a + b.val, 0) < 0 ? 'text-red-600' : 'text-green-600'}>
                                            ZMW {previewReconciliation.reduce((a, b) => a + b.val, 0).toFixed(2)}
                                        </span>
                                    </div>
                                    <button
                                        onClick={confirmReconciliation}
                                        disabled={previewReconciliation.length === 0}
                                        className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50"
                                    >
                                        CONFIRM & ADJUST INVENTORY
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* --- MODALS --- */}

            {/* Rx Modal */}
            {showRxModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center">
                        <h3 className="font-bold text-lg mb-4">Scan Prescription</h3>
                        <div className="relative border-2 border-dashed border-indigo-200 rounded-xl p-8 bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer">
                            {isAnalyzing ? (
                                <div className="flex flex-col items-center">
                                    <svg className="animate-spin h-8 w-8 text-indigo-600 mb-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <p className="text-sm font-bold text-indigo-700">Analyzing...</p>
                                </div>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mx-auto text-indigo-500 mb-2"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /></svg>
                                    <p className="font-bold text-indigo-800">Tap to Capture</p>
                                    <p className="text-xs text-indigo-600">Camera or File</p>
                                </>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                disabled={isAnalyzing}
                                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                onChange={handleRxUpload}
                            />
                        </div>
                        <button onClick={() => setShowRxModal(false)} className="mt-4 text-gray-500 text-sm hover:text-gray-800 underline">Cancel</button>
                    </div>
                </div>
            )}

            {/* Manual Sale Modal (Strict Workflow) */}
            {showManualSaleModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                        <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold">Manual Sale</h3>
                            <button onClick={() => setShowManualSaleModal(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Step 1: Drug Name */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">1. Enter Drug Name</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={manualSaleForm.nameQuery}
                                        onChange={e => setManualSaleForm(prev => ({ ...prev, nameQuery: e.target.value, drugId: '' }))}
                                    />
                                    {manualSaleForm.nameQuery && !manualSaleForm.drugId && (
                                        <div className="absolute top-full left-0 right-0 bg-white border shadow-lg mt-1 max-h-40 overflow-y-auto z-10">
                                            {drugs.filter(d => d.name.toLowerCase().includes(manualSaleForm.nameQuery.toLowerCase())).map(d => (
                                                <div
                                                    key={d.id}
                                                    onClick={() => {
                                                        const batchesOfDrug = batches.filter(b => b.item_id === d.id);
                                                        const estPrice = d.price_estimate || (batchesOfDrug.length > 0 ? batchesOfDrug[0].cost_per_unit * 1.5 : 0);
                                                        setManualSaleForm(prev => ({
                                                            ...prev,
                                                            drugId: d.id,
                                                            nameQuery: d.name,
                                                            price: estPrice
                                                        }));
                                                    }}
                                                    className="p-2 hover:bg-gray-50 cursor-pointer text-sm"
                                                >
                                                    {d.name} <span className="text-gray-400 text-xs">({d.sku})</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Step 2: Qty */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">2. Enter Quantity</label>
                                <input
                                    type="number" min="1"
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={manualSaleForm.qty}
                                    onChange={e => setManualSaleForm(prev => ({ ...prev, qty: parseInt(e.target.value) || 1 }))}
                                />
                            </div>

                            {/* Step 3: Price */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">3. Enter Price (Unit)</label>
                                <input
                                    type="number" min="0" step="0.01"
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={manualSaleForm.price}
                                    onChange={e => setManualSaleForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    onClick={submitManualSale}
                                    disabled={!manualSaleForm.drugId}
                                    className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    Add to Cart
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center sticky top-0 z-10">
                            <h3 className="font-bold text-lg">Checkout</h3>
                            <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Summary */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex justify-between items-center">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold">Total Amount</p>
                                    <p className="text-2xl font-bold text-slate-900">ZMW {cartTotal.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Items</p>
                                    <p className="text-sm text-gray-600">{cart.reduce((a, b) => a + b.quantity, 0)} items</p>
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Payment Method</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['CASH', 'CARD', 'MOBILE_MONEY'] as const).map(method => (
                                        <button
                                            key={method}
                                            onClick={() => setPaymentMethod(method)}
                                            className={`py-3 rounded-lg text-sm font-bold border transition-all ${paymentMethod === method
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-white text-gray-600 border-gray-300 hover:border-slate-500'
                                                }`}
                                        >
                                            {method === 'MOBILE_MONEY' ? 'MOBILE' : method}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Customer Info */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Customer Name (Optional)</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-gray-900"
                                    placeholder="Enter Name"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                />
                            </div>

                            {/* Cash Specifics */}
                            {paymentMethod === 'CASH' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Amount Tendered</label>
                                        <input
                                            type="number"
                                            autoFocus
                                            className="w-full border border-gray-300 rounded-lg p-3 text-lg font-mono focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-gray-900"
                                            placeholder="0.00"
                                            value={amountTendered}
                                            onChange={(e) => setAmountTendered(e.target.value)}
                                        />
                                    </div>
                                    <div className={`p-4 rounded-lg flex justify-between items-center ${changeAmount < 0 ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
                                        }`}>
                                        <span className="font-bold">CHANGE</span>
                                        <span className="font-mono text-xl font-bold">ZMW {changeAmount.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Placeholder for Card/Mobile */}
                            {paymentMethod !== 'CASH' && (
                                <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-100 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                                    </svg>
                                    Payment Gateway integration coming soon. This will record as a manual {paymentMethod} entry.
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-200">
                            <button
                                onClick={handlePaymentComplete}
                                disabled={paymentMethod === 'CASH' && (parseFloat(amountTendered || '0') < cartTotal)}
                                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all"
                            >
                                CONFIRM PAYMENT
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Modal (Success) */}
            {showReceiptModal && lastSaleDetails && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 text-center">
                        <div className="bg-emerald-500 p-6 text-white">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-8 h-8">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                            </div>
                            <h3 className="font-bold text-2xl">Payment Success!</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="text-gray-500 text-sm">Sale ID: {lastSaleDetails.id}</div>
                            <div className="text-3xl font-bold text-gray-900">ZMW {lastSaleDetails.total.toFixed(2)}</div>
                            <div className="border-t border-b border-gray-100 py-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Customer</span>
                                    <span className="font-semibold text-gray-900">{lastSaleDetails.customer}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Change</span>
                                    <span className="font-semibold text-gray-900">ZMW {lastSaleDetails.change.toFixed(2)}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowReceiptModal(false)}
                                className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800"
                            >
                                Start New Sale
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Extended Drug Creation Modal */}
            {showDrugModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="font-bold text-xl text-gray-900">
                                {drugForm.barcode ? 'Setup New Product' : 'Receive New Stock'}
                            </h3>
                            <button onClick={() => setShowDrugModal(false)} className="text-gray-400 hover:text-gray-600">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column: Product Info */}
                            <div className="space-y-4">
                                <h4 className="font-semibold text-gray-700 border-b pb-1">1. Product Identification</h4>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Product Images</label>
                                    <p className="text-xs text-gray-500 mb-2">📸 Tap to choose Camera or Gallery</p>
                                    <div className="flex gap-4">
                                        <div className="w-1/2">
                                            <div className="relative aspect-square bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center overflow-hidden hover:bg-gray-50 transition-colors">
                                                {drugForm.front_image_url ? (
                                                    <img src={drugForm.front_image_url} alt="Front" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-center p-2 text-gray-400 pointer-events-none">
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 mx-auto mb-1">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                                        </svg>
                                                        <span className="text-xs">Front</span>
                                                    </div>
                                                )}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    onChange={(e) => handleImageUpload(e, 'front_image_url')}
                                                />
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1 text-center">Camera or Gallery</p>
                                        </div>
                                        <div className="w-1/2">
                                            <div className="relative aspect-square bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center overflow-hidden hover:bg-gray-50 transition-colors">
                                                {drugForm.back_image_url ? (
                                                    <img src={drugForm.back_image_url} alt="Back" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-center p-2 text-gray-400 pointer-events-none">
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 mx-auto mb-1">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m0-3l-3-3m0 0l-3 3m3-3v11.25" />
                                                        </svg>
                                                        <span className="text-xs">Back</span>
                                                    </div>
                                                )}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    onChange={(e) => handleImageUpload(e, 'back_image_url')}
                                                />
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1 text-center">Camera or Gallery</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleAIAutoFill(drugForm.front_image_url || drugForm.back_image_url, 'DRUG')}
                                        disabled={isAnalyzing || (!drugForm.front_image_url && !drugForm.back_image_url)}
                                        className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-2 rounded-lg text-sm font-bold shadow-sm hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 transition-all"
                                    >
                                        {isAnalyzing ? (
                                            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-yellow-300">
                                                <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM6.97 2.47a.75.75 0 011.06 0l5.228 5.228a.75.75 0 010 1.06l-5.228 5.228a.75.75 0 01-1.06-1.06l4.697-4.697-4.697-4.697a.75.75 0 010-1.06z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                        {isAnalyzing ? 'Analyzing Image...' : 'AI Smart-Fill Details'}
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Barcode</label>
                                    <div className="flex gap-2">
                                        <input
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none font-mono bg-white text-gray-900"
                                            placeholder="Scan or Enter"
                                            value={drugForm.barcode || ''}
                                            onChange={e => setDrugForm({ ...drugForm, barcode: e.target.value })}
                                        />
                                        <button
                                            onClick={() => openScanner('CREATE_DRUG')}
                                            className="bg-slate-800 text-white px-3 rounded hover:bg-slate-700 flex-shrink-0"
                                            title="Scan"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Medication Name <span className="text-red-500">*</span></label>
                                    <input className="w-full border p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-gray-900" value={drugForm.name || ''} placeholder="e.g. Paracetamol 500mg" onChange={e => setDrugForm({ ...drugForm, name: e.target.value })} />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Internal SKU <span className="text-red-500">*</span></label>
                                    <input className="w-full border p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-gray-900" value={drugForm.sku || ''} placeholder="e.g. PARA-500" onChange={e => setDrugForm({ ...drugForm, sku: e.target.value })} />
                                </div>
                            </div>

                            {/* Right Column: Stock & Logic */}
                            <div className="space-y-4">
                                <h4 className="font-semibold text-gray-700 border-b pb-1">2. Initial Stock & Logic</h4>

                                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100 space-y-3">
                                    <h5 className="text-sm font-bold text-emerald-800">New Batch Entry (Mandatory for Stock)</h5>

                                    <div className="flex gap-2">
                                        <div className="w-1/3">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Quantity</label>
                                            <input className="w-full border p-2 rounded bg-white text-gray-900" type="number" placeholder="Units" value={drugForm.initialStock || ''} onChange={e => setDrugForm({ ...drugForm, initialStock: parseInt(e.target.value) })} />
                                        </div>
                                        <div className="w-1/3">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Cost (ZMW)</label>
                                            <input className="w-full border p-2 rounded bg-white text-gray-900" type="number" step="0.01" placeholder="0.00" value={drugForm.costPerUnit || ''} onChange={e => setDrugForm({ ...drugForm, costPerUnit: parseFloat(e.target.value) })} />
                                        </div>
                                        <div className="w-1/3">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Selling Price</label>
                                            <input
                                                className="w-full border p-2 rounded bg-white text-gray-900"
                                                type="number" step="0.01" placeholder="0.00"
                                                value={drugForm.price_cents ? (drugForm.price_cents / 100).toFixed(2) : ''}
                                                onChange={e => setDrugForm({ ...drugForm, price_cents: Math.round(parseFloat(e.target.value) * 100) })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase">MFD <span className="text-red-500">*</span></label>
                                            <input className="w-full border p-2 rounded text-xs bg-white text-gray-900" type="date" value={drugForm.manufactureDate || ''} onChange={e => setDrugForm({ ...drugForm, manufactureDate: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase">Expiry (EPD) <span className="text-red-500">*</span></label>
                                            <input className="w-full border p-2 rounded text-xs bg-white text-gray-900" type="date" value={drugForm.expiryDate || ''} onChange={e => setDrugForm({ ...drugForm, expiryDate: e.target.value })} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">Batch Number <span className="text-red-500">*</span></label>
                                        <input className="w-full border p-2 rounded bg-white text-gray-900" placeholder="Batch/Lot No" value={drugForm.batchNo || ''} onChange={e => setDrugForm({ ...drugForm, batchNo: e.target.value })} />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Stock Levels</label>
                                    <div className="flex gap-2">
                                        <input className="w-1/2 border p-2 rounded bg-white text-gray-900" type="number" placeholder="Min Level" value={drugForm.min_level || ''} onChange={e => setDrugForm({ ...drugForm, min_level: parseInt(e.target.value) })} />
                                        <input className="w-1/2 border p-2 rounded bg-white text-gray-900" type="number" placeholder="Max Level" value={drugForm.max_level || ''} onChange={e => setDrugForm({ ...drugForm, max_level: parseInt(e.target.value) })} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {formError && (
                            <div className="mt-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm font-medium animate-pulse">
                                {formError}
                            </div>
                        )}

                        <div className="mt-6 pt-4 border-t flex justify-end gap-3">
                            <button onClick={() => setShowDrugModal(false)} className="px-6 py-2.5 text-gray-600 bg-gray-100 rounded-lg font-medium hover:bg-gray-200">Cancel</button>
                            <button onClick={submitDrug} className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-md">
                                Save Product & Stock
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showBatchModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
                        <h3 className="font-bold text-lg mb-4 text-gray-900">
                            Add Batch: <span className="text-indigo-600">{drugs.find(d => d.id === selectedDrugId)?.name}</span>
                        </h3>
                        {/* Optional Image Capture for Batch */}
                        <div className="mb-4">
                            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center hover:bg-gray-50 cursor-pointer">
                                <span className="text-xs text-gray-500 font-bold uppercase mb-2">Scan Label for Auto-Fill</span>
                                <button className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-xs font-bold flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M1 8a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 018.07 3h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0016.07 6H17a2 2 0 012 2v8a2 2 0 01-2 2H3a2 2 0 01-2-2V8zm13.5 3a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM10 14a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                                    Capture & AI Analyze
                                </button>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => handleAIAutoFill(reader.result as string, 'BATCH');
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                />
                            </div>
                            {isAnalyzing && <p className="text-xs text-indigo-600 mt-1 animate-pulse text-center">AI is extracting batch details...</p>}
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Batch Number <span className="text-red-500">*</span></label>
                                <input className="w-full border p-2 rounded bg-white text-gray-900" placeholder="Batch No" value={batchForm.batch_no || ''} onChange={e => setBatchForm({ ...batchForm, batch_no: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Manufacture Date <span className="text-red-500">*</span></label>
                                    <input className="w-full border p-2 rounded bg-white text-gray-900" type="date" value={batchForm.manufacture_date || ''} onChange={e => setBatchForm({ ...batchForm, manufacture_date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Expiry Date <span className="text-red-500">*</span></label>
                                    <input className="w-full border p-2 rounded bg-white text-gray-900" type="date" value={batchForm.expiry_date || ''} onChange={e => setBatchForm({ ...batchForm, expiry_date: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Received Units <span className="text-red-500">*</span></label>
                                <input className="w-full border p-2 rounded bg-white text-gray-900" type="number" placeholder="Quantity" value={batchForm.received_quantity || ''} onChange={e => setBatchForm({ ...batchForm, received_quantity: parseInt(e.target.value) })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cost Per Unit</label>
                                <input className="w-full border p-2 rounded bg-white text-gray-900" type="number" step="0.01" placeholder="Cost" value={batchForm.cost_per_unit || ''} onChange={e => setBatchForm({ ...batchForm, cost_per_unit: parseFloat(e.target.value) })} />
                            </div>
                        </div>

                        {formError && (
                            <div className="mt-4 p-2 bg-red-100 border border-red-200 text-red-700 rounded text-xs font-medium">
                                {formError}
                            </div>
                        )}

                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => setShowBatchModal(false)} className="px-4 py-2 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button onClick={submitBatch} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium shadow-md hover:bg-indigo-700">Add Batch</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default DispensaryDashboard;

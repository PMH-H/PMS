
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Medication, Prescription, PrescriptionStatus, InteractionLevel, Notification, Drug, DrugBatch, PrivacySettings } from '../types';
import { analyzePrescriptionImage, checkDrugInteractions, analyzeSymptomInput } from '../services/geminiService';
import { generateUUID } from '../utils/uuid';

interface PatientDashboardProps {
    prescriptions: Prescription[];
    inventory: Drug[];
    inventoryStock: DrugBatch[];
    onAddPrescription: (p: Prescription) => void;
    logAIAction: (action: string, details: string, status: 'SUCCESS' | 'ERROR') => void;
    notifications: Notification[];
    onMarkNotificationAsRead: (id: string) => void;
    userPrivacy?: PrivacySettings;
    onUpdatePrivacy: (s: PrivacySettings) => void;
    onLogSearch: (term: string, type: 'PRODUCT' | 'SYMPTOM') => void;
}

const PatientDashboard: React.FC<PatientDashboardProps> = ({
    prescriptions,
    inventory,
    inventoryStock,
    onAddPrescription,
    logAIAction,
    notifications,
    onMarkNotificationAsRead,
    userPrivacy,
    onUpdatePrivacy,
    onLogSearch
}) => {
    // -- Navigation & UI State --
    const [activeTab, setActiveTab] = useState<'HOME' | 'SHOP' | 'ASSISTANT' | 'PROFILE'>('HOME');
    const [showProductModal, setShowProductModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Drug | null>(null);

    // -- Prescription Upload State --
    const [isUploading, setIsUploading] = useState(false);
    const [showConsent, setShowConsent] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // -- Shop State --
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('All');
    const [onlyInStock, setOnlyInStock] = useState(false);

    // -- Assistant State --
    const [symptomInput, setSymptomInput] = useState('');
    const [aiAnalysis, setAiAnalysis] = useState<{ summary: string, redFlags: string[], suggestedQuestions: string[], disclaimer: string } | null>(null);
    const [isThinking, setIsThinking] = useState(false);

    // -- Computed --
    const unreadCount = notifications.filter(n => !n.read).length;

    // Helper: Stock Check
    const getStock = (drugId: string) => inventoryStock.filter(b => b.drug_id === drugId).reduce((a, b) => a + b.current_units, 0);

    // Filtered Products
    const filteredInventory = useMemo(() => {
        let res = inventory;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            res = res.filter(d => d.name.toLowerCase().includes(q) || d.generic_name?.toLowerCase().includes(q) || d.common_uses?.some(u => u.toLowerCase().includes(q)));
        }
        if (filterCategory !== 'All') {
            res = res.filter(d => d.common_uses?.includes(filterCategory));
        }
        if (onlyInStock) {
            res = res.filter(d => getStock(d.id) > 0);
        }
        return res;
    }, [inventory, searchQuery, filterCategory, onlyInStock, inventoryStock]);

    // Categories extraction
    const categories = useMemo(() => {
        const cats = new Set<string>(['All']);
        inventory.forEach(d => d.common_uses?.forEach(u => cats.add(u)));
        return Array.from(cats);
    }, [inventory]);

    // --- Search Logging Effect ---
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim().length > 2 && userPrivacy?.shareBrowsing) {
                onLogSearch(searchQuery, 'PRODUCT');
            }
        }, 1500); // Debounce log
        return () => clearTimeout(timer);
    }, [searchQuery, userPrivacy, onLogSearch]);

    // --- Handlers ---
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = async () => {
                const base64 = (reader.result as string).split(',')[1];
                const meds = await analyzePrescriptionImage(base64);
                if (meds.length > 0) {
                    const interactions = await checkDrugInteractions([...prescriptions.flatMap(p => p.medications), ...meds]);
                    const newRx: Prescription = {
                        id: generateUUID(),
                        patientName: "Me",
                        date: new Date().toISOString().split('T')[0],
                        medications: meds,
                        status: PrescriptionStatus.PENDING,
                        imageUrl: reader.result as string,
                        interactions
                    };
                    onAddPrescription(newRx);
                    alert("Prescription uploaded for review!");
                } else {
                    alert("Could not detect medications. Try a clearer photo.");
                }
                setIsUploading(false);
            };
        } catch (e) {
            setIsUploading(false);
            alert("Error uploading image");
        }
    };

    const handleSymptomCheck = async () => {
        if (!symptomInput.trim()) return;

        if (userPrivacy?.allowAI && userPrivacy?.shareBrowsing) {
            onLogSearch(symptomInput, 'SYMPTOM');
        }

        setIsThinking(true);
        const result = await analyzeSymptomInput(symptomInput);
        setAiAnalysis(result);
        setIsThinking(false);
    };

    // --- UI COMPONENTS ---

    // 1. Bottom Nav
    const BottomNav = () => (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg pb-safe z-40">
            <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
                {[
                    {
                        id: 'HOME', icon: (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                        ), label: 'Home'
                    },
                    {
                        id: 'SHOP', icon: (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                        ), label: 'Shop'
                    },
                    {
                        id: 'ASSISTANT', icon: (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        ), label: 'AI Chat'
                    },
                    {
                        id: 'PROFILE', icon: (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        ), label: 'Profile'
                    }
                ].map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id as any)}
                        className={`flex flex-col items-center justify-center w-full h-full ${activeTab === item.id ? 'text-yellow-500' : 'text-gray-400'}`}
                    >
                        {item.icon}
                        <span className="text-[10px] font-medium mt-1">{item.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );

    // 2. Views
    const renderHome = () => (
        <div className="space-y-6 pb-20 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Hello, Patient 👋</h2>
                    <p className="text-slate-500 text-sm">Your health hub is ready.</p>
                </div>
                <div className="relative">
                    <button className="p-2 bg-white rounded-full shadow-sm border border-gray-100">
                        <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        {unreadCount > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>}
                    </button>
                </div>
            </div>

            {/* Notifications */}
            {notifications.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-bold text-slate-800 text-sm uppercase">Recent Updates</h3>
                    {notifications.slice(0, 3).map(n => (
                        <div key={n.id} onClick={() => onMarkNotificationAsRead(n.id)} className={`p-4 rounded-xl border flex gap-3 items-start cursor-pointer ${n.read ? 'bg-white border-gray-100' : 'bg-yellow-50 border-yellow-100'}`}>
                            <div className={`mt-1 w-2 h-2 rounded-full ${n.read ? 'bg-gray-300' : 'bg-yellow-500'}`} />
                            <div>
                                <p className="text-sm text-slate-800">{n.message}</p>
                                <p className="text-xs text-slate-400 mt-1">{new Date(n.timestamp).toLocaleTimeString()}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Prescriptions */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-900 text-lg">My Prescriptions</h3>
                    <button
                        onClick={() => setShowConsent(true)}
                        className="bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-slate-800"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        New Rx
                    </button>
                </div>

                {prescriptions.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-300">
                        <p className="text-gray-400 text-sm">No active prescriptions</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {prescriptions.map(p => (
                            <div key={p.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${p.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                        p.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                                        }`}>{p.status}</span>
                                    <span className="text-xs text-gray-400">{p.date}</span>
                                </div>
                                <div className="space-y-2">
                                    {p.medications.map((m, i) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span className="font-medium text-slate-900">{m.name}</span>
                                            <span className="text-slate-500">{m.dosage}</span>
                                        </div>
                                    ))}
                                </div>
                                {p.interactions && p.interactions.length > 0 && (
                                    <div className="mt-3 bg-red-50 p-2 rounded-lg text-xs text-red-600 font-medium">
                                        ⚠️ Interactions Detected
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />

            {showConsent && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
                    <div className="bg-white p-6 rounded-2xl max-w-sm w-full">
                        <h3 className="font-bold text-lg mb-2">Privacy Consent</h3>
                        <p className="text-sm text-gray-600 mb-6">We use AI to analyze your prescription image. Data is processed securely.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setShowConsent(false)} className="flex-1 py-2 text-gray-600 bg-gray-100 rounded-lg text-sm font-bold">Cancel</button>
                            <button onClick={() => { setShowConsent(false); fileInputRef.current?.click(); }} className="flex-1 py-2 bg-yellow-400 text-slate-900 rounded-lg text-sm font-bold">Agree & Upload</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderShop = () => (
        <div className="space-y-6 pb-20 animate-in fade-in duration-300">
            {/* Search Header */}
            <div className="sticky top-0 bg-slate-50 pt-2 pb-4 z-10">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Find Medicines</h2>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search for drugs, symptoms..."
                        className="w-full bg-white border-none shadow-sm rounded-xl py-3 pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-yellow-400 outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>

                {/* Categories */}
                <div className="flex gap-3 overflow-x-auto mt-4 pb-2 scrollbar-hide">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setFilterCategory(cat)}
                            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filterCategory === cat ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-gray-100'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filters */}
            <div className="flex justify-between items-center text-sm px-1">
                <span className="font-bold text-gray-500">{filteredInventory.length} Results</span>
                <button
                    onClick={() => setOnlyInStock(!onlyInStock)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-lg border ${onlyInStock ? 'bg-green-100 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-500'}`}
                >
                    <div className={`w-2 h-2 rounded-full ${onlyInStock ? 'bg-green-600' : 'bg-gray-300'}`} />
                    In Stock Only
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 gap-4">
                {filteredInventory.map(item => {
                    const stock = getStock(item.id);
                    return (
                        <div key={item.id} onClick={() => { setSelectedProduct(item); setShowProductModal(true); }} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between cursor-pointer active:scale-95 transition-transform">
                            <div className="relative aspect-square mb-3 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center">
                                {item.image_front ? (
                                    <img src={item.image_front} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xs text-gray-400">No Image</span>
                                )}
                                {stock <= 0 && (
                                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">OUT OF STOCK</span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 text-sm leading-tight mb-1">{item.name}</h3>
                                <p className="text-xs text-slate-500 mb-2">{item.generic_name || item.common_uses?.[0]}</p>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-900">ZMW {item.price_estimate?.toFixed(2)}</span>
                                    <button className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-slate-900">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderAssistant = () => (
        <div className="h-[calc(100vh-80px)] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-900 p-6 rounded-b-3xl text-white shadow-lg">
                <h2 className="text-2xl font-bold mb-2">AI Health Triage</h2>
                <p className="text-slate-300 text-sm">Describe your symptoms. I'll help you prepare a summary for the pharmacist.</p>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {/* Chat History / Output */}
                {!aiAnalysis && (
                    <div className="text-center text-gray-400 mt-10 p-6">
                        <svg className="w-16 h-16 mx-auto mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        <p>No symptoms analyzed yet.</p>
                    </div>
                )}

                {aiAnalysis && (
                    <div className="space-y-6">
                        {/* Summary Card */}
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 shadow-sm">
                            <h3 className="font-bold text-yellow-800 text-sm uppercase mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                Show to Pharmacist
                            </h3>
                            <p className="text-slate-800 font-medium leading-relaxed">{aiAnalysis.summary}</p>
                        </div>

                        {/* Red Flags */}
                        {aiAnalysis.redFlags.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                                <h3 className="font-bold text-red-700 text-sm uppercase mb-2">⚠️ Urgent Attention Needed</h3>
                                <ul className="list-disc list-inside text-red-800 text-sm space-y-1">
                                    {aiAnalysis.redFlags.map((f, i) => <li key={i}>{f}</li>)}
                                </ul>
                            </div>
                        )}

                        {/* Questions */}
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                            <h3 className="font-bold text-slate-900 text-sm uppercase mb-3">Ask the Pharmacist</h3>
                            <ul className="space-y-2">
                                {aiAnalysis.suggestedQuestions.map((q, i) => (
                                    <li key={i} className="flex gap-3 text-sm text-slate-700">
                                        <span className="font-bold text-yellow-500">{i + 1}.</span>
                                        {q}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <p className="text-xs text-gray-400 text-center px-4">{aiAnalysis.disclaimer}</p>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100">
                <div className="relative">
                    <textarea
                        className="w-full bg-gray-50 rounded-xl p-4 pr-12 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner"
                        rows={3}
                        placeholder="e.g. I have a throbbing headache and sensitivity to light for 2 days..."
                        value={symptomInput}
                        onChange={(e) => setSymptomInput(e.target.value)}
                    />
                    <button
                        onClick={handleSymptomCheck}
                        disabled={isThinking || !symptomInput.trim()}
                        className="absolute right-3 bottom-3 p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                    >
                        {isThinking ? (
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderProfile = () => (
        <div className="space-y-6 pb-20 animate-in fade-in duration-300">
            <h2 className="text-2xl font-bold text-slate-900">Settings</h2>

            {/* Privacy Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    T&C Data Sharing
                </h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-800">Anonymous Mode</p>
                            <p className="text-xs text-gray-500">Hide PII in searches & queries</p>
                        </div>
                        <button
                            onClick={() => onUpdatePrivacy({ ...userPrivacy!, anonymousMode: !userPrivacy?.anonymousMode })}
                            className={`w-12 h-6 rounded-full relative transition-colors ${userPrivacy?.anonymousMode ? 'bg-green-500' : 'bg-gray-200'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${userPrivacy?.anonymousMode ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-800">Share Browsing History</p>
                            <p className="text-xs text-gray-500">Help pharmacy improve stock</p>
                        </div>
                        <button
                            onClick={() => onUpdatePrivacy({ ...userPrivacy!, shareBrowsing: !userPrivacy?.shareBrowsing })}
                            className={`w-12 h-6 rounded-full relative transition-colors ${userPrivacy?.shareBrowsing ? 'bg-green-500' : 'bg-gray-200'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${userPrivacy?.shareBrowsing ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-800">Share Purchase History</p>
                            <p className="text-xs text-gray-500">For personalized deals</p>
                        </div>
                        <button
                            onClick={() => onUpdatePrivacy({ ...userPrivacy!, sharePurchaseHistory: !userPrivacy?.sharePurchaseHistory })}
                            className={`w-12 h-6 rounded-full relative transition-colors ${userPrivacy?.sharePurchaseHistory ? 'bg-green-500' : 'bg-gray-200'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${userPrivacy?.sharePurchaseHistory ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-800">Personalized AI Advice</p>
                            <p className="text-xs text-gray-500">Allow AI to use your profile</p>
                        </div>
                        <button
                            onClick={() => onUpdatePrivacy({ ...userPrivacy!, allowAI: !userPrivacy?.allowAI })}
                            className={`w-12 h-6 rounded-full relative transition-colors ${userPrivacy?.allowAI ? 'bg-green-500' : 'bg-gray-200'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${userPrivacy?.allowAI ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-800">Allow Camera Access</p>
                            <p className="text-xs text-gray-500">For scanning prescriptions</p>
                        </div>
                        <button
                            onClick={() => onUpdatePrivacy({ ...userPrivacy!, allowCamera: !userPrivacy?.allowCamera })}
                            className={`w-12 h-6 rounded-full relative transition-colors ${userPrivacy?.allowCamera ? 'bg-green-500' : 'bg-gray-200'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${userPrivacy?.allowCamera ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg text-slate-900 mb-2">Account</h3>
                <button
                    onClick={async () => {
                        const { signOut } = await import('../services/supabase');
                        const { error } = await signOut();
                        if (error) console.error('Error signing out:', error);
                        window.location.reload();
                    }}
                    className="w-full text-left py-3 text-red-600 font-medium text-sm hover:bg-red-50 rounded-lg transition-colors"
                >
                    Log Out
                </button>
            </div>
        </div>
    );

    return (
        <div className="pb-10">
            {/* Main View Switcher */}
            {activeTab === 'HOME' && renderHome()}
            {activeTab === 'SHOP' && renderShop()}
            {activeTab === 'ASSISTANT' && renderAssistant()}
            {activeTab === 'PROFILE' && renderProfile()}

            <BottomNav />

            {/* Product Detail Modal */}
            {showProductModal && selectedProduct && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl h-[90vh] flex flex-col animate-in slide-in-from-bottom-10">
                        {/* Header Image */}
                        <div className="relative h-64 bg-gray-100 flex-shrink-0">
                            {selectedProduct.image_front ? (
                                <img src={selectedProduct.image_front} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                            )}
                            <button
                                onClick={() => setShowProductModal(false)}
                                className="absolute top-4 right-4 bg-white/80 p-2 rounded-full shadow-sm hover:bg-white"
                            >
                                <svg className="w-5 h-5 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-grow overflow-y-auto p-6 space-y-6">
                            <div>
                                <div className="flex justify-between items-start">
                                    <h2 className="text-2xl font-bold text-slate-900">{selectedProduct.name}</h2>
                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-600">{selectedProduct.dosage_form}</span>
                                </div>
                                <p className="text-indigo-600 font-medium text-sm">{selectedProduct.generic_name}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-4 rounded-xl">
                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Uses</p>
                                    <p className="text-sm font-medium text-slate-800">{selectedProduct.common_uses?.join(', ') || 'General'}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl">
                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Active Ingredient</p>
                                    <p className="text-sm font-medium text-slate-800">{selectedProduct.active_ingredients?.[0]}</p>
                                </div>
                            </div>

                            {selectedProduct.usage_warning && (
                                <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex gap-3">
                                    <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    <p className="text-sm text-red-800 leading-snug">{selectedProduct.usage_warning}</p>
                                </div>
                            )}

                            <div>
                                <h4 className="font-bold text-slate-900 text-sm mb-2">Side Effects</h4>
                                <div className="flex flex-wrap gap-2">
                                    {selectedProduct.side_effects?.map((e, i) => (
                                        <span key={i} className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">{e}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer Action */}
                        <div className="p-4 border-t border-gray-100 bg-white pb-safe">
                            <button className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 flex justify-between px-6 items-center">
                                <span>Add to Cart</span>
                                <span>ZMW {selectedProduct.price_estimate?.toFixed(2)}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientDashboard;

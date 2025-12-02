
import React, { useState, useRef, useMemo, useEffect } from 'react';
import ArticleViewer from '../components/ArticleViewer';
import ProfileSettings from './ProfileSettings';
import { Medication, Prescription, PrescriptionStatus, Notification, Drug, DrugBatch, PrivacySettings, User } from '../types';
import { analyzePrescriptionImage, checkDrugInteractions, analyzeSymptomInput } from '../services/geminiService';
import { generateUUID } from '../utils/uuid';
import { supabase } from '../services/supabase';

// --- TYPES ---
interface DashboardWidget { id: string; component: string; gridSpan: number; }
interface DashboardSettings { widgets: DashboardWidget[]; }
interface PatientDashboardProps {
    currentUser: User;
    onUpdateUser: (user: User) => void;
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

// --- ICONS ---
const HomeIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const ShopIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const AssistantIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>;
const NewsIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3h2m0 3h2" /></svg>;
const ProfileIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;

// --- MODAL COMPONENT ---
const PrescriptionPreviewModal: React.FC<{ prescription: Prescription; onClose: () => void }> = ({ prescription, onClose }) => (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
        <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Prescription Details</h2>
            
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${prescription.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{prescription.status}</span>
                    <span className="text-sm text-slate-500">Date: {prescription.date}</span>
                </div>

                {prescription.imageUrl && (
                    <div>
                        <h3 className="font-semibold text-slate-800 mb-2">Original Prescription Image</h3>
                        <img src={prescription.imageUrl} alt="Prescription" className="rounded-lg border border-gray-200 w-full object-contain" />
                    </div>
                )}

                <div>
                    <h3 className="font-semibold text-slate-800 mb-2">Medications</h3>
                    <ul className="space-y-2">
                        {prescription.medications.map((med, index) => (
                            <li key={index} className="p-3 bg-slate-50 rounded-lg flex justify-between">
                                <span className="font-medium text-slate-800">{med.name}</span>
                                <span className="text-slate-600">{med.dosage}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    </div>
);

const PatientDashboard: React.FC<PatientDashboardProps> = (props) => {
    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'HOME' | 'SHOP' | 'ASSISTANT' | 'PROFILE' | 'NEWS'>('HOME');
    const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings | null>(null);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
    // ... other states

    // --- EFFECTS ---
    useEffect(() => {
        // ... fetchSettings logic remains the same ...
        const fetchSettings = async () => {
            setLoadingSettings(true);
            const { data, error } = await supabase.from('dashboard_settings').select('settings').eq('user_id', props.currentUser.id).single();
            if (data && data.settings) {
                setDashboardSettings(data.settings as DashboardSettings);
            } else if (!error || error.code === 'PGRST116') {
                const defaultSettings: DashboardSettings = {
                    widgets: [{ id: 'w1', component: 'Header', gridSpan: 2 }, { id: 'w2', component: 'Notifications', gridSpan: 2 }, { id: 'w3', component: 'Prescriptions', gridSpan: 2 }, { id: 'w4', component: 'UploadRx', gridSpan: 1 }, { id: 'w5', component: 'SymptomChecker', gridSpan: 1 },]
                };
                await supabase.from('dashboard_settings').insert({ user_id: props.currentUser.id, settings: defaultSettings });
                setDashboardSettings(defaultSettings);
            } 
            setLoadingSettings(false);
        };
        fetchSettings();
    }, [props.currentUser.id]);


    // --- WIDGETS ---
    const widgetComponents: { [key: string]: React.ReactNode } = {
        Header: (
             <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Hello, {props.currentUser.full_name.split(' ')[0]} 👋</h2>
                    <p className="text-slate-500">Your personal health hub is ready.</p>
                </div>
            </div>
        ),
        Notifications: (
            <div className="bg-white p-4 rounded-xl shadow-sm border col-span-2">
                <h3 className="font-bold text-slate-800 mb-3">Recent Updates</h3>
                {props.notifications.length > 0 ? props.notifications.slice(0, 3).map(n => (
                    <div key={n.id} className={`p-3 rounded-lg flex items-center gap-3 text-sm ${n.read ? '' : 'bg-yellow-50'}`}>
                        <span className={`w-2 h-2 rounded-full ${n.read? 'bg-gray-300' : 'bg-yellow-500'}`}></span>
                        {n.message}
                    </div>
                )) : <p className='text-sm text-slate-500 p-3'>No new notifications.</p>}
            </div>
        ),
        Prescriptions: (
            <div className="bg-white p-4 rounded-xl shadow-sm border col-span-2">
                 <h3 className="font-bold text-slate-800 mb-3">My Prescriptions</h3>
                 {props.prescriptions.length > 0 ? (
                    props.prescriptions.map(p => 
                    <button key={p.id} onClick={() => setSelectedPrescription(p)} className="w-full text-left p-3 border-b last:border-b-0 hover:bg-slate-50 rounded-lg">
                        <div className='flex justify-between items-center'>
                           <span className='font-medium'>{p.medications.map(m => m.name).join(', ')}</span>
                           <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.status}</span>
                        </div>
                        <span className='text-xs text-slate-500'>{p.date}</span>
                    </button>)
                 ) : <p className="text-sm text-slate-500 p-3">No active prescriptions found.</p>}
            </div>
        ),
        UploadRx: (
            <button className="w-full h-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 p-4 rounded-xl shadow-sm border border-indigo-200 text-center transition-colors">
                <h3 className="font-bold">Upload Prescription</h3>
                <p className="text-sm">Scan a new Rx paper</p>
            </button>
        ),
        SymptomChecker: (
             <button onClick={() => setActiveTab('ASSISTANT')} className="w-full h-full bg-green-50 hover:bg-green-100 text-green-700 p-4 rounded-xl shadow-sm border border-green-200 text-center transition-colors">
                <h3 className="font-bold">Symptom Checker</h3>
                <p className="text-sm">Use AI Assistant</p>
            </button>
        )
    };
    
    // --- TAB RENDERERS ---
    const renderHome = () => (
        <div className="animate-in fade-in duration-500 space-y-6">
             {loadingSettings ? 
                <div className='text-center p-10'><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div></div> :
                <div className="grid grid-cols-2 gap-4">
                    {dashboardSettings?.widgets.map(widget => (
                        <div key={widget.id} className={`col-span-2 md:col-span-${widget.gridSpan}`}>
                            {widgetComponents[widget.component]}
                        </div>
                    ))}
                </div>
             }
        </div>
    );
    const renderShop = () => <div>Shop Content</div>;
    const renderAssistant = () => <div>Assistant Content</div>;
    const renderNews = () => <div>News Content</div>;
    const renderProfile = () => <ProfileSettings currentUser={props.currentUser} onUpdate={props.onUpdateUser} />;

    // --- MAIN RETURN ---
    const navItems = [
        { key: 'HOME', label: 'Home', icon: <HomeIcon /> },
        { key: 'SHOP', label: 'Shop', icon: <ShopIcon /> },
        { key: 'ASSISTANT', label: 'Assistant', icon: <AssistantIcon /> },
        { key: 'NEWS', label: 'News', icon: <NewsIcon /> },
        { key: 'PROFILE', label: 'Profile', icon: <ProfileIcon /> },
    ];

    return (
        <div className="max-w-4xl mx-auto font-sans">
            <main className="p-4 pb-24">
                {activeTab === 'HOME' && renderHome()}
                {activeTab === 'SHOP' && renderShop()}
                {activeTab === 'ASSISTANT' && renderAssistant()}
                {activeTab === 'NEWS' && renderNews()}
                {activeTab === 'PROFILE' && renderProfile()}
            </main>

            <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-gray-200 shadow-t-lg">
                 <nav className="flex justify-around items-center h-16 max-w-4xl mx-auto">
                    {navItems.map(item => (
                        <button 
                            key={item.key} 
                            onClick={() => setActiveTab(item.key as any)}
                            className={`flex flex-col items-center justify-center text-xs w-16 transition-colors ${activeTab === item.key ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
                        >
                           <div className="mb-1">{item.icon}</div>
                           <span className="font-bold">{item.label}</span>
                        </button>
                    ))}
                </nav>
            </footer>

            {/* Conditionally render the modal */}
            {selectedPrescription && <PrescriptionPreviewModal prescription={selectedPrescription} onClose={() => setSelectedPrescription(null)} />}
        </div>
    );
};

export default PatientDashboard;

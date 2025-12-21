
import React, { useState, useRef, useMemo, useEffect } from 'react';
import ArticleViewer from '../components/ArticleViewer';
import ProfileSettings from './ProfileSettings';
import NewsFeed from '../components/NewsFeed';
import ChatAssistant from '../components/ChatAssistant';
import PrescriptionUpload from '../components/PrescriptionUpload';
import PrescriptionDetailView from '../components/PrescriptionDetailView';
import NewsWidget from '../components/NewsWidget';
import Messaging from '../components/Messaging';
import NotificationToast from '../components/NotificationToast';
import OrderHistory from '../components/OrderHistory';
import ProductCatalog from '../components/ProductCatalog';
import { NotificationManager } from '../components/NotificationManager';
import { HealthNewsWidget } from '../components/HealthNewsWidget';
import { UserChannelsWidget } from '../components/UserChannelsWidget';
import { useNotifications } from '../hooks/useNotifications';
import { Medication, Prescription, PrescriptionStatus, Notification, Drug, DrugBatch, PrivacySettings, User, UserRole } from '../types';
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
const MessagesIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
const ProfileIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const OrdersIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;


const SymptomChecker: React.FC<{ onLogSearch: (term: string, type: 'SYMPTOM') => void }> = ({ onLogSearch }) => {
    const [symptom, setSymptom] = useState('');
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        onLogSearch(symptom, 'SYMPTOM');
        try {
            const analysis = await analyzeSymptomInput(symptom);
            setResult(analysis);
        } catch (error) {
            setResult('Error analyzing symptoms. Please try again.');
        }
        setLoading(false);
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border">
            <h3 className="font-bold text-slate-800 mb-3">Symptom Checker</h3>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={symptom}
                    onChange={(e) => setSymptom(e.target.value)}
                    className="w-full p-2 border rounded-lg mb-2"
                    placeholder="Enter your symptoms..."
                />
                <button type="submit" className="w-full bg-indigo-600 text-white p-2 rounded-lg" disabled={loading}>
                    {loading ? 'Analyzing...' : 'Analyze'}
                </button>
            </form>
            {result && <div className="mt-4 p-2 bg-gray-100 rounded-lg">{result}</div>}
        </div>
    );
};


// --- MODAL COMPONENT ---

const PatientDashboard: React.FC<PatientDashboardProps> = (props) => {
    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'HOME' | 'SHOP' | 'ASSISTANT' | 'PROFILE' | 'NEWS' | 'MESSAGES' | 'ORDERS' | 'PRESCRIPTIONS' | 'NOTIFICATIONS' | 'HEALTH' | 'CHANNELS'>('HOME');
    const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings | null>(null);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
    const { toasts, removeToast, success, error, info } = useNotifications();
    const [localNotifications, setLocalNotifications] = useState<Notification[]>(props.notifications);


    // --- EFFECTS ---
    useEffect(() => {
        setLocalNotifications(props.notifications);
    }, [props.notifications])

    useEffect(() => {
        const fetchSettings = async () => {
            setLoadingSettings(true);
            try {
                const { data, error } = await supabase.from('dashboard_settings').select('settings').eq('user_id', props.currentUser.id).maybeSingle();

                if (data && data.settings) {
                    setDashboardSettings(data.settings as DashboardSettings);
                } else {
                    const defaultSettings: DashboardSettings = {
                        widgets: [{ id: 'w1', component: 'Header', gridSpan: 2 }, { id: 'w2', component: 'Notifications', gridSpan: 2 }, { id: 'w3', component: 'Prescriptions', gridSpan: 2 }, { id: 'w4', component: 'UploadRx', gridSpan: 1 }, { id: 'w5', component: 'SymptomChecker', gridSpan: 1 },]
                    };
                    if (!error) {
                        const { error: insertError } = await supabase.from('dashboard_settings').insert({ user_id: props.currentUser.id, settings: defaultSettings });
                        if (insertError) console.warn("Could not save default settings:", insertError.message);
                    } else {
                        console.warn("Error fetching settings, using defaults:", error.message);
                    }
                    setDashboardSettings(defaultSettings);
                }
            } catch (err) {
                console.error("Unexpected error fetching settings:", err);
                const defaultSettings: DashboardSettings = {
                    widgets: [{ id: 'w1', component: 'Header', gridSpan: 2 }, { id: 'w2', component: 'Notifications', gridSpan: 2 }, { id: 'w3', component: 'Prescriptions', gridSpan: 2 }, { id: 'w4', component: 'UploadRx', gridSpan: 1 }, { id: 'w5', component: 'SymptomChecker', gridSpan: 1 },]
                };
                setDashboardSettings(defaultSettings);
            } finally {
                setLoadingSettings(false);
            }
        };
        fetchSettings();

        const channel = supabase
            .channel('prescription-updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'prescriptions',
                    filter: `patient_id=eq.${props.currentUser.id}`,
                },
                (payload) => {
                    const updated = payload.new as any;
                    const newNotification: Notification = { id: generateUUID(), message: '', read: false, timestamp: new Date().toISOString(), type: 'PRESCRIPTION_STATUS' };
                    if (updated.status === 'approved') {
                        newNotification.message = 'Your prescription has been approved!';
                        success('Your prescription has been approved!');
                    } else if (updated.status === 'declined') {
                        newNotification.message = 'Your prescription was declined. Please contact the pharmacy.';
                        error('Your prescription was declined. Please contact the pharmacy.');
                    } else if (updated.status === 'dispensed') {
                        newNotification.message = 'Your prescription has been dispensed and is ready for pickup.';
                        info('Your prescription has been dispensed and is ready for pickup.');
                    }
                    setLocalNotifications([newNotification, ...localNotifications]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
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
                {localNotifications.length > 0 ? localNotifications.slice(0, 3).map(n => (
                    <div key={n.id} className={`p-3 rounded-lg flex items-center gap-3 text-sm ${n.read ? '' : 'bg-yellow-50'}`}>
                        <span className={`w-2 h-2 rounded-full ${n.read ? 'bg-gray-300' : 'bg-yellow-500'}`}></span>
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
                        <button key={p.id} onClick={() => setSelectedPrescription(p)} className="w-full text-left p-3 border-b last:border-b-0 hover:bg-slate-50 rounded-lg transition-colors group">
                            <div className='flex justify-between items-center mb-1'>
                                <span className={`font-medium ${p.medications && p.medications.length > 0 ? 'text-slate-900' : 'text-slate-500 italic'}`}>
                                    {p.medications && p.medications.length > 0
                                        ? p.medications.map(m => m.name).join(', ')
                                        : 'Prescription Image Uploaded (Click to View)'}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${p.status?.toUpperCase() === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                    p.status?.toUpperCase() === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                        'bg-yellow-100 text-yellow-800'
                                    }`}>
                                    {p.status}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className='text-xs text-slate-500'>{new Date(p.created_at).toLocaleDateString()}</span>
                                <span className="text-xs text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity font-medium">View Details →</span>
                            </div>
                        </button>)
                ) : <p className="text-sm text-slate-500 p-3">No active prescriptions found.</p>}
            </div>
        ),
        UploadRx: (
            <div className="bg-white p-4 rounded-xl shadow-sm border">
                <PrescriptionUpload
                    userId={props.currentUser.id}
                    onUploadComplete={(id) => {
                        success('Prescription uploaded successfully!');
                        props.logAIAction('upload-prescription', `Prescription uploaded: ${id}`, 'SUCCESS');
                    }}
                    onError={(err) => {
                        error(err)
                        props.logAIAction('upload-prescription', err, 'ERROR');
                    }}
                />
            </div>
        ),
        SymptomChecker: (
            <SymptomChecker onLogSearch={props.onLogSearch} />
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
    const renderShop = () => <ProductCatalog inventory={props.inventory} />;
    const renderAssistant = () => <div className="h-[600px]"><ChatAssistant role={UserRole.CUSTOMER} embedded /></div>;
    const renderNews = () => <NewsFeed />;

    const renderMessages = () => (
        <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
            <Messaging currentUser={props.currentUser} facilityId={props.currentUser.facility_id} />
        </div>
    );
    const renderProfile = () => <ProfileSettings currentUser={props.currentUser} onUpdate={props.onUpdateUser} />;

    const renderMoreMenu = () => (
        <div className="animate-in fade-in duration-500 space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Menu</h2>
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setActiveTab('PROFILE')} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <ProfileIcon />
                    </div>
                    <span className="font-bold text-slate-700">Profile</span>
                </button>
                <button onClick={() => setActiveTab('ORDERS')} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                        <OrdersIcon />
                    </div>
                    <span className="font-bold text-slate-700">My Orders</span>
                </button>
                <button onClick={() => setActiveTab('NOTIFICATIONS')} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    </div>
                    <span className="font-bold text-slate-700">Alerts</span>
                </button>
                <button onClick={() => setActiveTab('HEALTH')} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    </div>
                    <span className="font-bold text-slate-700">Health</span>
                </button>
                <button onClick={() => setActiveTab('CHANNELS')} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM18.5 20H20a2 2 0 002-2v-2a2 2 0 00-2-2h-2M4 20h5v-2a3 3 0 00-5.856-1.487M5 10a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <span className="font-bold text-slate-700">Community</span>
                </button>
            </div>
        </div>
    );

    // --- MAIN RETURN ---
    const PillIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>;

    const navItems = [
        { key: 'HOME', label: 'Home', icon: <HomeIcon /> },
        { key: 'PRESCRIPTIONS', label: 'My Rx', icon: <PillIcon /> },
        { key: 'SHOP', label: 'Shop', icon: <ShopIcon /> },
        { key: 'MESSAGES', label: 'Chat', icon: <MessagesIcon /> },
        { key: 'MORE', label: 'More', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg> },
    ];

    return (
        <div className="max-w-4xl mx-auto font-sans">
            <main className="p-4 pb-24">
                {activeTab === 'HOME' && renderHome()}
                {activeTab === 'SHOP' && renderShop()}
                {activeTab === 'ASSISTANT' && renderAssistant()}
                {activeTab === 'MESSAGES' && renderMessages()}
                {activeTab === 'NEWS' && renderNews()}
                {activeTab === 'ORDERS' && <OrderHistory currentUser={props.currentUser} />}
                {activeTab === 'PRESCRIPTIONS' && (
                    <div className="animate-in fade-in duration-500 space-y-4">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">Prescription History</h2>
                        <div className="space-y-3">
                            <div className="bg-white p-4 rounded-xl shadow-sm border mb-4">
                                <h3 className="font-bold text-slate-800 mb-2">New Prescription</h3>
                                <PrescriptionUpload
                                    userId={props.currentUser.id}
                                    onUploadComplete={(id) => {
                                        success('Prescription uploaded successfully!');
                                        // Trigger refresh if needed, for now depend on realtime or manual refresh
                                        if (props.onAddPrescription) {
                                            // Mock object just to update UI immediately if possible, 
                                            // though real data comes from DB subscription usually.
                                        }
                                    }}
                                    onError={(err) => error(err)}
                                />
                            </div>
                            <h3 className="font-bold text-slate-800 mb-2">History</h3>
                            {props.prescriptions.map(p => (
                                <button key={p.id} onClick={() => setSelectedPrescription(p)} className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                    <div className="text-left">
                                        <div className="font-bold text-slate-800">{p.medications && p.medications.length > 0 ? p.medications[0].name + (p.medications.length > 1 ? ` +${p.medications.length - 1} more` : '') : 'Prescription #' + p.id.slice(0, 6)}</div>
                                        <div className="text-xs text-slate-500 mt-1">{new Date(p.created_at).toLocaleDateString()} • {p.medications?.length || 0} items</div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${p.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                        p.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                                        }`}>
                                        {p.status.toLowerCase()}
                                    </div>
                                </button>
                            ))}
                            {props.prescriptions.length === 0 && (
                                <div className="text-center py-10 text-gray-400">No prescriptions found.</div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === 'NOTIFICATIONS' && (
                    <div className="animate-in fade-in duration-500">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">Notifications</h2>
                        <NotificationManager />
                    </div>
                )}
                {activeTab === 'HEALTH' && (
                    <div className="animate-in fade-in duration-500">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">Health News & Resources</h2>
                        <HealthNewsWidget />
                    </div>
                )}
                {activeTab === 'CHANNELS' && (
                    <div className="animate-in fade-in duration-500">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">Community Channels</h2>
                        <UserChannelsWidget />
                    </div>
                )}
                {activeTab === 'PROFILE' && renderProfile()}
                {activeTab === 'MORE' && renderMoreMenu()}
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

            {selectedPrescription && <PrescriptionDetailView prescription={selectedPrescription} onClose={() => setSelectedPrescription(null)} />}

            <div className="fixed top-4 right-4 z-50 space-y-2">
                {toasts.map(toast => (
                    <NotificationToast key={toast.id} toast={toast} onDismiss={removeToast} />
                ))}
            </div>
        </div>
    );
};

export default PatientDashboard;

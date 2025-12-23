import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { scheduleNotification } from '../services/notificationService';
import { getFeatureFlag } from '../services/configService';
import { useLanguage } from '../context/LanguageContext';

interface Schedule {
    id: string;
    medication_name: string;
    dosage: string;
    times: string[]; // ['08:00', '20:00']
    frequency: string;
    start_date: string;
    end_date?: string;
    is_active: boolean;
    reminder_methods: string[];
    is_antibiotic?: boolean;
    priority?: 'HIGH' | 'MODERATE' | 'LOW';
}

interface Log {
    id: string;
    schedule_id: string;
    scheduled_time: string;
    status: 'TAKEN' | 'SKIPPED' | 'MISSED';
    taken_at: string | null;
}

const AdherenceTracker: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { t, language, setLanguage } = useLanguage();
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    // Form
    const [newMedName, setNewMedName] = useState('');
    const [newTime, setNewTime] = useState('09:00');
    const [isAntibiotic, setIsAntibiotic] = useState(false);
    const [smsEnabled, setSmsEnabled] = useState(false);

    // Feature Flags return false by default if not set
    const [premiumSmsAvailable, setPremiumSmsAvailable] = useState(false);

    useEffect(() => {
        fetchData();
        checkPremiumFeatures();
    }, [currentUser.id]);

    const checkPremiumFeatures = async () => {
        const enabled = await getFeatureFlag('enable_premium_sms');
        setPremiumSmsAvailable(enabled);
    };

    const toggleLang = () => {
        setLanguage(language === 'EN' ? 'BEM' : 'EN');
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // Get schedules
            const { data: schedData } = await supabase
                .from('medication_schedules')
                .select('*')
                .eq('user_id', currentUser.id)
                .eq('is_active', true);

            setSchedules(schedData || []);

            // Get recent logs (today)
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            if (schedData && schedData.length > 0) {
                const { data: logData } = await supabase
                    .from('medication_logs')
                    .select('*')
                    .in('schedule_id', schedData.map(s => s.id))
                    .gte('scheduled_time', todayStart.toISOString());
                setLogs(logData || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const methods = ['PUSH'];
            if (smsEnabled) methods.push('SMS');

            const { error } = await supabase.from('medication_schedules').insert({
                user_id: currentUser.id,
                medication_name: newMedName,
                dosage: '1 tablet',
                frequency: 'Daily',
                times: [newTime],
                reminder_methods: methods,
                is_antibiotic: isAntibiotic,
                priority: isAntibiotic ? 'HIGH' : 'MODERATE',
                start_date: new Date().toISOString().split('T')[0]
            });

            if (error) throw error;

            setShowAddModal(false);
            setNewMedName('');
            setIsAntibiotic(false);
            fetchData();
        } catch (err: any) {
            alert('Error adding schedule: ' + err.message);
        }
    };

    const handleLogDose = async (scheduleId: string, timeStr: string, status: 'TAKEN' | 'SKIPPED') => {
        const today = new Date().toISOString().split('T')[0];
        const scheduledTime = `${today}T${timeStr}:00`;

        try {
            const { error } = await supabase.from('medication_logs').insert({
                user_id: currentUser.id,
                schedule_id: scheduleId,
                scheduled_time: scheduledTime,
                status,
                taken_at: status === 'TAKEN' ? new Date().toISOString() : null
            });
            if (error) throw error;
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const isLogged = (scheduleId: string, time: string) => {
        return logs.find(l => l.schedule_id === scheduleId && l.scheduled_time.includes(time));
    };

    const calculateDayProgress = (startDate: string) => {
        const start = new Date(startDate);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays || 1;
    };

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                {/* Language Toggle */}
                <button
                    onClick={toggleLang}
                    className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-bold border border-white/40 z-10"
                    title="Switch Language"
                >
                    {language === 'EN' ? 'Bemba 🇿🇲' : 'English 🇬🇧'}
                </button>

                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold">{t.adherence_title}</h2>
                        <p className="opacity-90">{t.adherence_subtitle}</p>
                    </div>
                </div>

                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-white/20 hover:bg-white/30 p-2 rounded-lg backdrop-blur-sm transition mb-4 inline-block"
                >
                    {t.add_med}
                </button>

                {/* Today's Timeline */}
                <div className="space-y-4">
                    {loading ? <p>Loading...</p> : schedules.length === 0 ? <p className="text-sm opacity-80">No medications scheduled.</p> : (
                        schedules.map(schedule => {
                            const dayNum = calculateDayProgress(schedule.start_date);
                            return (
                                <div key={schedule.id} className={`rounded-lg p-4 backdrop-blur-sm border-l-4 ${schedule.is_antibiotic ? 'bg-red-500/20 border-red-400' : 'bg-white/10 border-blue-300'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="font-bold text-lg">{schedule.medication_name}</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs bg-black/20 px-2 py-0.5 rounded">{schedule.dosage}</span>
                                                {schedule.is_antibiotic && (
                                                    <span className="text-xs bg-red-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider">{t.antibiotic_critical}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-sm font-light opacity-80">{t.day} {dayNum}</span>
                                        </div>
                                    </div>

                                    {/* Contextual Education */}
                                    {schedule.is_antibiotic && (
                                        <p className="text-xs text-red-100 bg-red-900/40 p-2 rounded mb-3 flex items-start gap-2">
                                            <span className="text-lg">⚠️</span>
                                            <span>{t.antibiotic_education}</span>
                                        </p>
                                    )}

                                    <div className="flex gap-2">
                                        {schedule.times.map(time => {
                                            const log = isLogged(schedule.id, time);
                                            return (
                                                <div key={time} className="flex items-center gap-2 bg-black/10 rounded-lg pr-2 overflow-hidden">
                                                    <div className="bg-black/20 p-2 text-xs font-mono">{time}</div>
                                                    {log ? (
                                                        <span className={`text-xs font-bold px-2 ${log.status === 'TAKEN' ? 'text-green-300' : 'text-red-300'}`}>
                                                            {log.status}
                                                        </span>
                                                    ) : (
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => handleLogDose(schedule.id, time, 'TAKEN')}
                                                                className="p-1 hover:text-green-300 transition-colors" title="Confirm Dose"
                                                            >
                                                                ✅
                                                            </button>
                                                            <button
                                                                onClick={() => handleLogDose(schedule.id, time, 'SKIPPED')}
                                                                className="p-1 hover:text-red-300 transition-colors" title="Report Missed"
                                                            >
                                                                ❌
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* STG Adherence Classification (Silent) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <div className="text-gray-500 text-xs uppercase font-bold text-center mb-1">{t.status}</div>
                    <div className="text-2xl font-bold text-green-600 text-center">{t.on_track}</div>
                    <p className="text-center text-xs text-gray-400 mt-1">{t.keep_adhering}</p>
                </div>
            </div>

            {/* Add Schedule Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm animate-in zoom-in-95">
                        <h3 className="font-bold text-lg mb-4 text-black">Add Schedule</h3>
                        <form onSubmit={handleAddSchedule} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700">Medication</label>
                                <input required className="w-full border rounded p-2" value={newMedName} onChange={e => setNewMedName(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700">Time</label>
                                <input type="time" required className="w-full border rounded p-2" value={newTime} onChange={e => setNewTime(e.target.value)} />
                            </div>

                            <div className="flex items-center gap-2 bg-red-50 p-2 rounded border border-red-100">
                                <input
                                    type="checkbox"
                                    checked={isAntibiotic}
                                    onChange={e => setIsAntibiotic(e.target.checked)}
                                    id="antibiotic"
                                    className="accent-red-600 w-4 h-4"
                                />
                                <label htmlFor="antibiotic" className="text-sm font-bold text-red-800">Is this an Antibiotic?</label>
                            </div>

                            {premiumSmsAvailable ? (
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={smsEnabled} onChange={e => setSmsEnabled(e.target.checked)} id="sms" />
                                    <label htmlFor="sms" className="text-sm text-gray-700">Enable SMS Reminders <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">PREMIUM</span></label>
                                </div>
                            ) : (
                                <div className="text-xs text-gray-400 italic p-2 bg-gray-50 rounded">
                                    Premium SMS disabled (Free Plan).
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowAddModal(false)} className="text-gray-500 p-2">Cancel</button>
                                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold">Save Plan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdherenceTracker;

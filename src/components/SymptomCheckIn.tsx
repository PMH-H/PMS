import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface SymptomCheckInProps {
    currentUser: User;
    onComplete?: () => void;
}

const SymptomCheckIn: React.FC<SymptomCheckInProps> = ({ currentUser, onComplete }) => {
    const { t } = useLanguage();
    const [hasCheckedIn, setHasCheckedIn] = useState(false);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(0);

    // Form State
    const [wellness, setWellness] = useState<string>('');
    const [fever, setFever] = useState<string>('');
    const [breathing, setBreathing] = useState<string>('');

    useEffect(() => {
        checkStatus();
    }, [currentUser.id]);

    const checkStatus = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data } = await supabase
                .from('symptom_logs')
                .select('id')
                .eq('user_id', currentUser.id)
                .eq('date', today)
                .maybeSingle();

            if (data) setHasCheckedIn(true);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        const responses = { wellness, fever, breathing };
        const isRedFlag = fever === 'YES' || breathing === 'WORSE' || wellness === 'TERRIBLE';

        try {
            const { error } = await supabase.from('symptom_logs').insert({
                user_id: currentUser.id,
                date: new Date().toISOString().split('T')[0],
                check_in_type: 'DAILY_GENERAL',
                responses,
                red_flag_triggered: isRedFlag
            });

            if (error) throw error;
            setHasCheckedIn(true);
            if (onComplete) onComplete();
        } catch (err: any) {
            alert('Failed to submit: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="animate-pulse h-24 bg-gray-100 rounded-xl"></div>;

    if (hasCheckedIn) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <div className="text-4xl mb-2">✅</div>
                <h3 className="font-bold text-green-800">{t.check_in_complete}</h3>
                <p className="text-sm text-green-600">Your health status has been logged.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 to-emerald-600 p-4 text-white">
                <h3 className="font-bold text-lg">{t.daily_check_in}</h3>
                <p className="text-xs opacity-90">Quick answers help your doctor track progress.</p>
            </div>

            <div className="p-6">
                {step === 0 && (
                    <div className="space-y-4 animate-in slide-in-from-right">
                        <label className="block font-bold text-gray-700 mb-2">{t.symptom_wellness_q}</label>
                        <div className="grid grid-cols-1 gap-2">
                            {['Great', 'Good', 'Okay', 'Bad', 'Terrible'].map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => { setWellness(opt.toUpperCase()); setStep(1); }}
                                    className="p-3 text-left border rounded-lg hover:bg-teal-50 hover:border-teal-300 transition-colors flex justify-between group"
                                >
                                    <span>{opt}</span>
                                    <span className="opacity-0 group-hover:opacity-100 text-teal-600">Select →</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 1 && (
                    <div className="space-y-4 animate-in slide-in-from-right">
                        <label className="block font-bold text-gray-700 mb-2">{t.symptom_fever_q}</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => { setFever('NO'); setStep(2); }}
                                className="p-6 border rounded-xl hover:bg-green-50 hover:border-green-400 font-bold text-lg"
                            >
                                {t.no}
                            </button>
                            <button
                                onClick={() => { setFever('YES'); setStep(2); }}
                                className="p-6 border rounded-xl hover:bg-red-50 hover:border-red-400 font-bold text-lg text-red-600"
                            >
                                {t.yes}
                            </button>
                        </div>
                        <button onClick={() => setStep(0)} className="text-sm text-gray-400 mt-4">← Back</button>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 animate-in slide-in-from-right">
                        <label className="block font-bold text-gray-700 mb-2">{t.symptom_breathing_q}</label>
                        <div className="grid grid-cols-1 gap-2">
                            {['Better', 'Same', 'Worse'].map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => { setBreathing(opt.toUpperCase()); handleSubmit(); }}
                                    className={`p-4 border rounded-lg font-bold transition-all ${opt === 'Worse'
                                        ? 'hover:bg-red-50 hover:border-red-400 hover:text-red-700'
                                        : 'hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700'
                                        }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setStep(1)} className="text-sm text-gray-400 mt-4">← Back</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SymptomCheckIn;

import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';

interface Alert {
    id: string;
    patientName: string;
    type: 'MISSED_DOSE' | 'RED_FLAG_SYMPTOM';
    details: string;
    timestamp: string;
    severity: 'CRITICAL' | 'WARNING';
}

const CaregiverAlertsWidget: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAlerts();
    }, [currentUser.id]);

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            // 1. Get my linked patients
            const { data: links } = await supabase
                .from('linked_profiles')
                .select('linked_user_id, linked_user:profiles!linked_profiles_linked_user_id_fkey(full_name)')
                .eq('primary_user_id', currentUser.id);

            if (!links || links.length === 0) {
                setLoading(false);
                return;
            }

            const patientIds = links.map(l => l.linked_user_id).filter(Boolean) as string[];
            const patientMap = links.reduce((acc, l) => {
                if (l.linked_user_id) acc[l.linked_user_id] = l.linked_user?.full_name || 'Unknown';
                return acc;
            }, {} as Record<string, string>);

            const collectedAlerts: Alert[] = [];

            // 2. Check for Missed Critical Doses (Antibiotics) today/yesterday
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const { data: missedDoses } = await supabase
                .from('medication_logs')
                .select(`
                    id, 
                    user_id, 
                    status, 
                    scheduled_time, 
                    schedule:medication_schedules(medication_name, is_antibiotic)
                `)
                .in('user_id', patientIds)
                .in('status', ['MISSED', 'SKIPPED'])
                .gte('scheduled_time', yesterday.toISOString());

            if (missedDoses) {
                missedDoses.forEach(dose => {
                    // Start of 'schedule' is an object based on the query structure, need to cast or check
                    const sched = dose.schedule as any;
                    if (sched && sched.is_antibiotic) {
                        collectedAlerts.push({
                            id: dose.id,
                            patientName: patientMap[dose.user_id],
                            type: 'MISSED_DOSE',
                            details: `Missed Antibiotic: ${sched.medication_name}`,
                            timestamp: dose.scheduled_time,
                            severity: 'CRITICAL'
                        });
                    }
                });
            }

            // 3. Check for Red Flag Symptoms today
            const { data: symptoms } = await supabase
                .from('symptom_logs')
                .select('*')
                .in('user_id', patientIds)
                .eq('red_flag_triggered', true)
                .gte('date', yesterday.toISOString().split('T')[0]);

            if (symptoms) {
                symptoms.forEach(sym => {
                    collectedAlerts.push({
                        id: sym.id,
                        patientName: patientMap[sym.user_id],
                        type: 'RED_FLAG_SYMPTOM',
                        details: `Reported severe symptoms (Fever/Breathing)`,
                        timestamp: sym.created_at || sym.date,
                        severity: 'CRITICAL'
                    });
                });
            }

            setAlerts(collectedAlerts);

        } catch (err) {
            console.error("Error fetching caregiver alerts:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return null; // Silent load
    if (alerts.length === 0) return null; // Silent if no alerts (Controlled Visibility)

    return (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 shadow-sm animate-in slide-in-from-top">
            <div className="flex items-center gap-2 mb-3">
                <span className="bg-red-100 text-red-600 p-1.5 rounded-lg text-xl">🔔</span>
                <h3 className="font-bold text-red-800">Family Care Alerts</h3>
            </div>

            <div className="space-y-3">
                {alerts.map(alert => (
                    <div key={alert.id} className="bg-white p-3 rounded-lg border border-red-100 flex items-start justify-between shadow-sm">
                        <div>
                            <p className="font-bold text-gray-900">{alert.patientName}</p>
                            <p className="text-sm text-red-600 font-medium">{alert.details}</p>
                            <p className="text-xs text-gray-400 mt-1">{new Date(alert.timestamp).toLocaleString()}</p>
                        </div>
                        <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-1 rounded uppercase tracking-wider">
                            {alert.type.replace('_', ' ')}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CaregiverAlertsWidget;

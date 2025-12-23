import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

interface PatientAdherenceViewProps {
    patientId: string;
}

interface Schedule {
    id: string;
    medication_name: string;
    dosage: string;
    frequency: string;
    times: string[];
}

interface Log {
    id: string;
    schedule_id: string;
    scheduled_time: string;
    status: 'TAKEN' | 'SKIPPED' | 'MISSED';
    taken_at: string | null;
}

const PatientAdherenceView: React.FC<PatientAdherenceViewProps> = ({ patientId }) => {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (patientId) fetchAdherenceData();
    }, [patientId]);

    const fetchAdherenceData = async () => {
        setLoading(true);
        try {
            // 1. Get Active Schedules
            const { data: schedData, error: schedError } = await supabase
                .from('medication_schedules')
                .select('*')
                .eq('user_id', patientId)
                .eq('is_active', true);

            if (schedError) throw schedError;
            setSchedules(schedData || []);

            if (schedData && schedData.length > 0) {
                // 2. Get Logs for last 7 days
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                const { data: logData, error: logError } = await supabase
                    .from('medication_logs')
                    .select('*')
                    .in('schedule_id', schedData.map(s => s.id))
                    .gte('scheduled_time', sevenDaysAgo.toISOString())
                    .order('scheduled_time', { ascending: false });

                if (logError) throw logError;
                setLogs(logData || []);
            }
        } catch (err) {
            console.error("Error fetching adherence:", err);
        } finally {
            setLoading(false);
        }
    };

    // Calculate Adherence Rate
    const calculateRate = (scheduleId: string) => {
        const scheduleLogs = logs.filter(l => l.schedule_id === scheduleId);
        if (scheduleLogs.length === 0) return 'N/A';
        const taken = scheduleLogs.filter(l => l.status === 'TAKEN').length;
        return `${Math.round((taken / scheduleLogs.length) * 100)}%`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'TAKEN': return 'bg-green-500';
            case 'SKIPPED': return 'bg-yellow-400';
            case 'MISSED': return 'bg-red-500';
            default: return 'bg-gray-300';
        }
    };

    if (loading) return <div className="text-gray-500 text-sm">Loading adherence data...</div>;
    if (schedules.length === 0) return null; // Don't show section if no schedules

    return (
        <div className="mb-6">
            <h4 className="font-bold text-lg text-slate-700 mb-2">Medication Adherence (Last 7 Days)</h4>
            <div className="bg-slate-50 border rounded-lg p-4 space-y-4">
                {schedules.map(sched => (
                    <div key={sched.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 last:border-0 pb-3 last:pb-0">
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h5 className="font-bold text-slate-800">{sched.medication_name}</h5>
                                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{sched.dosage}</span>
                            </div>
                            <p className="text-sm text-slate-500">{sched.frequency} at {sched.times.join(', ')}</p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <span className="block text-xs text-gray-400 uppercase font-bold">Adherence</span>
                                <span className={`text-lg font-bold ${calculateRate(sched.id) === '100%' ? 'text-green-600' : 'text-orange-500'}`}>
                                    {calculateRate(sched.id)}
                                </span>
                            </div>

                            {/* Visual Dots for last few logs */}
                            <div className="flex gap-1">
                                {logs.filter(l => l.schedule_id === sched.id).slice(0, 5).reverse().map(log => (
                                    <div
                                        key={log.id}
                                        className={`w-3 h-3 rounded-full ${getStatusColor(log.status)}`}
                                        title={`${log.status} on ${new Date(log.scheduled_time).toLocaleDateString()}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PatientAdherenceView;

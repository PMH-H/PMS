
import React, { useEffect, useState } from 'react';
import { checkInteractions } from '../services/database';
import { InteractionLevel, InteractionAlert } from '../types';

interface PrescriptionSafetyCheckProps {
    medications: { name: string; dosage: string }[];
    allergies: string[];
    onValidationComplete?: (isValid: boolean) => void;
}

const PrescriptionSafetyCheck: React.FC<PrescriptionSafetyCheckProps> = ({ medications, allergies, onValidationComplete }) => {
    const [loading, setLoading] = useState(false);
    const [alerts, setAlerts] = useState<InteractionAlert[]>([]);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        // Only run check if we have medications
        if (medications.length === 0) {
            setAlerts([]);
            setChecked(false);
            return;
        }

        const runCheck = async () => {
            setLoading(true);
            try {
                const result = await checkInteractions(medications, allergies);
                setAlerts(result.alerts || []);
                setChecked(true);
                if (onValidationComplete) {
                    // Consider valid if no HIGH severity alerts, or just pass info up
                    const hasHighSeverity = result.alerts?.some((a: any) => a.severity === 'HIGH');
                    onValidationComplete(!hasHighSeverity);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        // Debounce checks slightly to avoid rapid API calls
        const timer = setTimeout(runCheck, 1000);
        return () => clearTimeout(timer);

    }, [JSON.stringify(medications), JSON.stringify(allergies)]);

    if (medications.length === 0) return null;

    return (
        <div className="mt-4 border rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b flex justify-between items-center">
                <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                    Clinical Safety Check
                    {loading && <span className="text-xs text-slate-400 animate-pulse">(Analyzing...)</span>}
                    {!loading && checked && alerts.length === 0 && <span className="text-emerald-600 text-xs font-bold">✓ SAFE</span>}
                    {!loading && checked && alerts.length > 0 && <span className="text-amber-600 text-xs font-bold">⚠ ISSUES FOUND</span>}
                </h4>
            </div>

            <div className="p-4">
                {loading ? (
                    <div className="flex gap-2 items-center text-slate-500 text-sm">
                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        Checking Drug-Drug & Allergy interactions...
                    </div>
                ) : alerts.length === 0 && checked ? (
                    <div className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                        No clinically significant interactions found.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {alerts.map((alert, idx) => (
                            <div key={idx} className={`p-3 rounded-lg border text-sm ${alert.severity === 'HIGH' ? 'bg-red-50 border-red-200 text-red-800' :
                                    alert.severity === 'MODERATE' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                        'bg-blue-50 border-blue-200 text-blue-800'
                                }`}>
                                <div className="flex justify-between font-bold mb-1">
                                    <span>{alert.medicationA} + {alert.medicationB}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs uppercase ${alert.severity === 'HIGH' ? 'bg-red-200' :
                                            alert.severity === 'MODERATE' ? 'bg-amber-200' : 'bg-blue-200'
                                        }`}>{alert.severity}</span>
                                </div>
                                <p>{alert.description}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrescriptionSafetyCheck;

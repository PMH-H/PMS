
import React, { useEffect, useState } from 'react';
import { getPatientAllergies, addPatientAllergy, removePatientAllergy } from '../services/database';
import { PatientAllergy } from '../types';

interface PatientAllergiesProps {
    patientId: string;
    readOnly?: boolean;
}

const PatientAllergies: React.FC<PatientAllergiesProps> = ({ patientId, readOnly = false }) => {
    const [allergies, setAllergies] = useState<PatientAllergy[]>([]);
    const [loading, setLoading] = useState(true);
    const [newAllergen, setNewAllergen] = useState('');
    const [severity, setSeverity] = useState<'MILD' | 'MODERATE' | 'SEVERE'>('MILD');

    useEffect(() => {
        loadAllergies();
    }, [patientId]);

    const loadAllergies = async () => {
        try {
            const data = await getPatientAllergies(patientId);
            setAllergies(data);
        } catch (error) {
            console.error("Failed to load allergies", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAllergen) return;

        try {
            await addPatientAllergy({
                patient_id: patientId,
                allergen: newAllergen,
                severity: severity
            });
            setNewAllergen('');
            loadAllergies();
        } catch (error) {
            alert("Failed to add allergy");
            console.error(error);
        }
    };

    const handleRemove = async (id: string) => {
        if (!confirm("Remove this allergy?")) return;
        try {
            await removePatientAllergy(id);
            loadAllergies();
        } catch (error) {
            console.error("Failed to remove allergy", error);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
                <span>Allergies & Medical Alerts</span>
                <span className="text-xs font-normal px-2 py-1 bg-slate-100 rounded-full text-slate-500">
                    {allergies.length} Active
                </span>
            </h3>

            {allergies.length === 0 && !loading && (
                <div className="text-center p-4 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-500 text-sm mb-4">
                    No known allergies recorded.
                </div>
            )}

            <div className="space-y-2 mb-6">
                {allergies.map(alg => (
                    <div key={alg.id} className="flex justify-between items-center p-3 bg-red-50 border border-red-100 rounded-lg">
                        <div>
                            <div className="font-bold text-red-800">{alg.allergen}</div>
                            <div className="text-xs text-red-600">{alg.severity} Reaction</div>
                        </div>
                        {!readOnly && (
                            <button
                                onClick={() => handleRemove(alg.id)}
                                className="text-red-400 hover:text-red-700 px-2"
                            >
                                ×
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {!readOnly && (
                <form onSubmit={handleAdd} className="flex gap-2">
                    <input
                        className="flex-1 px-3 py-2 border rounded-lg text-sm"
                        placeholder="Add new allergy (e.g. Penicillin)"
                        value={newAllergen}
                        onChange={e => setNewAllergen(e.target.value)}
                        required
                    />
                    <select
                        className="px-3 py-2 border rounded-lg text-sm bg-white"
                        value={severity}
                        onChange={e => setSeverity(e.target.value as any)}
                    >
                        <option value="MILD">Mild</option>
                        <option value="MODERATE">Moderate</option>
                        <option value="SEVERE">Severe</option>
                    </select>
                    <button
                        type="submit"
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        Add
                    </button>
                </form>
            )}
        </div>
    );
};

export default PatientAllergies;

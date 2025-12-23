
import React, { useState, useEffect } from 'react';
import { prescriberService } from '../../services/prescriberService';
import { PatientMedication } from '../../types';

interface ActiveMedicationsListProps {
  prescriberId: string;
}

const ActiveMedicationsList: React.FC<ActiveMedicationsListProps> = ({ prescriberId }) => {
  const [medications, setMedications] = useState<PatientMedication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMedications = async () => {
      setIsLoading(true);
      try {
        const data = await prescriberService.getPrescriberActiveMedications(prescriberId);
        setMedications(data);
      } catch (err) {
        setError('Failed to load active medications.');
        console.error(err);
      }
      setIsLoading(false);
    };

    fetchMedications();
  }, [prescriberId]);

  if (isLoading) return <div className="p-4 text-gray-500">Loading active medications...</div>;
  if (error) return <div className="p-4 text-red-500 bg-red-50 rounded-lg">{error}</div>;

  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <h2 className="font-bold text-lg text-slate-800">Active Prescriptions</h2>
        <span className="text-xs font-medium bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">{medications.length} Active</span>
      </div>

      {medications.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>No active prescriptions written by you.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {medications.map(med => (
            <li key={med.id} className="p-4 hover:bg-slate-50 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-slate-800">{med.drug_name} {med.dosage}</h3>
                  <p className="text-sm font-medium text-indigo-600 mt-1">
                    Patient: {med.patient_name || med.patient_id}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Refills Remaining: {med.refills_remaining}
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                    ACTIVE
                  </span>
                  <p className="text-xs text-slate-400 mt-2">
                    Exp: {med.expiration_date ? new Date(med.expiration_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 justify-end border-t border-slate-100 pt-3">
                <button className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1">Discontinue</button>
                <button className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1">Renew</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ActiveMedicationsList;

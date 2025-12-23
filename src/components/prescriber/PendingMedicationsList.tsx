
import React, { useState, useEffect } from 'react';
import { prescriberService } from '../../services/prescriberService';
import { PrescriptionDraft } from '../../types';

interface PendingMedicationsListProps {
  prescriberId: string;
}

const PendingMedicationsList: React.FC<PendingMedicationsListProps> = ({ prescriberId }) => {
  const [drafts, setDrafts] = useState<PrescriptionDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDrafts = async () => {
      setIsLoading(true);
      try {
        const data = await prescriberService.getPendingPrescriptions(prescriberId);
        setDrafts(data);
      } catch (err) {
        setError('Failed to load pending medications.');
        console.error(err);
      }
      setIsLoading(false);
    };

    fetchDrafts();
  }, [prescriberId]);

  if (isLoading) return <div className="p-4 text-gray-500">Loading pending prescriptions...</div>;
  if (error) return <div className="p-4 text-red-500 bg-red-50 rounded-lg">{error}</div>;

  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <h2 className="font-bold text-lg text-slate-800">Pending Prescriptions</h2>
        <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-1 rounded-full">{drafts.length} Pending</span>
      </div>

      {drafts.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>No pending prescriptions requiring approval.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {drafts.map(draft => (
            <li key={draft.id} className="p-4 hover:bg-slate-50 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-slate-800">{draft.drug_name} {draft.strength}</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {draft.dosage_form} • {draft.directions}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span>Qty: {draft.dispense_quantity}</span>
                    <span>Refills: {draft.refills}</span>
                    <span>{new Date(draft.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div>
                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${draft.status === 'PENDING_APPROVAL' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                    {draft.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex gap-2 justify-end">
                <button className="text-sm text-slate-600 hover:text-slate-900 font-medium px-3 py-1 border rounded hover:bg-white">Edit</button>
                <button className="text-sm text-white bg-emerald-600 hover:bg-emerald-700 font-medium px-3 py-1 rounded shadow-sm">Sign & Send</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PendingMedicationsList;

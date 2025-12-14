
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
        // This is a mock function. In a real scenario, you would fetch this data.
        // const data = await prescriberService.getPendingPrescriptions(prescriberId);
        // setDrafts(data);
        setDrafts([]); // Replace with actual data fetching
      } catch (err) {
        setError('Failed to load pending medications.');
        console.error(err);
      }
      setIsLoading(false);
    };

    fetchDrafts();
  }, [prescriberId]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="p-4 bg-white shadow rounded-lg">
      <h2 className="font-bold text-xl mb-4">Pending Medications</h2>
      {drafts.length === 0 ? (
        <p>No pending medications.</p>
      ) : (
        <ul className="space-y-3">
          {drafts.map(draft => (
            <li key={draft.id} className="p-3 border rounded-md bg-gray-50">
              <p className="font-semibold">{draft.drug_name} {draft.strength}</p>
              <p className="text-sm text-gray-600">Status: {draft.status}</p>
              {/* Add buttons for actions like Edit, Approve, Delete */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PendingMedicationsList;

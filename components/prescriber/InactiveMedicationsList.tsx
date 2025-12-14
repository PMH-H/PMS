
import React, { useState, useEffect } from 'react';
import { prescriberService } from '../../services/prescriberService';
import { PatientMedication } from '../../types';

interface InactiveMedicationsListProps {
  prescriberId: string;
}

const InactiveMedicationsList: React.FC<InactiveMedicationsListProps> = ({ prescriberId }) => {
  const [medications, setMedications] = useState<PatientMedication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMedications = async () => {
      setIsLoading(true);
      try {
        // This is a mock function. In a real scenario, you would fetch this data.
        // const data = await prescriberService.getMedicationsByStatus(prescriberId, ['INACTIVE', 'DISCONTINUED']);
        // setMedications(data);
        setMedications([]); // Replace with actual data fetching
      } catch (err) {
        setError('Failed to load inactive medications.');
        console.error(err);
      }
      setIsLoading(false);
    };

    fetchMedications();
  }, [prescriberId]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="p-4 bg-white shadow rounded-lg">
      <h2 className="font-bold text-xl mb-4">Inactive & Discontinued Medications</h2>
      {medications.length === 0 ? (
        <p>No inactive or discontinued medications.</p>
      ) : (
        <ul className="space-y-3">
          {medications.map(med => (
            <li key={med.id} className="p-3 border rounded-md bg-gray-50 opacity-70">
              <p className="font-semibold">{med.drug_name} {med.dosage}</p>
              <p className="text-sm text-gray-600">Patient: {med.patient_id}</p>
              <p className="text-sm text-gray-600">Status: {med.status}</p>
              {med.end_date && <p className="text-xs text-gray-500">Ended on: {new Date(med.end_date).toLocaleDateString()}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default InactiveMedicationsList;

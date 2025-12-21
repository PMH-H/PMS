import React, { useState } from 'react';
import { supabase } from '../../services/supabase';
import { User, Drug } from '../../types';

interface PrescriptionCreationProps {
  prescriberId: string;
}

const PrescriptionCreation: React.FC<PrescriptionCreationProps> = ({ prescriberId }) => {
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [selectedDrug, setSelectedDrug] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState('');
  const [selectedPharmacy, setSelectedPharmacy] = useState('');
  const [loading, setLoading] = useState(false);

  const searchPatient = async () => {
    // Search by NRC or phone
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`nrc.ilike.%${patientQuery}%,phone.ilike.%${patientQuery}%`)
      .eq('role', 'customer')
      .single();

    if (data) setSelectedPatient(data);
  };

  const addDrug = () => {
    // Add drug to prescription
    // For now, mock
  };

  const createPrescription = async () => {
    // Create prescription in DB
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Create Prescription</h2>

      {/* Patient Search */}
      <div>
        <label>Patient NRC or Phone</label>
        <input
          type="text"
          value={patientQuery}
          onChange={(e) => setPatientQuery(e.target.value)}
          className="border p-2 w-full"
        />
        <button onClick={searchPatient} className="bg-blue-500 text-white p-2 mt-2">Search</button>
        {selectedPatient && <div>Selected: {selectedPatient.full_name}</div>}
      </div>

      {/* Add Drugs */}
      <div>
        <h3>Add Drugs</h3>
        {/* Drug selection and quantity */}
      </div>

      {/* Pharmacy Selection */}
      <div>
        <label>Select Pharmacy</label>
        <select value={selectedPharmacy} onChange={(e) => setSelectedPharmacy(e.target.value)}>
          <option value="">Choose Pharmacy</option>
          {/* List pharmacies */}
        </select>
      </div>

      <button onClick={createPrescription} className="bg-green-500 text-white p-2">Create Prescription</button>
    </div>
  );
};

export default PrescriptionCreation;
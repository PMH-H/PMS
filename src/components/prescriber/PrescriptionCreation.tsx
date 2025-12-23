import React, { useState } from 'react';
import PatientSearchPanel from './PatientSearchPanel';
import PrescribingWorkflow from './PrescribingWorkflow';
import { prescriberService } from '../../services/prescriberService';
import { User, PrescriptionDraft } from '../../types';

interface PrescriptionCreationProps {
  prescriberId: string;
}

const PrescriptionCreation: React.FC<PrescriptionCreationProps> = ({ prescriberId }) => {
  const [selectedPatient, setSelectedPatient] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePatientSelect = async (patientId: string) => {
    setLoading(true);
    try {
      // We need the User object for the workflow
      const context = await prescriberService.getPatientContext(patientId);
      setSelectedPatient(context.patient);
    } catch (e) {
      console.error(e);
      alert("Failed to load patient details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrescriptionSave = (draft: PrescriptionDraft) => {
    // Could add a toast notification here
    alert(`Prescription for ${draft.drug_name} saved successfully!`);
    setSelectedPatient(null); // Return to search to prescribe for next patient
  };

  if (selectedPatient) {
    return (
      <div className="animate-in fade-in duration-300">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setSelectedPatient(null)}
            className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1"
          >
            &larr; Switch Patient
          </button>
          <span className="text-slate-300">|</span>
          <span className="font-bold text-slate-800">{selectedPatient.full_name}</span>
        </div>

        <PrescribingWorkflow
          patient={selectedPatient}
          prescriberId={prescriberId}
          onPrescriptionSave={handlePrescriptionSave}
          onCancel={() => setSelectedPatient(null)}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="spinner-border animate-spin inline-block w-6 h-6 border-2 rounded-full border-t-transparent border-emerald-500 mb-2"></div>
        <p>Loading patient context...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
      <h2 className="text-xl font-bold text-slate-800 mb-2">New Prescription</h2>
      <p className="text-slate-500 mb-6 text-sm">Search for a patient securely to begin the prescribing workflow.</p>
      <PatientSearchPanel onPatientSelect={handlePatientSelect} prescriberId={prescriberId} />
    </div>
  );
};

export default PrescriptionCreation;
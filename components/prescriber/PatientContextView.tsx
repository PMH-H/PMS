
import React, { useState, useEffect } from 'react';
import { prescriberService } from '../../services/prescriberService';
import { PatientContext, PatientAllergy, PatientMedication, PatientPreferredPharmacy, User, PrescriptionDraft } from '../../types';
import PrescribingWorkflow from './PrescribingWorkflow'; // Import the workflow component

interface PatientContextViewProps {
  patientId: string;
  prescriberId: string; // The ID of the currently logged-in prescriber
}

const PatientContextView: React.FC<PatientContextViewProps> = ({ patientId, prescriberId }) => {
  const [context, setContext] = useState<PatientContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrescribing, setIsPrescribing] = useState(false); // State to control workflow visibility

  const fetchContext = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await prescriberService.getPatientContext(patientId);
      setContext(data);
    } catch (err: any) {
      setError('Failed to load patient context. Please try again.');
      console.error(err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (patientId) {
      fetchContext();
    }
  }, [patientId]);
  
  const handlePrescriptionSave = (newDraft: PrescriptionDraft) => {
      // Add the new draft to the top of the recent prescriptions list
      setContext(prevContext => {
          if (!prevContext) return null;
          return {
              ...prevContext,
              recent_prescriptions: [newDraft, ...prevContext.recent_prescriptions]
          }
      });
      setIsPrescribing(false); // Close the workflow
      // Optionally, scroll to the new prescription or show a success message
  }

  if (isLoading) {
    return <div className="p-4 bg-white rounded-lg shadow text-center">Loading patient data...</div>;
  }

  if (error) {
    return <div className="p-4 bg-white rounded-lg shadow text-center text-red-600">{error}</div>;
  }

  if (!context) {
    return <div className="p-4 bg-white rounded-lg shadow text-center text-gray-500">No patient data available.</div>;
  }

  const { patient, allergies, active_medications, inactive_medications, preferred_pharmacies, recent_prescriptions } = context;

  return (
    <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
            <PatientDemographics patient={patient} />
            {!isPrescribing && (
                 <button onClick={() => setIsPrescribing(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors">
                    + New Prescription
                </button>
            )}
        </div>
        
        {isPrescribing ? (
            <PrescribingWorkflow 
                patient={patient} 
                prescriberId={prescriberId} 
                onPrescriptionSave={handlePrescriptionSave} 
                onCancel={() => setIsPrescribing(false)} 
            />
        ) : (
            <>
                <PatientAllergies allergies={allergies} />
                <PatientMedicationsList title="Active Medications" medications={active_medications} />
                <PatientMedicationsList title="Inactive/Discontinued Medications" medications={inactive_medications} />
                <RecentPrescriptions prescriptions={recent_prescriptions} />
                <PatientPharmacies pharmacies={preferred_pharmacies} />
            </>
        )}
    </div>
  );
};

// Sub-components for better structure and readability

const PatientDemographics: React.FC<{ patient: User }> = ({ patient }) => (
  <div className="p-3 border rounded-md bg-slate-50">
    <h3 className="text-xl font-bold text-slate-800 mb-2">{patient.full_name}</h3>
    <div className="grid grid-cols-2 gap-2 text-sm">
        <p><span className="font-semibold text-slate-600">Email:</span> {patient.email || 'N/A'}</p>
        <p><span className="font-semibold text-slate-600">Phone:</span> {patient.phone || 'N/A'}</p>
        <p><span className="font-semibold text-slate-600">DOB:</span> {patient.date_of_birth || 'N/A'}</p>
        <p><span className="font-semibold text-slate-600">Gender:</span> {patient.gender || 'N/A'}</p>
    </div>
  </div>
);

const PatientAllergies: React.FC<{ allergies: PatientAllergy[] }> = ({ allergies }) => (
  <div className="mb-4">
    <h4 className="font-bold text-lg text-slate-700 mb-1">Allergies</h4>
    {allergies.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {allergies.map(allergy => (
          <span key={allergy.id} className={`px-2 py-1 text-sm font-medium rounded-full ${allergy.severity === 'SEVERE' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {allergy.allergen} ({allergy.severity})
          </span>
        ))}
      </div>
    ) : (
      <p className="text-sm text-slate-500 italic">No known allergies.</p>
    )}
  </div>
);

const PatientMedicationsList: React.FC<{ title: string; medications: PatientMedication[] }> = ({ title, medications }) => (
    <div className="mb-4">
      <h4 className="font-bold text-lg text-slate-700 mb-2">{title}</h4>
      {medications.length > 0 ? (
        <ul className="space-y-2">
          {medications.map(med => (
            <li key={med.id} className="p-2 border rounded-md text-sm bg-slate-50 hover:bg-slate-100">
              <p className="font-semibold text-slate-800">{med.drug_name} {med.dosage}</p>
              <p className="text-slate-600">{med.frequency} - Status: <span className="font-medium">{med.status}</span></p>
              {med.notes && <p className="text-xs text-slate-500 italic">Notes: {med.notes}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 italic">No medications in this category.</p>
      )}
    </div>
  );
  
const RecentPrescriptions: React.FC<{ prescriptions: PrescriptionDraft[] }> = ({ prescriptions }) => (
    <div className="mb-4">
      <h4 className="font-bold text-lg text-slate-700 mb-2">Recent Prescriptions (Drafts)</h4>
      {prescriptions.length > 0 ? (
        <ul className="space-y-2">
          {prescriptions.map(draft => (
            <li key={draft.id} className="p-2 border rounded-md text-sm bg-blue-50 hover:bg-blue-100">
              <p className="font-semibold text-slate-800">{draft.drug_name} {draft.strength}</p>
              <p className="text-slate-600">{draft.directions} - Qty: {draft.dispense_quantity} - Refills: {draft.refills}</p>
              <p className="text-xs text-slate-500 italic">Status: {draft.status} (Created on {new Date(draft.created_at).toLocaleDateString()})</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 italic">No recent draft prescriptions.</p>
      )}
    </div>
);

const PatientPharmacies: React.FC<{ pharmacies: PatientPreferredPharmacy[] }> = ({ pharmacies }) => (
    <div>
        <h4 className="font-bold text-lg text-slate-700 mb-2">Preferred Pharmacies</h4>
        {pharmacies.length > 0 ? (
        <ul className="space-y-2">
          {pharmacies.map(pref => (
            <li key={pref.id} className="p-2 border rounded-md text-sm bg-slate-50">
              <p className="font-semibold text-slate-800">{pref.pharmacy.name}</p>
              <p className="text-slate-600">{pref.pharmacy.address}, {pref.pharmacy.city}, {pref.pharmacy.state} {pref.pharmacy.zip}</p>
              <p className="text-slate-600">Phone: {pref.pharmacy.phone}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 italic">No preferred pharmacies on file.</p>
      )}
    </div>
);


export default PatientContextView;

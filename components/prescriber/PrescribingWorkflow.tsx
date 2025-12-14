
import React, { useState, useEffect } from 'react';
import { prescriberService } from '../../services/prescriberService';
import { ClinicalDrug, ClinicalPresentation, PrescriptionDraft, User } from '../../types';
import { debounce } from 'lodash';

interface PrescribingWorkflowProps {
  patient: User;
  prescriberId: string;
  onPrescriptionSave: (draft: PrescriptionDraft) => void;
  onCancel: () => void;
}

const PrescribingWorkflow: React.FC<PrescribingWorkflowProps> = ({ patient, prescriberId, onPrescriptionSave, onCancel }) => {
  const [step, setStep] = useState(1);
  const [drugQuery, setDrugQuery] = useState('');
  const [drugSearchResults, setDrugSearchResults] = useState<ClinicalDrug[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<ClinicalDrug | null>(null);
  const [variations, setVariations] = useState<ClinicalPresentation[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<ClinicalPresentation | null>(null);
  const [draftDetails, setDraftDetails] = useState<Partial<PrescriptionDraft>>({});

  const searchDrugs = debounce(async (query: string) => {
    if (query.length < 2) {
      setDrugSearchResults([]);
      return;
    }
    setIsSearching(true);
    const results = await prescriberService.searchDrugs(query);
    setDrugSearchResults(results || []);
    setIsSearching(false);
  }, 300);

  useEffect(() => {
    searchDrugs(drugQuery);
    return () => searchDrugs.cancel();
  }, [drugQuery]);

  const handleDrugSelect = async (drug: ClinicalDrug) => {
    setSelectedDrug(drug);
    const presentationVariations = await prescriberService.getDrugVariations(drug.id);
    setVariations(presentationVariations || []);
    setStep(2);
  };

  const handleVariationSelect = (variation: ClinicalPresentation) => {
    setSelectedVariation(variation);
    setDraftDetails({
      patient_id: patient.id,
      prescriber_id: prescriberId,
      drug_id: selectedDrug!.id,
      drug_name: selectedDrug!.name,
      strength: variation.strength,
      dosage_form: variation.form,
      status: 'DRAFT',
      effective_date: new Date().toISOString().split('T')[0],
      refills: 0,
      no_substitution: false,
      is_controlled: false, 
    });
    setStep(3);
  };
  
  const handleSaveDraft = async () => {
      try {
        const newDraft = await prescriberService.savePrescriptionDraft(draftDetails as any);
        onPrescriptionSave(newDraft);
      } catch (e) {
          alert("Failed to save draft");
          console.error(e);
      }
  }
  
  const resetWorkflow = () => {
      setStep(1);
      setDrugQuery('');
      setSelectedDrug(null);
      setSelectedVariation(null);
      setDraftDetails({});
      onCancel(); // Call parent cancel handler
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return <DrugSearchStep />;
      case 2:
        return <VariationSelectionStep />;
      case 3:
        return <PrescriptionDetailsStep />;
      default: return null;
    }
  };
  
  const DrugSearchStep = () => (
    <div>
        <div className="flex justify-between items-start">
            <h4 className="font-bold text-lg mb-2">Step 1: Search for Drug</h4>
            <FormularyGuide />
        </div>
        <input
          type="text"
          value={drugQuery}
          onChange={(e) => setDrugQuery(e.target.value)}
          placeholder="Type drug name (e.g., Amoxicillin)"
          className="w-full p-2 border rounded-md"
        />
        {isSearching && <p className="p-2">Searching...</p>}
        <ul className="mt-2 border rounded-md max-h-60 overflow-y-auto">
          {drugSearchResults.map(drug => (
            <li key={drug.id} onClick={() => handleDrugSelect(drug)} className="p-2 hover:bg-emerald-50 cursor-pointer flex justify-between items-center border-b last:border-b-0">
              <span>{drug.name}</span>
              <FormularyStatusBadge ven={drug.ven_category} aware={drug.aware_category} />
            </li>
          ))}
        </ul>
    </div>
  );

  const VariationSelectionStep = () => (
    <div>
        <h4 className="font-bold text-lg mb-2">Step 2: Select Presentation for {selectedDrug?.name}</h4>
        <button onClick={() => setStep(1)} className="text-sm text-blue-500 mb-2">&larr; Back to Search</button>
        <ul className="mt-2 border rounded-md max-h-60 overflow-y-auto">
          {variations.map(v => (
            <li key={v.id} onClick={() => handleVariationSelect(v)} className="p-2 hover:bg-emerald-50 cursor-pointer border-b last:border-b-0">
                {v.form} - {v.strength} {v.unit ? `(${v.unit})` : ''}
            </li>
          ))}
        </ul>
    </div>
  );

  const PrescriptionDetailsStep = () => (
    <div>
      <h4 className="font-bold text-lg mb-2">Step 3: Complete Prescription</h4>
      <button onClick={() => setStep(2)} className="text-sm text-blue-500 mb-2">&larr; Back to Presentations</button>
      <div className="p-2 rounded-md bg-slate-100 my-2">
          <p className="font-bold text-slate-800">{selectedDrug?.name} {selectedVariation?.strength} {selectedVariation?.form}</p>
          <p className="text-sm text-slate-600">Patient: {patient.full_name}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
            <label className="block text-sm font-medium">Directions (SIG)</label>
            <input type="text" placeholder="e.g., 1 tablet by mouth daily" className="w-full p-2 border rounded-md" onChange={e => setDraftDetails({...draftDetails, directions: e.target.value})} />
        </div>
        <div>
            <label className="block text-sm font-medium">Dispense Quantity</label>
            <input type="number" placeholder="e.g., 30" className="w-full p-2 border rounded-md" onChange={e => setDraftDetails({...draftDetails, dispense_quantity: Number(e.target.value)})} />
        </div>
        <div>
            <label className="block text-sm font-medium">Dispense Unit</label>
            <input type="text" placeholder="e.g., tablets" className="w-full p-2 border rounded-md" onChange={e => setDraftDetails({...draftDetails, dispense_unit: e.target.value})} />
        </div>
        <div>
            <label className="block text-sm font-medium">Refills</label>
            <input type="number" defaultValue={0} className="w-full p-2 border rounded-md" onChange={e => setDraftDetails({...draftDetails, refills: Number(e.target.value)})} />
        </div>
         <div>
            <label className="block text-sm font-medium">Days Supply</label>
            <input type="number" placeholder="e.g., 30" className="w-full p-2 border rounded-md" onChange={e => setDraftDetails({...draftDetails, days_supply: Number(e.target.value)})} />
        </div>
      </div>
       <div className="mt-4">
          <label className="flex items-center">
              <input type="checkbox" className="mr-2 h-4 w-4 rounded" onChange={e => setDraftDetails({...draftDetails, no_substitution: e.target.checked})} />
              Dispense as Written (No Substitution)
          </label>
      </div>
    </div>
  );

  return (
    <div className="p-4 border rounded-lg bg-white mt-4 shadow-sm">
        {renderStep()}
        <div className="flex justify-end mt-4 border-t pt-4">
            <button onClick={resetWorkflow} className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 mr-2">Cancel</button>
            {step === 3 && <button onClick={handleSaveDraft} className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700">Save to Pending Rx</button>}
        </div>
    </div>
  );
};

const FormularyGuide = () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="text-sm text-blue-500 hover:underline">Formulary Guide</button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white border rounded-lg shadow-xl p-3 z-10">
                    <p className="font-bold text-base mb-2">Formulary Status Guide</p>
                    <p className="text-sm mb-1"><strong className="text-green-600">V / Access:</strong> Preferred, generally available.</p>
                    <p className="text-sm mb-1"><strong className="text-orange-600">E / Watch:</strong> Use with caution, may have restrictions.</p>
                    <p className="text-sm mb-1"><strong className="text-red-600">N / Reserve:</strong> Restricted, requires justification.</p>
                    <p className="text-xs text-gray-500 mt-2">This is a guide. Actual coverage may vary.</p>
                </div>
            )}
        </div>
    );
}

const FormularyStatusBadge: React.FC<{ ven?: string | null, aware?: string | null }> = ({ ven, aware }) => {
    const getStatus = () => {
        if (ven === 'V' || aware === 'Access') return { text: 'Preferred', className: 'bg-green-100 text-green-800' };
        if (ven === 'E' || aware === 'Watch') return { text: 'Tier 2', className: 'bg-orange-100 text-orange-800' };
        if (ven === 'N' || aware === 'Reserve') return { text: 'Restricted', className: 'bg-red-100 text-red-800' };
        return { text: 'N/A', className: 'bg-gray-100 text-gray-800' };
    }
    const status = getStatus();
    return (
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.className}`}>
            {status.text}
        </span>
    );
}


export default PrescribingWorkflow;

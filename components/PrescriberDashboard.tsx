import React, { useState, useEffect } from 'react';
import { User, PrescriberProfile, PatientContext, PrescriptionDraft, PatientMedication } from '../../types';
import { getPatientContext, getPatientMedications } from '../../services/prescriberService';
import PatientSearchPanel from './prescriber/PatientSearchPanel';
import PatientContextView from './prescriber/PatientContextView';
import PrescribingWorkflow from './prescriber/PrescribingWorkflow';
import PendingMedicationsList from './prescriber/PendingMedicationsList';
import ActiveMedicationsList from './prescriber/ActiveMedicationsList';
import InactiveMedicationsList from './prescriber/InactiveMedicationsList';

interface PrescriberDashboardProps {
  currentUser: User;
  prescriberProfile: PrescriberProfile;
}

type Tab = 'PATIENT_CONTEXT' | 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'NOTIFICATIONS';

const PrescriberDashboard: React.FC<PrescriberDashboardProps> = ({ currentUser, prescriberProfile }) => {
  const [activeTab, setActiveTab] = useState<Tab>('PATIENT_CONTEXT');
  const [selectedPatient, setSelectedPatient] = useState<User | null>(null);
  const [patientContext, setPatientContext] = useState<PatientContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [drafts, setDrafts] = useState<PrescriptionDraft[]>([]);
  const [activeMedications, setActiveMedications] = useState<PatientMedication[]>([]);
  const [inactiveMedications, setInactiveMedications] = useState<PatientMedication[]>([]);

  useEffect(() => {
    if (selectedPatient) {
      setIsLoadingContext(true);
      getPatientContext(selectedPatient.id)
        .then(context => {
          setPatientContext(context);
          setActiveMedications(context.active_medications);
          setIsLoadingContext(false);
        })
        .catch(err => {
          console.error("Failed to load patient context:", err);
          setIsLoadingContext(false);
        });

      getPatientMedications(selectedPatient.id, 'INACTIVE').then(setInactiveMedications);

    } else {
      setPatientContext(null);
      setActiveMedications([]);
      setInactiveMedications([]);
    }
  }, [selectedPatient]);

  const handleSaveDraft = (draft: PrescriptionDraft) => {
    const newDraft = { ...draft, id: Date.now().toString() };
    setDrafts([...drafts, newDraft]);
    setActiveTab('PENDING');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'PATIENT_CONTEXT':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
                <PatientSearchPanel prescriber={prescriberProfile} onPatientSelect={setSelectedPatient} />
                {selectedPatient && <PatientContextView patient={selectedPatient} patientContext={patientContext} isLoading={isLoadingContext} />}
            </div>
            {selectedPatient && (
                <div>
                    <PrescribingWorkflow patientId={selectedPatient.id} prescriberId={prescriberProfile.id} onSaveDraft={handleSaveDraft} />
                </div>
            )}
          </div>
        );
      case 'PENDING':
        return <PendingMedicationsList prescriberId={prescriberProfile.id} drafts={drafts} />;
      case 'ACTIVE':
        return <ActiveMedicationsList medications={activeMedications} />;
      case 'INACTIVE':
        return <InactiveMedicationsList medications={inactiveMedications} />;
      case 'NOTIFICATIONS':
        return <div>Notifications (Coming Soon)</div>;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Prescriber Dashboard</h1>
        <p className="text-sm text-gray-600 mb-6">
          Welcome, {prescriberProfile.prescriber_role} {currentUser.full_name}. NPI: {prescriberProfile.npi}
        </p>

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
            <TabButton name="Patient & Context" tabName="PATIENT_CONTEXT" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton name="Pending" tabName="PENDING" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton name="Active" tabName="ACTIVE" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton name="Inactive" tabName="INACTIVE" activeTab={activeTab} setActiveTab={setActiveTab} />
            <TabButton name="Notifications" tabName="NOTIFICATIONS" activeTab={activeTab} setActiveTab={setActiveTab} />
          </nav>
        </div>

        <div className="mt-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

interface TabButtonProps {
  name: string;
  tabName: Tab;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

const TabButton: React.FC<TabButtonProps> = ({ name, tabName, activeTab, setActiveTab }) => (
  <button
    onClick={() => setActiveTab(tabName)}
    className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors
      ${activeTab === tabName
        ? 'border-indigo-500 text-indigo-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
  >
    {name}
  </button>
);

export default PrescriberDashboard;

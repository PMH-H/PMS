
import React, { useState } from 'react';
import { User, PrescriberProfile, PatientContext } from '../../types';
import PatientSearchPanel from '../../components/prescriber/PatientSearchPanel';
import PatientContextView from '../../components/prescriber/PatientContextView';
// NOTE: The following components will be created in subsequent steps
// import PendingMedicationsList from '../../components/prescriber/PendingMedicationsList';
// import ActiveMedicationsList from '../../components/prescriber/ActiveMedicationsList';
// import InactiveMedicationsList from '../../components/prescriber/InactiveMedicationsList';
// import NotificationPanel from '../../components/prescriber/NotificationPanel';

interface PrescriberDashboardProps {
  currentUser: User;
  prescriberProfile: PrescriberProfile;
}

type DashboardTab = 'PATIENT' | 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'NOTIFICATIONS';

const PrescriberDashboard: React.FC<PrescriberDashboardProps> = ({ currentUser, prescriberProfile }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('PATIENT');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const handlePatientSelect = (patientId: string) => {
    setSelectedPatientId(patientId);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'PATIENT':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow">
              <PatientSearchPanel onPatientSelect={handlePatientSelect} />
            </div>
            <div className="lg:col-span-2">
              {selectedPatientId ? (
                <PatientContextView patientId={selectedPatientId} />
              ) : (
                <div className="flex items-center justify-center h-full bg-white p-4 rounded-lg shadow text-gray-500">
                  Select a patient to view their context.
                </div>
              )}
            </div>
          </div>
        );
      case 'PENDING':
        // return <PendingMedicationsList prescriberId={currentUser.id} />;
        return <div className="p-4 bg-white rounded-lg shadow">Pending Medications (Coming Soon)</div>;
      case 'ACTIVE':
        // return <ActiveMedicationsList prescriberId={currentUser.id} />;
        return <div className="p-4 bg-white rounded-lg shadow">Active Medications (Coming Soon)</div>;
      case 'INACTIVE':
        // return <InactiveMedicationsList prescriberId={currentUser.id} />;
        return <div className="p-4 bg-white rounded-lg shadow">Inactive Medications (Coming Soon)</div>;
      case 'NOTIFICATIONS':
        // return <NotificationPanel userId={currentUser.id} />;
        return <div className="p-4 bg-white rounded-lg shadow">Notifications (Coming Soon)</div>;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-slate-50 min-h-screen">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Prescriber Dashboard</h1>
        <p className="text-slate-600">Welcome, {prescriberProfile.prescriber_role} {currentUser.full_name}</p>
      </header>
      <div className="flex mb-4 border-b border-slate-200">
        <TabButton title="Patient Context" isActive={activeTab === 'PATIENT'} onClick={() => setActiveTab('PATIENT')} />
        <TabButton title="Pending Meds" isActive={activeTab === 'PENDING'} onClick={() => setActiveTab('PENDING')} />
        <TabButton title="Active Meds" isActive={activeTab === 'ACTIVE'} onClick={() => setActiveTab('ACTIVE')} />
        <TabButton title="Inactive Meds" isActive={activeTab === 'INACTIVE'} onClick={() => setActiveTab('INACTIVE')} />
        <TabButton title="Notifications" isActive={activeTab === 'NOTIFICATIONS'} onClick={() => setActiveTab('NOTIFICATIONS')} />
      </div>
      <main>
        {renderContent()}
      </main>
    </div>
  );
};

interface TabButtonProps {
  title: string;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ title, isActive, onClick }) => (
  <button
    className={`px-4 py-2 -mb-px font-semibold text-sm rounded-t-md transition-colors duration-200 ${
      isActive
        ? 'border-b-2 border-emerald-500 bg-white text-emerald-600'
        : 'border-b-2 border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'
    }`}
    onClick={onClick}
  >
    {title}
  </button>
);

export default PrescriberDashboard;

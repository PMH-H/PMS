
import React, { useState } from 'react';
import { User, PrescriberProfile } from '../../types';
import PatientSearchPanel from './PatientSearchPanel';
import PatientContextView from './PatientContextView';
import PendingMedicationsList from './PendingMedicationsList';
import ActiveMedicationsList from './ActiveMedicationsList';
import InactiveMedicationsList from './InactiveMedicationsList';

// Mock data for now, to be replaced with real components
const NotificationsPanel = () => <div className="p-4 bg-white shadow rounded-lg">Notifications Panel</div>;

interface PrescriberDashboardProps {
  currentUser: User;
  prescriberProfile: PrescriberProfile;
}

type DashboardTab = 'CONTEXT' | 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'NOTIFICATIONS';

const PrescriberDashboard: React.FC<PrescriberDashboardProps> = ({ currentUser, prescriberProfile }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('CONTEXT');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'CONTEXT':
        return (
          <PatientSearchPanel 
            onPatientSelect={setSelectedPatientId} 
            prescriberId={currentUser.id} 
          />
        );
      case 'PENDING':
        return <PendingMedicationsList prescriberId={currentUser.id} />;
      case 'ACTIVE':
        return <ActiveMedicationsList prescriberId={currentUser.id} />;
      case 'INACTIVE':
        return <InactiveMedicationsList prescriberId={currentUser.id} />;
      case 'NOTIFICATIONS':
        return <NotificationsPanel />;
      default:
        return null;
    }
  };

  const TabButton: React.FC<{ tab: DashboardTab; label: string; count?: number }> = ({ tab, label, count }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        activeTab === tab
          ? 'bg-emerald-600 text-white'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
          activeTab === tab ? 'bg-emerald-400 text-white' : 'bg-gray-200 text-gray-700'
        }`}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Prescriber Dashboard</h1>
                <p className="text-sm text-gray-500">Welcome, {currentUser.full_name}.</p>
            </div>
        </div>

        {/* Tab Navigation */}
        {!selectedPatientId ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-4 mb-6">
                <TabButton tab="CONTEXT" label="Patient Search & Context" />
                <TabButton tab="PENDING" label="Pending Rx" count={0} />
                <TabButton tab="ACTIVE" label="Active Rx" />
                <TabButton tab="INACTIVE" label="Inactive Rx" />
                <TabButton tab="NOTIFICATIONS" label="Notifications" count={0} />
            </div>
        ) : (
            <button onClick={() => setSelectedPatientId(null)} className="mb-4 text-sm text-blue-500 hover:underline">
                &larr; Back to Patient Search
            </button>
        )}

        <div>
          {selectedPatientId ? (
            <PatientContextView patientId={selectedPatientId} prescriberId={currentUser.id} />
          ) : (
            renderTabContent()
          )}
        </div>
      </div>
    </div>
  );
};

export default PrescriberDashboard;

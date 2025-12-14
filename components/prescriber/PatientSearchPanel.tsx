
import React, { useState, useEffect, useCallback } from 'react';
import { prescriberService } from '../../services/prescriberService';
import { debounce } from 'lodash';

interface PatientSearchPanelProps {
  onPatientSelect: (patientId: string) => void;
  prescriberId: string; // Added prescriberId prop
}

const PatientSearchPanel: React.FC<PatientSearchPanelProps> = ({ onPatientSelect, prescriberId }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // prescriberId is now available if needed for logging or filtering in the future

  const searchPatients = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length < 3) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const data = await prescriberService.searchPatients(searchQuery);
        setResults(data || []);
      } catch (err: any) {
        setError('Failed to search for patients. Please try again.');
        console.error(err);
      }
      setIsLoading(false);
    }, 300), // 300ms debounce delay
    []
  );

  useEffect(() => {
    searchPatients(query);
    // Cleanup function to cancel any pending debounced calls
    return () => {
      searchPatients.cancel();
    };
  }, [query, searchPatients]);

  const handleSelect = (patient: any) => {
      onPatientSelect(patient.id);
      setQuery(''); // Clear search query after selection
      setResults([]); // Clear results after selection
  };

  return (
    <div>
      <h2 className="font-bold text-lg mb-3 text-slate-700">Search Patients</h2>
      <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing patient name..."
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {isLoading && <div className="absolute right-2 top-2 spinner-border animate-spin inline-block w-4 h-4 border-2 rounded-full border-t-transparent border-emerald-500"></div>}
      </div>
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      {results.length > 0 && (
        <ul className="mt-2 border border-slate-200 rounded-md bg-white max-h-60 overflow-y-auto shadow-sm">
          {results.map((patient) => (
            <li
              key={patient.id}
              onClick={() => handleSelect(patient)}
              className="px-3 py-2 hover:bg-emerald-50 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors duration-150"
            >
              <div className="font-semibold text-slate-800">{patient.full_name}</div>
              <div className="text-sm text-slate-500">DOB: {patient.date_of_birth || 'N/A'}</div>
            </li>
          ))}
        </ul>
      )}
      {query.length >= 3 && !isLoading && results.length === 0 && (
        <div className="mt-2 text-slate-500">No patients found matching your query.</div>
      )}
    </div>
  );
};

export default PatientSearchPanel;

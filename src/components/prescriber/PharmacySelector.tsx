import React, { useState } from 'react';
import { Pharmacy } from '../../types';

interface PharmacySelectorProps {
  patientId: string;
  onSelectPharmacy: (pharmacy: Pharmacy) => void;
  preferredPharmacies: { id: string, pharmacy: Pharmacy }[];
}

const PharmacySelector: React.FC<PharmacySelectorProps> = ({ patientId, onSelectPharmacy, preferredPharmacies }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Pharmacy[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    setIsLoading(true);
    // Mock API call to search pharmacies
    setTimeout(() => {
      const mockPharmacies: Pharmacy[] = [
        { id: 'ph-1', name: 'CVS Pharmacy', address: '123 Main St', city: 'Anytown', state: 'CA', zip: '12345', phone: '555-1111' },
        { id: 'ph-2', name: 'Walgreens', address: '456 Oak Ave', city: 'Anytown', state: 'CA', zip: '12345', phone: '555-2222' },
      ].filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
      setSearchResults(mockPharmacies);
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="mt-4">
      <h4 className="font-semibold text-md mb-2">Select Pharmacy</h4>
      
      {preferredPharmacies.length > 0 && (
        <div className="mb-3">
            <h5 className="text-sm font-semibold text-gray-600 mb-1">Preferred</h5>
            {preferredPharmacies.map(({pharmacy}) => (
                <button key={pharmacy.id} onClick={() => onSelectPharmacy(pharmacy)} className="w-full text-left p-2 bg-gray-100 hover:bg-gray-200 rounded text-sm mb-1">
                    {pharmacy.name} - {pharmacy.address}
                </button>
            ))}
        </div>
      )}

      <input
        type="text"
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search for a pharmacy..."
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {isLoading && <div className="mt-1 text-sm">Searching...</div>}
      {searchResults.length > 0 && (
        <ul className="mt-2 border-t border-gray-200">
          {searchResults.map(pharmacy => (
            <li key={pharmacy.id} className="py-1 border-b last:border-b-0">
              <button 
                onClick={() => onSelectPharmacy(pharmacy)}
                className="w-full text-left hover:bg-gray-100 p-2 rounded text-sm"
              >
                {pharmacy.name} - {pharmacy.address}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PharmacySelector;

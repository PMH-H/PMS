import React, { useState, useEffect, useRef } from 'react';
import { searchClinicalDrugs } from '../services/drugDb';
import { ClinicalDrug } from '../types';

interface DrugNameInputProps {
    value: string;
    onChange: (name: string, drug?: ClinicalDrug) => void;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

/**
 * Drug name input with formulary autocomplete suggestions
 * Searches clinical_drugs table and shows dropdown with matching medications
 */
const DrugNameInput: React.FC<DrugNameInputProps> = ({
    value,
    onChange,
    placeholder = 'e.g. Amoxicillin 500mg',
    required = false,
    className = ''
}) => {
    const [suggestions, setSuggestions] = useState<ClinicalDrug[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Debounced search effect
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (value.length < 2) {
            setSuggestions([]);
            setShowDropdown(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setIsLoading(true);
            try {
                const results = await searchClinicalDrugs(value);
                setSuggestions(results);
                setShowDropdown(results.length > 0);
                setSelectedIndex(-1);
            } catch (err) {
                console.error('Error searching drugs:', err);
                setSuggestions([]);
            } finally {
                setIsLoading(false);
            }
        }, 300); // 300ms debounce

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [value]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (drug: ClinicalDrug) => {
        // Build a name with presentation if available
        let displayName = drug.name;
        if (drug.presentations && drug.presentations.length > 0) {
            const pres = drug.presentations[0];
            displayName = `${drug.name} ${pres.strength || ''} ${pres.form || ''}`.trim();
        }
        onChange(displayName, drug);
        setShowDropdown(false);
        setSuggestions([]);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showDropdown || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                    e.preventDefault();
                    handleSelect(suggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                setShowDropdown(false);
                break;
        }
    };

    return (
        <div className="relative">
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                required={required}
                className={`w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none ${className}`}
                autoComplete="off"
            />

            {/* Loading indicator */}
            {isLoading && (
                <div className="absolute right-3 top-2.5">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                </div>
            )}

            {/* Suggestions dropdown */}
            {showDropdown && suggestions.length > 0 && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                >
                    <div className="p-2 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase bg-gray-50">
                        📚 Formulary Suggestions ({suggestions.length})
                    </div>
                    {suggestions.map((drug, index) => (
                        <button
                            key={drug.id}
                            type="button"
                            onClick={() => handleSelect(drug)}
                            className={`w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-b-0 ${index === selectedIndex ? 'bg-indigo-50' : ''
                                }`}
                        >
                            <div className="font-medium text-gray-900">{drug.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-2">
                                {drug.presentations && drug.presentations.length > 0 && (
                                    <span className="bg-gray-100 px-1.5 py-0.5 rounded">
                                        {drug.presentations[0].form} {drug.presentations[0].strength}
                                    </span>
                                )}
                                {drug.ven_category && (
                                    <span className={`px-1.5 py-0.5 rounded ${drug.ven_category === 'V' ? 'bg-red-100 text-red-700' :
                                            drug.ven_category === 'E' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-gray-100 text-gray-600'
                                        }`}>
                                        VEN: {drug.ven_category}
                                    </span>
                                )}
                                {drug.category?.name && (
                                    <span className="text-gray-400">{drug.category.name}</span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Helper text */}
            <p className="text-xs text-gray-500 mt-1">
                💡 Type to search the <strong>Formulary</strong>. Select a drug or enter a custom name.
            </p>
        </div>
    );
};

export default DrugNameInput;

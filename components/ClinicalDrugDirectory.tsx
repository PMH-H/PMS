import React, { useState, useEffect } from 'react';
import { searchClinicalDrugs, getClinicalDrugDetails } from '../services/drugDb';
import { ClinicalDrug, ClinicalInteraction } from '../types';

const ClinicalDrugDirectory: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ClinicalDrug[]>([]);
    const [loading, setLoading] = useState(false);
    const [debouncedQuery, setDebouncedQuery] = useState(query);
    const [selectedDrug, setSelectedDrug] = useState<ClinicalDrug | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Debounce Search
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuery(query);
        }, 500);
        return () => clearTimeout(handler);
    }, [query]);

    // Fetch Search Results
    useEffect(() => {
        if (!debouncedQuery) {
            setResults([]);
            return;
        }

        const fetchDrugs = async () => {
            setLoading(true);
            const data = await searchClinicalDrugs(debouncedQuery);
            setResults(data);
            setLoading(false);
        };
        fetchDrugs();
    }, [debouncedQuery]);

    // Fetch Details on Click
    const handleDrugClick = async (drugId: string) => {
        setLoadingDetails(true);
        const fullData = await getClinicalDrugDetails(drugId);
        if (fullData) {
            setSelectedDrug(fullData);
        }
        setLoadingDetails(false);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full relative overflow-hidden">
            {/* SEARCH HEADER */}
            <div className="p-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-bold text-gray-800 mb-2">Zambia Essential Medicines List</h3>
                <div className="relative">
                    <input
                        type="text"
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Search generic names (e.g. Propofol, Amoxicillin)..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>

            {/* RESULTS LIST */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading && <div className="text-center text-gray-500 py-4">Searching...</div>}

                {!loading && results.length === 0 && debouncedQuery && (
                    <div className="text-center text-gray-500 py-4">No medicines found.</div>
                )}

                {!loading && !debouncedQuery && (
                    <div className="text-center text-gray-400 py-12">
                        <p>Search standard treatment guidelines and monographs.</p>
                    </div>
                )}

                {results.map(drug => (
                    <div
                        key={drug.id}
                        onClick={() => handleDrugClick(drug.id)}
                        className="border border-gray-200 rounded-lg p-3 hover:bg-emerald-50 transition-colors cursor-pointer group"
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-emerald-800 text-lg group-hover:text-emerald-900">{drug.name}</h4>
                                <div className="flex gap-2 mt-1 flex-wrap">
                                    <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                        {drug.category?.name || 'Uncategorized'}
                                    </span>
                                    {drug.ven_category && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${drug.ven_category === 'V' ? 'bg-red-100 text-red-700' :
                                                drug.ven_category === 'E' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-gray-100 text-gray-700'
                                            }`}>
                                            {drug.ven_category === 'V' ? 'VITAL' : drug.ven_category === 'E' ? 'ESSENTIAL' : 'NECESSARY'}
                                        </span>
                                    )}
                                </div>
                                {/* Short Snippet / Text preview if available */}
                                <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                                    {drug.description || drug.indications_text || 'No description available.'}
                                </p>
                            </div>
                            <button className="text-gray-400 group-hover:text-emerald-600">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* DETAIL MODAL / SLIDE-OVER */}
            {selectedDrug && (
                <div className="absolute inset-0 bg-white z-20 flex flex-col animate-in slide-in-from-right duration-200">
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-emerald-700 text-white">
                        <div>
                            <h2 className="text-xl font-bold">{selectedDrug.name}</h2>
                            <p className="text-emerald-100 text-sm">{selectedDrug.category?.name}</p>
                        </div>
                        <button
                            onClick={() => setSelectedDrug(null)}
                            className="p-2 hover:bg-emerald-600 rounded-full"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <DrugDetailView drug={selectedDrug} />
                    </div>
                </div>
            )}

            {loadingDetails && (
                <div className="absolute inset-0 bg-white/80 z-30 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                </div>
            )}
        </div>
    );
};

// Internal Tabs Component for Detail View
const DrugDetailView: React.FC<{ drug: ClinicalDrug }> = ({ drug }) => {
    const [activeTab, setActiveTab] = useState<'MONOGRAPH' | 'POPULATIONS' | 'INTERACTIONS'>('MONOGRAPH');

    return (
        <div>
            {/* TABS */}
            <div className="flex border-b border-gray-200">
                <button
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'MONOGRAPH' ? 'text-emerald-700 border-b-2 border-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('MONOGRAPH')}
                >
                    Monograph
                </button>
                <button
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'POPULATIONS' ? 'text-emerald-700 border-b-2 border-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('POPULATIONS')}
                >
                    Populations
                </button>
                <button
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'INTERACTIONS' ? 'text-emerald-700 border-b-2 border-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('INTERACTIONS')}
                >
                    Interactions ({drug.interactions?.length || 0})
                </button>
            </div>

            {/* CONTENT */}
            <div className="p-6 space-y-6">
                {activeTab === 'MONOGRAPH' && (
                    <div className="space-y-6">
                        <Section title="Description" content={drug.description} />
                        <Section title="Mechanism of Action" content={drug.mechanism_of_action} />
                        <Section title="Indications" content={drug.indications_text} />
                        <Section title="Contraindications" content={drug.contraindications_text} alert />
                        <Section title="Dosage & Administration" content={drug.dosage_text} />
                        <Section title="Adverse Effects" content={drug.adverse_effects_text} />
                        <Section title="Storage" content={drug.storage_text} />

                        {/* Presentations */}
                        {drug.presentations && drug.presentations.length > 0 && (
                            <div>
                                <h4 className="font-bold text-gray-800 mb-2">Available Presentations</h4>
                                <div className="grid grid-cols-1 gap-2">
                                    {drug.presentations.map((p, idx) => (
                                        <div key={idx} className="bg-gray-50 p-2 rounded border border-gray-200 text-sm">
                                            <span className="font-semibold">{p.form}</span> {p.strength} {p.packaging && `(${p.packaging})`}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'POPULATIONS' && (
                    <div className="space-y-6">
                        <Section title="Pregnancy & Breastfeeding" content={drug.pregnancy_use_text} />
                        <Section title="Pediatric Use" content={drug.pediatric_use_text} />
                        <Section title="Geriatric Use" content={drug.geriatric_use_text} />
                        <Section title="Overdose Management" content={drug.overdose_text} alert />
                    </div>
                )}

                {activeTab === 'INTERACTIONS' && (
                    <div className="space-y-4">
                        {(!drug.interactions || drug.interactions.length === 0) && (
                            <div className="text-gray-500 italic">No specific interactions recorded.</div>
                        )}
                        {drug.interactions?.map((interaction: any) => (
                            <div key={interaction.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="flex justify-between items-start mb-2">
                                    <h5 className="font-bold text-gray-800 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                        </svg>
                                        {interaction.other_drug_name}
                                    </h5>
                                    <Badge severity={interaction.severity} />
                                </div>
                                <p className="text-sm text-gray-700">{interaction.description}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper Components
const Section: React.FC<{ title: string; content?: string; alert?: boolean }> = ({ title, content, alert }) => {
    if (!content) return null;
    return (
        <div className={alert ? "bg-red-50 p-4 rounded-lg border border-red-100" : ""}>
            <h4 className={`font-bold mb-2 ${alert ? "text-red-800" : "text-gray-800"}`}>{title}</h4>
            <div className={`text-sm leading-relaxed whitespace-pre-wrap ${alert ? "text-red-700" : "text-gray-600"}`}>
                {content}
            </div>
        </div>
    );
};

const Badge: React.FC<{ severity: string }> = ({ severity }) => {
    let classes = "bg-gray-100 text-gray-700";
    if (severity === 'SEVERE' || severity === 'CONTRAINDICATED') classes = "bg-red-100 text-red-700";
    if (severity === 'MODERATE') classes = "bg-amber-100 text-amber-700";
    if (severity === 'MILD') classes = "bg-blue-50 text-blue-700";

    return (
        <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${classes}`}>
            {severity}
        </span>
    );
};

export default ClinicalDrugDirectory;

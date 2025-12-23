import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'EN' | 'BEM';

interface Translations {
    adherence_title: string;
    adherence_subtitle: string;
    add_med: string;
    status: string;
    on_track: string;
    at_risk: string;
    keep_adhering: string;
    day: string;
    antibiotic_critical: string;
    antibiotic_education: string;
    daily_check_in: string;
    check_in_complete: string;
    symptom_wellness_q: string;
    symptom_fever_q: string;
    symptom_breathing_q: string;
    yes: string;
    no: string;
    submit: string;
}

const translations: Record<Language, Translations> = {
    EN: {
        adherence_title: "Treatment Plan",
        adherence_subtitle: "Executing your care plan safely.",
        add_med: "+ Add Med",
        status: "Status",
        on_track: "On Track",
        at_risk: "At Risk",
        keep_adhering: "Keep adhering to your schedule.",
        day: "Day",
        antibiotic_critical: "ANTIBIOTIC - CRITICAL",
        antibiotic_education: "Completing the full course prevents relapse and resistance, even if you feel better.",
        daily_check_in: "Daily Health Check",
        check_in_complete: "Daily Check-in Complete",
        symptom_wellness_q: "How do you feel overall today?",
        symptom_fever_q: "Do you have a fever?",
        symptom_breathing_q: "How is your breathing?",
        yes: "Yes",
        no: "No",
        submit: "Submit"
    },
    BEM: {
        adherence_title: "Umuline wa Kundapwa",
        adherence_subtitle: "Ukukonka ifunde lya kundapwa.",
        add_med: "+ Lunda Umuti",
        status: "Imikalile",
        on_track: "Muli bwino",
        at_risk: "Muli mu busanso",
        keep_adhering: "Konkanyeni ukunwa umuti.",
        day: "Ubushiku",
        antibiotic_critical: "UMUTI WAMAKA - WACINDAMA",
        antibiotic_education: "Pwishereni umuti onse ukucilwilako ukulwala na kabili, nangu muleumfwa bwino.",
        daily_check_in: "Ukulinga Ubumi Bwa Cila Bushiku",
        check_in_complete: "Mwapwisha Ukulinga",
        symptom_wellness_q: "Muleumfwa shani lelo?",
        symptom_fever_q: "Kwali mpepo?",
        symptom_breathing_q: "Mulepwemina shani?",
        yes: "Ee",
        no: "Awe",
        submit: "Tumeni"
    }
};

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>('EN');

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
    return context;
};

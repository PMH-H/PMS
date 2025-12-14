
import { supabase } from './supabase';
import { ClinicalDrug } from '../types';

export const searchClinicalDrugs = async (query: string): Promise<ClinicalDrug[]> => {
    if (!query) return [];

    const { data, error } = await supabase
        .from('clinical_drugs')
        .select(`
            id, name, description, ven_category, aware_category,
            mechanism_of_action, indications_text, contraindications_text, 
            adverse_effects_text, dosage_text, storage_text,
            category:clinical_categories(name),
            presentations:clinical_presentations(form, strength, packaging)
        `)
        .ilike('name', `%${query}%`)
        .limit(20);

    if (error) {
        console.error('Error searching drugs:', error);
        return [];
    }

    return data as any;
};

export const getClinicalDrugDetails = async (id: string): Promise<ClinicalDrug | null> => {
    // 1. Fetch Core Data
    const { data: drug, error } = await supabase
        .from('clinical_drugs')
        .select(`
            *,
            category:clinical_categories(name),
            presentations:clinical_presentations(*)
        `)
        .eq('id', id)
        .single();

    if (error || !drug) {
        console.error('Error fetching drug details:', error);
        return null;
    }

    // 2. Fetch Interactions (Outgoing only for now, symmetric logic can be added)
    // We want details of the OTHER drug if it exists.
    const { data: interactions, error: intError } = await supabase
        .from('clinical_interactions')
        .select(`
            *,
            drug2:clinical_drugs!clinical_interactions_drug_id_2_fkey(name)
        `)
        .eq('drug_id_1', id);

    if (intError) console.error('Error fetching interactions:', intError);

    // Map interactions to friendly UI format
    const mappedInteractions = (interactions || []).map((i: any) => ({
        ...i,
        other_drug_name: i.interacting_entity_name || i.drug2?.name || 'Unknown'
    }));

    return {
        ...drug,
        interactions: mappedInteractions
    } as ClinicalDrug;
};

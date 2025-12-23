
import { supabase } from './supabase';
import {
  PrescriptionDraft,
  PatientContext,
  PrescriberFavorite,
  Pharmacy,
  PatientMedication,
} from '../types';

export const prescriberService = {
  // Patient Management
  async searchPatients(query: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, date_of_birth')
      .ilike('full_name', `%${query}%`)
      .eq('role', 'customer')
      .limit(10);
    if (error) throw new Error(error.message);
    return data;
  },

  async getPatientContext(patientId: string): Promise<PatientContext> {
    const { data: patient, error: patientError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', patientId)
      .single();
    if (patientError) throw new Error(patientError.message);

    const { data: allergies, error: allergiesError } = await supabase
      .from('patient_allergies')
      .select('*')
      .eq('patient_id', patientId);
    if (allergiesError) throw new Error(allergiesError.message);

    const { data: medications, error: medsError } = await supabase
      .from('patient_medications')
      .select('*')
      .eq('patient_id', patientId);
    if (medsError) throw new Error(medsError.message);

    const active_medications = medications?.filter(m => m.status === 'ACTIVE') || [];
    const inactive_medications = medications?.filter(m => m.status !== 'ACTIVE') || [];


    const { data: preferred_pharmacies, error: pharmaciesError } = await supabase
      .from('patient_preferred_pharmacies')
      .select('*, pharmacy:pharmacies(*)')
      .eq('patient_id', patientId);
    if (pharmaciesError) throw new Error(pharmaciesError.message);

    const { data: recent_prescriptions, error: prescriptionsError } = await supabase
      .from('prescription_drafts')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (prescriptionsError) throw new Error(prescriptionsError.message);


    return {
      patient,
      allergies,
      active_medications,
      inactive_medications,
      preferred_pharmacies,
      recent_prescriptions
    } as PatientContext;
  },

  async getPatientMedications(patientId: string, status?: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED'): Promise<PatientMedication[]> {
    let query = supabase.from('patient_medications').select('*').eq('patient_id', patientId);
    if (status) {
      query = query.eq('status', status);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  },

  // Drug & Prescription Management
  async searchDrugs(query: string, limit: number = 20) {
    const { data, error } = await supabase
      .from('clinical_drugs')
      .select('id, name, description')
      .ilike('name', `%${query}%`)
      .limit(limit);
    if (error) throw new Error(error.message);
    return data;
  },

  async getDrugVariations(drugId: string) {
    const { data, error } = await supabase
      .from('clinical_presentations')
      .select('*')
      .eq('drug_id', drugId);
    if (error) throw new Error(error.message);
    return data;
  },

  async savePrescriptionDraft(draft: Omit<PrescriptionDraft, 'id' | 'created_at' | 'updated_at'>): Promise<PrescriptionDraft> {
    const { data, error } = await supabase
      .from('prescription_drafts')
      .insert(draft)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updatePrescriptionDraft(draftId: string, updates: Partial<PrescriptionDraft>): Promise<PrescriptionDraft> {
    const { data, error } = await supabase
      .from('prescription_drafts')
      .update(updates)
      .eq('id', draftId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async approvePrescription(draftId: string, pin?: string) {
    // In a real scenario, this would involve a call to an edge function
    // to verify the PIN and then send the prescription.
    // For now, we'll just update the status.
    console.log(`Approving prescription ${draftId}` + (pin ? ' with PIN' : ''));
    return this.updatePrescriptionDraft(draftId, { status: 'APPROVED' });
  },

  async deletePrescriptionDraft(draftId: string) {
    const { error } = await supabase
      .from('prescription_drafts')
      .delete()
      .eq('id', draftId);
    if (error) throw new Error(error.message);
    return true;
  },

  async reorderPrescription(medicationId: string): Promise<PrescriptionDraft> {
    const { data: medication, error: medError } = await supabase
      .from('patient_medications')
      .select('*')
      .eq('id', medicationId)
      .single();

    if (medError) throw new Error(medError.message);
    if (!medication) throw new Error('Medication not found');

    const draft: Omit<PrescriptionDraft, 'id' | 'created_at' | 'updated_at'> = {
      patient_id: medication.patient_id,
      prescriber_id: supabase.auth.user()!.id,
      drug_name: medication.drug_name,
      strength: medication.dosage,
      dosage_form: '', // This might need to be looked up
      directions: '', // To be filled by prescriber
      dispense_quantity: 0,
      dispense_unit: '',
      refills: 0,
      days_supply: 0,
      effective_date: new Date().toISOString().split('T')[0],
      no_substitution: false,
      status: 'DRAFT',
      is_controlled: false, // This would need to be determined
    };

    return this.savePrescriptionDraft(draft);
  },

  // Favorites Management
  async getFavorites(userId: string): Promise<PrescriberFavorite[]> {
    const { data, error } = await supabase
      .from('prescriber_favorites')
      .select('*')
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return data;
  },

  async addFavorite(favorite: Omit<PrescriberFavorite, 'id' | 'created_at'>): Promise<PrescriberFavorite> {
    const { data, error } = await supabase
      .from('prescriber_favorites')
      .insert(favorite)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteFavorite(favoriteId: string): Promise<boolean> {
    const { error } = await supabase
      .from('prescriber_favorites')
      .delete()
      .eq('id', favoriteId);
    if (error) throw new Error(error.message);
    return true;
  },

  // Pharmacy Management
  async searchPharmacies(query: string): Promise<Pharmacy[]> {
    const { data, error } = await supabase
      .from('pharmacies')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(10);
    if (error) throw new Error(error.message);
    return data;
  },

  async changePharmacy(prescriptionId: string, pharmacyId: string) {
    // This would likely involve creating an RxChangeRequest
    console.log(`Requesting pharmacy change for ${prescriptionId} to ${pharmacyId}`);
    // For now, we'll just update the draft directly if it's not yet sent
    const { data, error } = await supabase
      .from('prescription_drafts')
      .update({ pharmacy_id: pharmacyId })
      .eq('id', prescriptionId)
      .in('status', ['DRAFT', 'PENDING_APPROVAL'])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Dashboard Lists
  async getPendingPrescriptions(prescriberId: string): Promise<PrescriptionDraft[]> {
    const { data, error } = await supabase
      .from('prescription_drafts')
      .select('*')
      .eq('prescriber_id', prescriberId)
      .in('status', ['DRAFT', 'PENDING_APPROVAL'])
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getPrescriberActiveMedications(prescriberId: string): Promise<any[]> {
    // Fetch active prescriptions written by this prescriber
    // querying clinical.prescriptions view (if exposed) or table
    // Assuming 'prescriptions' table exists in public or clinical schema
    const { data, error } = await supabase
      .from('prescriptions') // This should map to clinical.prescriptions via view or search_path
      .select('*, patient:profiles(full_name)')
      .eq('prescriber_id', prescriberId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback if table not found or error, return empty
      console.warn("Could not fetch active prescriptions:", error);
      return [];
    }
    return data || [];
  },
};

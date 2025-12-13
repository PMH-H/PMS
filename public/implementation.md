Prescriber Dashboard Implementation Plan
Goal
Implement a comprehensive Prescriber Dashboard for PharmAI that enables doctors and nurses to manage patient prescriptions with robust clinical safety tools. The dashboard will integrate patient context, a 3-step prescribing workflow, drug-drug interaction alerts, special population safety checks, and EPCS (Electronic Prescribing for Controlled Substances) compliance.

User Review Required
IMPORTANT

Facility Selection: Prescribers can optionally select a facility when prescribing, or remain facility-agnostic. Prescriptions are sent directly to the patient (via their preferred pharmacy), not tied to a specific facility inventory.

WARNING

EPCS Compliance: This implementation provides both PIN-based foundation for controlled substances AND integration points for certified EPCS providers. The PIN system handles basic workflow; production deployments should integrate with certified providers like DrFirst or Surescripts.

IMPORTANT

Drug Interaction Data: Safety checks use a hybrid approach: existing formulary data from clinical_interactions table + AI-powered analysis via Edge Functions. The AI layer enhances coverage for interactions not yet in the database and provides natural language explanations.

Proposed Changes
Database Schema
[NEW] Migration 046_prescriber_dashboard.sql
Creates 8 new tables to support the prescriber workflow:

1. prescriber_profiles - Extended prescriber credentials

Links to profiles table
Stores DEA number, NPI, license info
Optional facility associations (prescriber can select facility or remain open)
Prescriptions sent to patient, not facility-specific
2. patient_medications - Active/Inactive medication tracking

Replaces reliance on prescriptions table for ongoing meds
Tracks status (ACTIVE, INACTIVE, DISCONTINUED)
Links to clinical_drugs for monograph access
3. prescription_drafts - Pending prescriptions (Step 3 → Approval)

Stores prescriptions before final approval/transmission
Supports the "PENDING" list in the dashboard
Includes diagnosis codes (ICD/CDT) for controlled substances
4. pharmacies - Pharmacy directory

Name, address, phone, fax, NCPDP ID
Enables pharmacy search and selection
5. patient_preferred_pharmacies - Patient-pharmacy associations

Many-to-many relationship
Supports multiple preferred pharmacies per patient
6. rxchange_requests - Pharmacy change requests

Tracks requests to change pharmacy after prescription sent
Status: PENDING, APPROVED, REJECTED
7. refill_requests - Patient refill requests

Tracks patient-initiated refill requests
Status: PENDING, APPROVED, REJECTED
8. transmission_logs - eRx transmission tracking

Logs all prescription transmissions
Tracks status: SENDING, SENT, VERIFIED, FAILED
Stores error messages for failed transmissions
9. prescriber_pins - EPCS PIN management

Encrypted 4-digit PINs for controlled substance prescribing
Tracks PIN creation, last use, failed attempts
Auto-locks after 3 failed attempts
All tables include RLS policies for prescriber, pharmacist, and admin access.

TypeScript Types
[MODIFY] 
types.ts
Add new types and enums:

// Prescriber-specific types
export enum PrescriberRole {
  DOCTOR = 'doctor',
  NURSE = 'nurse',
  PHYSICIAN_ASSISTANT = 'physician_assistant'
}
export interface PrescriberProfile {
  id: string;
  user_id: string;
  prescriber_role: PrescriberRole;
  dea_number?: string;
  npi: string;
  license_number: string;
  license_state: string;
  organizations: string[]; // facility_ids
  created_at: string;
}
export interface PatientMedication {
  id: string;
  patient_id: string;
  drug_id: string; // links to clinical_drugs
  drug_name: string;
  dosage: string;
  frequency: string;
  route: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  start_date: string;
  end_date?: string;
  prescribed_by: string;
  notes?: string;
  created_at: string;
}
export interface PrescriptionDraft {
  id: string;
  patient_id: string;
  prescriber_id: string;
  drug_id: string;
  drug_name: string;
  strength: string;
  dosage_form: string;
  directions: string; // patient directions, max 1000 chars
  dispense_quantity: number;
  dispense_unit: string;
  refills: number;
  days_supply: number;
  effective_date: string;
  no_substitution: boolean;
  diagnosis_codes?: string[]; // ICD or CDT codes
  pharmacy_id?: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT';
  created_at: string;
}
export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  fax?: string;
  ncpdp_id?: string;
  created_at: string;
}
export interface TransmissionLog {
  id: string;
  prescription_id: string;
  pharmacy_id: string;
  status: 'SENDING' | 'SENT' | 'VERIFIED' | 'FAILED';
  error_message?: string;
  transmitted_at?: string;
  verified_at?: string;
  created_at: string;
}
export interface RefillRequest {
  id: string;
  patient_id: string;
  medication_id: string;
  requested_at: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by?: string;
  reviewed_at?: string;
  notes?: string;
}
Services
[NEW] services/prescriberService.ts
Core service layer for prescriber operations:

searchPatients(query: string) - Search patients by name
getPatientContext(patientId: string) - Load full patient context (demographics, allergies, meds, pharmacies)
getPatientMedications(patientId: string, status?: string) - Get active/inactive meds
searchDrugs(query: string, limit: number) - Autocomplete drug search
getDrugVariations(drugId: string) - Get strength/form variations
savePrescriptionDraft(draft: PrescriptionDraft) - Save to pending list
approvePrescription(draftId: string, pin?: string) - Approve and send (EPCS PIN for controlled)
deletePrescriptionDraft(draftId: string) - Remove from pending
reorderPrescription(medicationId: string) - Copy existing med to new draft
getFavorites(userId: string) - Get prescriber favorites
addFavorite(favorite: PrescriberFavorite) - Add to favorites
searchPharmacies(query: string) - Search pharmacies
changePharmacy(prescriptionId: string, pharmacyId: string) - Update pharmacy
[MODIFY] services/database.ts
Enhance checkInteractions function to include:

Critical drug-drug interactions (CRITICAL-INTRA)
Special population checks (geriatric, pediatric, pregnancy)
Mandatory monitoring alerts (hepatotoxic, neurotoxic, cytotoxic agents)
UI Components
[NEW] components/PrescriberDashboard.tsx
Main dashboard component with tab navigation:

Patient & Context View (default tab)
Pending Medications
Active Medications
Inactive Medications
Notifications
Props:

interface PrescriberDashboardProps {
  currentUser: User;
  prescriberProfile: PrescriberProfile;
}
[NEW] components/prescriber/PatientSearchPanel.tsx
Patient search and selection:

Autocomplete search input
Recently accessed patients list
Clinic switcher (for multi-org prescribers)
Selected patient context display
[NEW] components/prescriber/PatientContextView.tsx
Displays full patient context:

Demographics (name, DOB, gender, contact)
Allergies (reuses 
PatientAllergies
 component)
Active medications list
Inactive medications list
Preferred pharmacies
Eligibility information (if available)
Notifications area
[NEW] components/prescriber/PrescribingWorkflow.tsx
3-step prescription workflow:

Step 1: Drug Selection

Autocomplete search (≥3 characters)
"My Favorites" quick-select button
Diagnosis code entry (ICD/CDT) - mandatory for controlled substances
Step 2: Variations

Display legal variations (strength, form)
Select appropriate presentation
Step 3: Details

Effective Date (required for EPCS)
Patient Directions (1000 char limit)
Dispense Quantity & Unit
Refills
Days Supply (required for EPCS)
No Substitution toggle
Formulary information display
Pharmacy selector
Save to Pending / Approve & Send buttons
[NEW] components/prescriber/PendingMedicationsList.tsx
Displays pending prescriptions (drafts):

List view with drug name, dosage, patient
Actions: Edit, Change Pharmacy, Delete, Approve & Send, Approve & Print
EPCS PIN prompt for controlled substances
[NEW] components/prescriber/ActiveMedicationsList.tsx
Displays active medications with status tracking:

Simple / Detailed view toggle
Status badges: SENDING → eRx SENT → PHARMACY VERIFIED
Actions: View Details, View Monograph, Reorder, Remove, Print
Transmission status indicator
[NEW] components/prescriber/InactiveMedicationsList.tsx
Displays canceled, discontinued, completed medications:

Actions: Move to Active, Reorder
[NEW] components/prescriber/DrugInteractionAlerts.tsx
Enhanced safety alert display:

Critical Drug-Drug Interactions (color-coded by severity):

RED (CONTRAINDICATED): Opioids + CNS Depressants, Allopurinol + Thiopurines
ORANGE (SEVERE): QT-prolonging + Diuretics, Ergotamine + Beta-blockers
YELLOW (MODERATE): Antiepileptics interactions
Special Population Warnings:

Geriatric: Fall risk, cognitive impairment, dose adjustments
Pediatric: Weight-based dosing, contraindications
Pregnancy/Lactation: Absolute contraindications, risk/benefit documentation
Mandatory Monitoring:

Hepatotoxic agents: Liver function monitoring
Neurotoxic agents: Neuropathy assessment
Cytotoxics: Neutropenia monitoring, Filgrastim support
Vesicants: Intrathecal administration prevention
[NEW] components/prescriber/FavoritesManager.tsx
Manage prescriber favorites:

List of saved favorites
Add new favorite
Edit/Delete existing
Quick-select button (skips to Step 3)
[NEW] components/prescriber/PharmacySelector.tsx
Pharmacy search and selection:

Search pharmacies by name/location
Display patient's preferred pharmacies
Select pharmacy for prescription
[NEW] components/prescriber/EPCSPinDialog.tsx
EPCS PIN entry for controlled substances:

4-digit PIN input
Masked display
Validation
Lock after 3 failed attempts
PIN management link
[NEW] components/prescriber/NotificationPanel.tsx
Real-time notifications:

Transmission errors
Pending signatures
Refill requests
rxChange requests
System alerts
Edge Functions
[NEW] supabase/functions/prescriber-drug-search
Drug autocomplete search with fuzzy matching:

Searches clinical_drugs table
Returns name, ID, category, VEN class
Minimum 3 characters
[NEW] supabase/functions/prescriber-safety-check
Hybrid safety checking (Formulary + AI):

Phase 1: Query clinical_interactions table for known drug-drug interactions
Phase 2: If no database match, call Gemini AI with:
Medication list
Patient allergies
Patient age/pregnancy status
Request: Check for interactions, contraindications, special population warnings
Phase 3: Merge results from both sources
Checks patient allergies against all medications
Applies special population rules (age, pregnancy status)
Returns categorized alerts (CRITICAL, SEVERE, MODERATE) with sources ("Database" or "AI Analysis")
[NEW] supabase/functions/prescriber-send-rx
Prescription transmission with dual EPCS support:

Validates prescription data
For controlled substances:
Validates EPCS PIN (local foundation)
If EPCS provider configured: Calls provider API for certified transmission
If no provider: Uses PIN validation + local transmission log
Creates transmission log
Sends to patient's preferred pharmacy (not facility-specific)
Updates prescription status
Returns transmission confirmation
[NEW] supabase/functions/prescriber-manage-pin
EPCS PIN management:

Create/update PIN (encrypted with pgcrypto)
Validate PIN
Track failed attempts
Lock/unlock PIN
Audit log all PIN operations
Verification Plan
Automated Tests
Database Migration Validation

cd "C:\Mambwe Mwila\.Dev\pharmai"
supabase db reset
Expected: All migrations apply successfully, including 046_prescriber_dashboard.sql

TypeScript Compilation

npm run build
Expected: No TypeScript errors

Manual Verification
1. Database Schema Verification
Check tables created:

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'prescriber_profiles',
  'patient_medications',
  'prescription_drafts',
  'pharmacies',
  'patient_preferred_pharmacies',
  'rxchange_requests',
  'refill_requests',
  'transmission_logs',
  'prescriber_pins'
)
ORDER BY table_name;
Expected: All 9 tables listed

Check RLS policies:

SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'prescriber_%' 
OR tablename LIKE 'patient_medications' 
OR tablename LIKE 'prescription_drafts'
ORDER BY tablename, policyname;
Expected: At least 2-3 policies per table

2. Browser Testing - Prescriber Dashboard
Prerequisites:

Create a test prescriber user in Supabase:
-- Insert test prescriber profile
INSERT INTO profiles (id, email, full_name, role, facility_id)
VALUES (
  gen_random_uuid(),
  'dr.test@pharmai.com',
  'Dr. Test Prescriber',
  'pharmacist', -- will extend to 'prescriber' role
  (SELECT id FROM facilities LIMIT 1)
);
-- Insert prescriber profile
INSERT INTO prescriber_profiles (user_id, prescriber_role, npi, license_number, license_state)
VALUES (
  (SELECT id FROM profiles WHERE email = 'dr.test@pharmai.com'),
  'doctor',
  '1234567890',
  'MD12345',
  'ZM'
);
Create test patient with allergies and medications:
-- Insert test patient
INSERT INTO profiles (id, email, full_name, role)
VALUES (
  gen_random_uuid(),
  'patient.test@example.com',
  'Test Patient',
  'customer'
);
-- Add allergy
INSERT INTO patient_allergies (patient_id, allergen, severity)
VALUES (
  (SELECT id FROM profiles WHERE email = 'patient.test@example.com'),
  'Penicillin',
  'SEVERE'
);
Test Steps:

Login as Prescriber

Navigate to http://localhost:5173
Login with dr.test@pharmai.com
Expected: Redirected to Prescriber Dashboard
Patient Search

Click "Search Patients" input
Type "Test Patient"
Expected: Autocomplete shows "Test Patient"
Click patient name
Expected: Patient context loads with demographics, allergies
View Patient Allergies

In Patient Context View
Expected: "Penicillin - SEVERE" displayed in red alert box
Start Prescribing - Step 1

Click "Add Prescription" button
Type "Amox" in drug search (≥3 chars)
Expected: Autocomplete shows "Amoxicillin" options
Select "Amoxicillin"
Expected: Advance to Step 2
Step 2: Select Variation

Expected: List of strengths (250mg, 500mg, etc.)
Select "500mg Capsule"
Expected: Advance to Step 3
Step 3: Prescription Details

Fill in:
Effective Date: Today
Directions: "Take 1 capsule by mouth three times daily"
Dispense: 21 capsules
Refills: 0
Days Supply: 7
Expected: Formulary info displays (if available)
Click "Save to Pending"
Expected: Prescription appears in Pending Medications list
Drug Interaction Alert

Add another prescription: "Warfarin"
Expected: Alert displays "Amoxicillin + Warfarin: MODERATE - May increase INR"
Allergy Alert

Try to prescribe "Penicillin VK"
Expected: RED alert "Patient has SEVERE allergy to Penicillin"
Approve & Send Prescription

In Pending Medications list
Click "Approve & Send" on Amoxicillin prescription
Select pharmacy
Expected: Prescription moves to Active Medications
Expected: Status shows "SENDING" → "SENT"
Favorites

In Step 1, click "My Favorites"
Expected: Empty list (first time)
Complete a prescription
Click "Add to Favorites"
Name it "Amoxicillin 500mg x7 days"
Next time: Click "My Favorites" → Select favorite
Expected: Skips to Step 3 with pre-filled data
Notifications

Expected: Notification badge shows count
Click Notifications tab
Expected: List of transmission status, refill requests
Reorder Prescription

In Active Medications list
Click "Reorder" on existing medication
Expected: Creates new draft with same details
Expected: Draft appears in Pending list
EPCS PIN (if controlled substance)

Add controlled substance (e.g., "Morphine")
Click "Approve & Send"
Expected: PIN dialog appears
Enter 4-digit PIN
Expected: Prescription approved after PIN validation
3. Real-time Subscription Testing
Open Prescriber Dashboard in two browser windows (same prescriber)
In Window 1: Add prescription to Pending
Expected in Window 2: Pending list updates automatically
In Window 1: Approve prescription
Expected in Window 2: Prescription moves to Active list automatically
4. Multi-Organization Testing
Create prescriber with multiple facility associations
Login as prescriber
Expected: Clinic switcher dropdown visible
Switch clinic
Expected: Patient list filters to selected clinic
Security & Compliance Notes
All prescriber data access controlled via RLS
EPCS PINs encrypted at rest (use pgcrypto extension)
Audit logs created for all prescription actions
Transmission logs track all eRx sends
Failed PIN attempts tracked and auto-lock after 3 attempts
Next Steps After Approval
Create database migration 046_prescriber_dashboard.sql
Update 
types.ts
 with new interfaces
Implement prescriberService.ts
Build UI components (15+ components)
Create Edge Functions (4 functions)
Integrate dashboard into App.tsx
Test with manual verification steps
Deploy and monitor

export enum UserRole {
  CUSTOMER = 'customer',
  PHARMACIST = 'pharmacist',
  ADMIN = 'admin',
  SUPER_ADMIN_BMS = 'super_admin_bms',
  SUPER_ADMIN_DEV = 'super_admin_dev',
  WORKER = 'worker',        // Deprecated: treated as pharmacist
  CASHIER = 'cashier'       // Deprecated: treated as pharmacist
}

// Helper function to normalize roles (worker/cashier → pharmacist)
export function normalizeRole(role: UserRole): UserRole {
  if (role === UserRole.WORKER || role === UserRole.CASHIER) {
    return UserRole.PHARMACIST;
  }
  return role;
}

// Helper to check if role is staff (not customer)
export function isStaffRole(role: UserRole): boolean {
  return role !== UserRole.CUSTOMER;
}

// Helper to check if role has pharmacist-level permissions
export function hasPharmacistPermissions(role: UserRole): boolean {
  return [
    UserRole.PHARMACIST,
    UserRole.WORKER,
    UserRole.CASHIER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN_BMS,
    UserRole.SUPER_ADMIN_DEV
  ].includes(role);
}

// Helper to get user-friendly role display name
export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case UserRole.CUSTOMER: return 'Patient';
    case UserRole.PHARMACIST: return 'Pharmacist';
    case UserRole.WORKER: return 'Pharmacist (Worker)';
    case UserRole.CASHIER: return 'Pharmacist (Cashier)';
    case UserRole.ADMIN: return 'Shop Owner';
    case UserRole.SUPER_ADMIN_BMS: return 'BMS Administrator';
    case UserRole.SUPER_ADMIN_DEV: return 'System Administrator';
    default: return role;
  }
}

export enum InteractionLevel {
  HIGH = 'HIGH',
  MODERATE = 'MODERATE',
  LOW = 'LOW',
  NONE = 'NONE'
}

export enum PrescriptionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PICKED_UP = 'PICKED_UP'
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
}

export interface Prescription {
  id: string;
  patient_id: string;
  patientName?: string; // Derived from join with profiles
  status: PrescriptionStatus;
  image_url?: string;
  medications: Medication[];
  interactions?: InteractionAlert[];
  notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InteractionAlert {
  medicationA: string;
  medicationB: string;
  severity: InteractionLevel;
  description: string;
}

// --- PRIVACY SETTINGS ---
export interface PrivacySettings {
  shareBrowsing: boolean;
  sharePurchaseHistory: boolean;
  allowAI: boolean;
  anonymousMode: boolean;
  allowCamera?: boolean;
}

// --- NEW DISPENSARY MODELS ---

export interface Drug {
  id: string;
  sku: string;
  name: string;
  generic_name?: string;
  brand?: string;
  description?: string;
  dosage_form?: string; // e.g. Tablet, Syrup, Cream
  strength?: string;
  unit: string; // Matches DB column (renamed from default_unit)
  barcode?: string;
  front_image_url?: string; // Matches DB column
  back_image_url?: string; // Matches DB column
  category: 'A' | 'B' | 'C';
  ven_class?: 'V' | 'E' | 'N';
  min_level: number;
  max_level: number;
  safety_stock?: number;
  reorder_formula?: 'MIN_MAX' | 'LEAD_TIME' | 'CONSUMPTION' | 'EOQ' | 'EMERGENCY';
  lead_time_days?: number;
  created_at: string;
  price_cents?: number; // Added to match DB
  price_estimate?: number; // Deprecated, use price_cents / 100
  // Enhanced Medical Info for Customer UI
  active_ingredients?: string[];
  side_effects?: string[];
  usage_warning?: string;
  common_uses?: string[];
}

export interface DrugBatch {
  id: string;
  item_id: string; // Changed from drug_id to match DB
  facility_id: string; // Added required field from DB
  batch_no: string;
  expiry_date: string;
  manufacture_date?: string; // MFD
  received_quantity: number; // Changed from received_units to match DB
  current_quantity: number; // Changed from current_units to match DB
  cost_per_unit: number;
  created_at: string;
}

export type EntryMethod = 'SCAN' | 'MANUAL' | 'SEARCH';

export interface SaleItem {
  item_id: string; // Changed from drug_id to match DB
  batch_id?: string; // If null, auto-selected via FEFO
  quantity: number; // Changed from units to match DB
  unit_price: number;
  entry_method?: EntryMethod;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total_price: number;
  sold_by_user_id: string;
  customer_info?: string;
  created_at: string;
}

export interface InventoryAdjustment {
  id: string;
  batch_id: string; // Changed from drug_batch_id to match DB
  item_id: string; // Changed from drug_id to match DB
  quantity_change: number; // Changed from change_units to match DB
  reason: string;
  adjusted_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  new_data: any;
  previous_data?: any;
  user_id: string;
  created_at: string;
}

export interface SearchLog {
  id: string;
  term: string;
  category: 'PRODUCT' | 'SYMPTOM';
  timestamp: string;
  // No user ID to ensure privacy as per T&C
}

// --- BMS / SUPER ADMIN MODELS ---

export interface PharmacyNode {
  id: string;
  name: string;
  region: string;
  complianceScore: number; // 0-100
  dataSharingEnabled: boolean;
  lastAuditDate: string;
  status: 'ACTIVE' | 'FLAGGED' | 'OFFLINE';
}

export interface MarketTrend {
  id: string;
  category: string;
  region: string;
  demandIndex: number; // 0-100
  supplyIndex: number; // 0-100
  avgPrice: number;
  month: string;
}

export interface Prediction {
  id: string;
  type: 'DISEASE' | 'DRUG_DEMAND' | 'PRICE_SPIKE';
  title: string;
  probability: number; // 0-100
  description: string;
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  targetDate: string;
}

// --- DEV / ARCHITECT MODELS ---

export interface MetricConfig {
  id: string;
  category: 'SALES' | 'INVENTORY' | 'SYSTEM' | 'DEV';
  label: string;
  description: string;
  isEnabled: boolean;
  widgetType: 'CHART' | 'CARD' | 'LIST';
}

export interface SystemHealth {
  service: string;
  status: 'OK' | 'WARN' | 'CRIT';
  latency: number;
  uptime: number;
}

// --- LEGACY/COMPATIBILITY TYPES ---

export interface InventoryItem {
  id: string; // Maps to Drug ID
  name: string;
  currentStock: number; // Aggregated from batches
  unit: string;
  expirationDate: string; // Earliest batch expiry
  category: 'A' | 'B' | 'C';
  minLevel: number;
  maxLevel: number;
  leadTime: number;
  costPerUnit: number; // Weighted average or latest
  lastCountDate?: string;
}

export interface AILog {
  id: string;
  timestamp: string;
  action: string;
  model: string;
  status: 'SUCCESS' | 'ERROR';
  latencyMs: number;
  details?: string;
}

export interface User {
  id: string;
  email?: string;
  full_name: string;
  name?: string; // Alias for full_name
  phone?: string;
  role: UserRole;
  facility_id?: string;
  avatar?: string;
  privacySettings?: PrivacySettings;
  // Admin fields
  is_blocked?: boolean;
  blocked_reason?: string;
  blocked_at?: string;
  blocked_by?: string;
  last_active_at?: string;
  created_at?: string;
}

export interface Notification {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'STOCK_UPDATE' | 'PRESCRIPTION_STATUS' | 'GENERAL';
}

// =============================================
// ADMIN DASHBOARD TYPES
// =============================================

export type AuthEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'session_expired'
  | 'token_refresh'
  | 'mfa_enabled'
  | 'mfa_disabled';

export interface AuthEvent {
  id: string;
  user_id?: string;
  event_type: AuthEventType;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  failure_reason?: string;
  metadata?: Record<string, any>;
  created_at: string;
  // Joined data
  user?: { full_name: string; email?: string };
}

export type MetricCategory =
  | 'auth'
  | 'business'
  | 'performance'
  | 'security'
  | 'compliance'
  | 'system'
  | 'user'
  | 'ai';

export interface SystemMetric {
  id: string;
  metric_category: MetricCategory;
  metric_name: string;
  metric_value: number;
  metric_unit?: string;
  facility_id?: string;
  recorded_at: string;
}

export interface FeatureFlag {
  id: string;
  flag_name: string;
  flag_description?: string;
  is_enabled: boolean;
  applies_to_roles: string[];
  applies_to_facilities: string[];
  metadata?: Record<string, any>;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

export type SecurityEventType =
  | 'suspicious_activity'
  | 'blocked_ip'
  | 'permission_violation'
  | 'rate_limit_exceeded'
  | 'invalid_token'
  | 'brute_force_attempt'
  | 'unusual_location';

export interface SecurityEvent {
  id: string;
  event_type: SecurityEventType;
  user_id?: string;
  ip_address?: string;
  severity: SecuritySeverity;
  description?: string;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  // Joined data
  user?: { full_name: string; email?: string };
}

export interface AdminMetricsSummary {
  // User counts
  total_patients: number;
  total_pharmacists: number;
  total_admins: number;
  blocked_users: number;
  active_24h: number;
  active_7d: number;
  // Prescription counts
  prescriptions_24h: number;
  pending_prescriptions: number;
  approved_prescriptions: number;
  // Auth events
  logins_24h: number;
  failed_logins_24h: number;
  // Security
  unresolved_security_events: number;
  critical_security_events: number;
  // Facilities
  total_facilities: number;
}

// =============================================
// DOSESPOT COMPLIANCE MODELS
// =============================================

export interface PatientAllergy {
  id: string;
  patient_id: string;
  allergen: string;
  reaction?: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE';
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  created_by?: string;
}

export interface PrescriberFavorite {
  id: string;
  user_id: string;
  nickname: string;
  drug_name: string;
  dosage: string;
  frequency?: string;
  notes?: string;
}

// ==========================================
// CLINICAL DRUG DATABASE (ZEML)
// ==========================================

export interface ClinicalDrug {
  id: string;
  name: string;
  description?: string;
  mechanism_of_action?: string;
  storage_handling?: string;
  overdosage_management?: string;
  ven_category?: 'V' | 'E' | 'N';
  aware_category?: 'Access' | 'Watch' | 'Reserve';
  category_id?: string;

  // Rich Text Monograph Fields
  indications_text?: string;
  contraindications_text?: string;
  adverse_effects_text?: string;
  dosage_text?: string;
  geriatric_use_text?: string;
  pediatric_use_text?: string;
  pregnancy_use_text?: string;
  overdose_text?: string;
  storage_text?: string;

  // Joins
  category?: { name: string };
  presentations?: ClinicalPresentation[];
  indications?: ClinicalIndication[];
  contraindications?: ClinicalContraindication[];
  interactions?: ClinicalInteraction[];
}

export interface ClinicalPresentation {
  id: string;
  drug_id: string;
  form: string;
  strength: string;
  unit?: string;
  packaging?: string;
}

export interface ClinicalIndication {
  id: string;
  name: string;
  description?: string;
}

export interface ClinicalContraindication {
  id: string;
  name: string;
  description?: string;
}

export interface ClinicalInteraction {
  id: string;
  drug_id_1: string;
  drug_id_2: string | null;
  interacting_entity_name?: string; // For class/external interactions
  interaction_type?: string; // 'CRITICAL-INTRA', etc.
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'CONTRAINDICATED';
  description?: string;
  other_drug_name?: string; // Helper for UI
}

// ==========================================
// PRESCRIBER DASHBOARD MODELS
// ==========================================

export enum PrescriberRole {
  DOCTOR = 'doctor',
  NURSE = 'nurse',
  PHYSICIAN_ASSISTANT = 'physician_assistant'
}

export interface PrescriberProfile {
  id: string;
  user_id: string;
  prescriber_role: PrescriberRole;
  dea_number?: string; // For controlled substances
  npi: string; // National Provider Identifier
  license_number: string;
  license_state: string;
  facility_ids?: string[]; // Optional facility associations
  created_at: string;
  updated_at: string;
}

export type MedicationStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';

export interface PatientMedication {
  id: string;
  patient_id: string;
  drug_id?: string; // Links to clinical_drugs
  drug_name: string;
  dosage: string;
  frequency: string;
  route?: string; // e.g., "oral", "IV", "topical"
  status: MedicationStatus;
  start_date: string;
  end_date?: string;
  prescribed_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type PrescriptionDraftStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT';

export interface PrescriptionDraft {
  id: string;
  patient_id: string;
  prescriber_id: string;
  drug_id?: string;
  drug_name: string;
  strength: string;
  dosage_form: string; // e.g., "Tablet", "Capsule", "Syrup"
  directions: string; // Patient directions, max 1000 chars
  dispense_quantity: number;
  dispense_unit: string;
  refills: number;
  days_supply: number; // Required for EPCS
  effective_date: string; // Required for EPCS
  no_substitution: boolean;
  diagnosis_codes?: string[]; // ICD or CDT codes (mandatory for controlled substances)
  pharmacy_id?: string;
  facility_id?: string; // Optional: prescriber can select facility or leave null
  status: PrescriptionDraftStatus;
  is_controlled: boolean; // Requires EPCS PIN
  created_at: string;
  updated_at: string;
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
  ncpdp_id?: string; // National Council for Prescription Drug Programs ID
  created_at: string;
  updated_at: string;
}

export interface PatientPreferredPharmacy {
  id: string;
  patient_id: string;
  pharmacy_id: string;
  is_primary: boolean;
  created_at: string;
  // Joined data
  pharmacy?: Pharmacy;
}

export type TransmissionStatus = 'SENDING' | 'SENT' | 'VERIFIED' | 'FAILED';

export interface TransmissionLog {
  id: string;
  prescription_id: string;
  pharmacy_id: string;
  status: TransmissionStatus;
  error_message?: string;
  transmitted_at?: string;
  verified_at?: string;
  created_at: string;
  // Joined data
  pharmacy?: Pharmacy;
}

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RxChangeRequest {
  id: string;
  prescription_id: string;
  old_pharmacy_id?: string;
  new_pharmacy_id: string;
  requested_by: string;
  status: RequestStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  notes?: string;
  created_at: string;
  // Joined data
  old_pharmacy?: Pharmacy;
  new_pharmacy?: Pharmacy;
}

export interface RefillRequest {
  id: string;
  patient_id: string;
  medication_id: string;
  requested_at: string;
  status: RequestStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  notes?: string;
  // Joined data
  medication?: PatientMedication;
  patient?: { full_name: string };
}

export interface PrescriberPin {
  id: string;
  user_id: string;
  pin_hash: string; // Encrypted
  failed_attempts: number;
  is_locked: boolean;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

// Comprehensive patient context for prescribers
export interface PatientContext {
  patient: User;
  allergies: PatientAllergy[];
  active_medications: PatientMedication[];
  inactive_medications: PatientMedication[];
  preferred_pharmacies: PatientPreferredPharmacy[];
  recent_prescriptions: PrescriptionDraft[];
}

// Enhanced interaction alert with source
export interface EnhancedInteractionAlert extends InteractionAlert {
  source: 'Database' | 'AI Analysis';
  recommendation?: string;
}

// Special population warning
export interface SpecialPopulationWarning {
  population: 'Geriatric' | 'Pediatric' | 'Pregnancy' | 'Lactation';
  drug_name: string;
  severity: 'CAUTION' | 'WARNING' | 'CONTRAINDICATED';
  description: string;
  recommendation?: string;
}

// Mandatory monitoring alert
export interface MonitoringAlert {
  drug_name: string;
  monitoring_type: 'Hepatotoxic' | 'Neurotoxic' | 'Cytotoxic' | 'Vesicant' | 'Other';
  description: string;
  required_tests?: string[];
  frequency?: string;
}


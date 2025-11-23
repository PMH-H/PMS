
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  PHARMACIST = 'PHARMACIST',
  ADMIN = 'ADMIN',
  SUPER_ADMIN_BMS = 'SUPER_ADMIN_BMS',
  SUPER_ADMIN_DEV = 'SUPER_ADMIN_DEV',
  WORKER = 'WORKER',
  CASHIER = 'CASHIER'
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
  patientName: string;
  date: string;
  medications: Medication[];
  status: PrescriptionStatus;
  notes?: string;
  imageUrl?: string; // Base64 or URL
  interactions?: InteractionAlert[];
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
  barcode?: string;
  image_front?: string; // Base64 or URL
  image_back?: string; // Base64 or URL
  default_unit: string;
  category: 'A' | 'B' | 'C';
  min_level: number;
  max_level: number;
  created_at: string;
  // Enhanced Medical Info for Customer UI
  active_ingredients?: string[];
  side_effects?: string[];
  usage_warning?: string;
  common_uses?: string[];
  price_estimate?: number; // For display purposes
}

export interface DrugBatch {
  id: string;
  drug_id: string;
  batch_no: string;
  expiry_date: string;
  manufacture_date?: string; // MFD
  received_units: number;
  current_units: number;
  cost_per_unit: number;
  created_at: string;
}

export type EntryMethod = 'SCAN' | 'MANUAL' | 'SEARCH';

export interface SaleItem {
  drug_id: string;
  batch_id?: string; // If null, auto-selected via FEFO
  units: number;
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
  drug_batch_id: string;
  drug_id: string;
  change_units: number;
  reason: string;
  adjusted_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  resource_type: 'DRUG' | 'BATCH' | 'SALE' | 'ADJUSTMENT' | 'AUTH';
  resource_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SALE' | 'RECONCILE' | 'VOID';
  payload: any;
  performed_by: string;
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
  name: string;
  role: UserRole;
  avatar?: string;
  privacySettings?: PrivacySettings;
}

export interface Notification {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'STOCK_UPDATE' | 'PRESCRIPTION_STATUS' | 'GENERAL';
}

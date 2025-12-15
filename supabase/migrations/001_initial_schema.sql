-- =====================================================
-- PHARMAI INVENTORY MANAGEMENT SYSTEM - INITIAL SCHEMA
-- =====================================================
-- Multi-tenant, role-based, real-time inventory system
-- UUID PKs, RLS enabled, optimized indexes
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('CUSTOMER', 'PHARMACIST', 'WORKER', 'CASHIER', 'ADMIN', 'SUPER_ADMIN_BMS', 'SUPER_ADMIN_DEV');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE facility_type AS ENUM ('PHARMACY', 'DISPENSARY', 'WAREHOUSE', 'DISTRICT_OFFICE', 'REGIONAL_OFFICE', 'NATIONAL_OFFICE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE stock_movement_type AS ENUM ('IN', 'OUT', 'ADJUST_UP', 'ADJUST_DOWN', 'TRANSFER_IN', 'TRANSFER_OUT', 'EXPIRED', 'DAMAGED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reorder_formula_type AS ENUM ('MIN_MAX', 'LEAD_TIME', 'CONSUMPTION', 'EOQ', 'EMERGENCY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ven_class AS ENUM ('V', 'E', 'N');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE abc_class AS ENUM ('A', 'B', 'C');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE cycle_count_status AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE po_status AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_type AS ENUM ('LOW_STOCK', 'STOCKOUT', 'NEAR_EXPIRY', 'EXPIRED', 'OVERSTOCK', 'REORDER_NEEDED', 'ANOMALY', 'SYSTEM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- CORE TABLES
-- =====================================================

-- User Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'CUSTOMER',
  facility_id UUID, -- NULL for customers, set for staff
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Facilities (multi-level hierarchy)
CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type facility_type NOT NULL,
  parent_id UUID REFERENCES facilities(id), -- For hierarchy: pharmacy → district → region → national
  address TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items (Master drug/product catalog)
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  generic_name TEXT,
  brand TEXT,
  description TEXT,
  dosage_form TEXT, -- Tablet, Syrup, Injection, etc.
  strength TEXT,    -- e.g., "500mg", "10ml"
  unit TEXT NOT NULL, -- capsules, tablets, ml, etc.
  barcode TEXT UNIQUE,
  category abc_class DEFAULT 'C',
  ven_class ven_class DEFAULT 'N',
  min_level INTEGER DEFAULT 0,
  max_level INTEGER DEFAULT 0,
  safety_stock INTEGER DEFAULT 0,
  reorder_formula reorder_formula_type DEFAULT 'MIN_MAX',
  lead_time_days INTEGER DEFAULT 7,
  -- Enhanced medical info
  active_ingredients TEXT[],
  side_effects TEXT[],
  usage_warning TEXT,
  common_uses TEXT[],
  -- Images
  image_front_url TEXT,
  image_back_url TEXT,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Item Batches (tracks specific batches with expiry)
CREATE TABLE IF NOT EXISTS item_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  batch_no TEXT NOT NULL,
  manufacture_date DATE,
  expiry_date DATE NOT NULL,
  received_quantity INTEGER NOT NULL,
  current_quantity INTEGER NOT NULL,
  cost_per_unit DECIMAL(10,2) NOT NULL,
  supplier_id UUID, -- FK added later
  received_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, facility_id, batch_no)
);

-- Stock Movements (audit trail for all stock changes)
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES item_batches(id) ON DELETE SET NULL,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  movement_type stock_movement_type NOT NULL,
  quantity INTEGER NOT NULL, -- Positive for IN, negative for OUT
  unit_price DECIMAL(10,2),
  reason TEXT,
  reference_id UUID, -- Link to sale, PO, transfer, etc.
  performed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INVENTORY MANAGEMENT TABLES
-- =====================================================

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  lead_time_days INTEGER DEFAULT 7,
  reliability_score DECIMAL(3,2) DEFAULT 1.00, -- 0.00 to 1.00
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add supplier FK to item_batches
DO $$ BEGIN
  ALTER TABLE item_batches 
  ADD CONSTRAINT fk_supplier 
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number TEXT UNIQUE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  status po_status DEFAULT 'DRAFT',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  total_amount DECIMAL(12,2),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  quantity_ordered INTEGER NOT NULL,
  quantity_received INTEGER DEFAULT 0,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cycle Counts (physical inventory counts)
CREATE TABLE IF NOT EXISTS cycle_counts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  completed_date DATE,
  status cycle_count_status DEFAULT 'SCHEDULED',
  assigned_to UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cycle Count Results (item-level count results)
CREATE TABLE IF NOT EXISTS cycle_count_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_count_id UUID NOT NULL REFERENCES cycle_counts(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES item_batches(id) ON DELETE SET NULL,
  system_quantity INTEGER NOT NULL,
  counted_quantity INTEGER NOT NULL,
  variance INTEGER GENERATED ALWAYS AS (counted_quantity - system_quantity) STORED,
  variance_percentage DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ANALYTICS & REPORTING TABLES
-- =====================================================

-- Inventory Analytics (pre-calculated metrics)
CREATE TABLE IF NOT EXISTS inventory_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  turnover_rate DECIMAL(10,4),
  shrinkage_rate DECIMAL(5,2),
  service_level DECIMAL(5,2),
  stockout_days INTEGER DEFAULT 0,
  average_stock DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, facility_id, period_start, period_end)
);

-- Alerts (system-generated notifications)
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES item_batches(id) ON DELETE CASCADE,
  alert_type alert_type NOT NULL,
  severity INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high, 4=critical
  title TEXT NOT NULL,
  description TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor Performance (calculated supplier metrics)
CREATE TABLE IF NOT EXISTS vendor_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_orders INTEGER DEFAULT 0,
  on_time_deliveries INTEGER DEFAULT 0,
  late_deliveries INTEGER DEFAULT 0,
  average_delay_days DECIMAL(5,2),
  quality_score DECIMAL(3,2), -- 0.00 to 1.00
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, period_start, period_end)
);

-- =====================================================
-- AUDIT & SUPPORT TABLES
-- =====================================================

-- Audit Log (comprehensive audit trail)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE, CUSTOM
  previous_data JSONB,
  new_data JSONB,
  performed_by UUID REFERENCES profiles(id),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback (user feedback and bug reports)
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  category TEXT, -- bug, feature, improvement, other
  message TEXT NOT NULL,
  screenshot_url TEXT,
  status TEXT DEFAULT 'new', -- new, in_progress, resolved, closed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search Logs (anonymous search tracking for analytics)
CREATE TABLE IF NOT EXISTS search_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  term TEXT NOT NULL,
  category TEXT, -- PRODUCT, SYMPTOM, etc.
  result_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_facility ON profiles(facility_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Facilities
CREATE INDEX IF NOT EXISTS idx_facilities_parent ON facilities(parent_id);
CREATE INDEX IF NOT EXISTS idx_facilities_type ON facilities(type);

-- Items
CREATE INDEX IF NOT EXISTS idx_items_sku ON items(sku);
CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_name_gin ON items USING gin(to_tsvector('english', name || ' ' || COALESCE(generic_name, '')));

-- Item Batches
CREATE INDEX IF NOT EXISTS idx_batches_item ON item_batches(item_id);
CREATE INDEX IF NOT EXISTS idx_batches_facility ON item_batches(facility_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON item_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_supplier ON item_batches(supplier_id);

-- Stock Movements
CREATE INDEX IF NOT EXISTS idx_movements_item ON stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_movements_facility ON stock_movements(facility_id);
CREATE INDEX IF NOT EXISTS idx_movements_batch ON stock_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_created ON stock_movements(created_at DESC);

-- Purchase Orders
CREATE INDEX IF NOT EXISTS idx_po_facility ON purchase_orders(facility_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_date ON purchase_orders(order_date DESC);

-- Cycle Counts
CREATE INDEX IF NOT EXISTS idx_cycle_facility ON cycle_counts(facility_id);
CREATE INDEX IF NOT EXISTS idx_cycle_status ON cycle_counts(status);
CREATE INDEX IF NOT EXISTS idx_cycle_assigned ON cycle_counts(assigned_to);

-- Alerts
CREATE INDEX IF NOT EXISTS idx_alerts_facility ON alerts(facility_id);
CREATE INDEX IF NOT EXISTS idx_alerts_item ON alerts(item_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);

-- Audit Log
CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_facilities_updated_at BEFORE UPDATE ON facilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_item_batches_updated_at BEFORE UPDATE ON item_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_cycle_counts_updated_at BEFORE UPDATE ON cycle_counts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE profiles IS 'User profiles extending Supabase auth with role and facility assignment';
COMMENT ON TABLE facilities IS 'Multi-level facility hierarchy: pharmacy → district → region → national';
COMMENT ON TABLE items IS 'Master catalog of drugs and products';
COMMENT ON TABLE item_batches IS 'Batch-level inventory tracking with expiry dates';
COMMENT ON TABLE stock_movements IS 'Comprehensive audit trail of all stock changes';
COMMENT ON TABLE suppliers IS 'Supplier/vendor master data';
COMMENT ON TABLE purchase_orders IS 'Purchase order headers';
COMMENT ON TABLE purchase_order_items IS 'Line items for purchase orders';
COMMENT ON TABLE cycle_counts IS 'Physical inventory count schedules';
COMMENT ON TABLE cycle_count_results IS 'Item-level count results with variance tracking';
COMMENT ON TABLE inventory_analytics IS 'Pre-calculated inventory KPIs for reporting';
COMMENT ON TABLE alerts IS 'System-generated alerts and notifications';
COMMENT ON TABLE vendor_performance IS 'Supplier performance metrics';
COMMENT ON TABLE audit_log IS 'Comprehensive audit trail for compliance';
COMMENT ON TABLE feedback IS 'User feedback and bug reports';
COMMENT ON TABLE search_logs IS 'Anonymous search analytics';

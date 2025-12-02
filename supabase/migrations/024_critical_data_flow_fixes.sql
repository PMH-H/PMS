-- =====================================================
-- CRITICAL DATA FLOW FIXES - PHASE 1
-- =====================================================
-- Migration: 024_critical_data_flow_fixes.sql
-- Purpose: Add automatic stock movements on sales, FEFO logic, and new tables

-- =====================================================
-- 1. CUSTOMER ORDERS TABLE (for delivery tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, preparing, ready, picked_up, delivered, cancelled
  delivery_address TEXT,
  delivery_notes TEXT,
  expected_delivery_date TIMESTAMPTZ,
  actual_delivery_date TIMESTAMPTZ,
  assigned_to UUID REFERENCES profiles(id), -- pharmacist/delivery person
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_customer_orders_patient ON customer_orders(patient_id);
CREATE INDEX idx_customer_orders_facility ON customer_orders(facility_id);
CREATE INDEX idx_customer_orders_status ON customer_orders(status);
CREATE INDEX idx_customer_orders_assigned ON customer_orders(assigned_to);

-- Updated_at trigger
CREATE TRIGGER update_customer_orders_updated_at BEFORE UPDATE ON customer_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;

-- Patients can only see their own orders
CREATE POLICY customer_orders_patient_select ON customer_orders
  FOR SELECT USING (
    auth.uid() = patient_id
  );

-- Staff can see orders for their facility
CREATE POLICY customer_orders_staff_select ON customer_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.facility_id = customer_orders.facility_id
      AND profiles.role IN ('pharmacist', 'admin', 'cashier', 'worker')
    )
  );

-- Staff can insert/update orders for their facility
CREATE POLICY customer_orders_staff_insert ON customer_orders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.facility_id = customer_orders.facility_id
      AND profiles.role IN ('pharmacist', 'admin', 'cashier', 'worker')
    )
  );

CREATE POLICY customer_orders_staff_update ON customer_orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.facility_id = customer_orders.facility_id
      AND profiles.role IN ('pharmacist', 'admin', 'cashier', 'worker')
    )
  );

-- =====================================================
-- 2. PROMOTIONS TABLE (for discounts)
-- =====================================================
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  discount_percentage DECIMAL(5,2) CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  discount_amount DECIMAL(10,2), -- Fixed amount discount
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  applicable_item_ids UUID[], -- array of item IDs, NULL = all items
  facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
  minimum_purchase_amount DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_discount CHECK (
    (discount_percentage IS NOT NULL AND discount_amount IS NULL) OR
    (discount_percentage IS NULL AND discount_amount IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_promotions_facility ON promotions(facility_id);
CREATE INDEX idx_promotions_active ON promotions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_promotions_dates ON promotions(start_date, end_date);

-- Updated_at trigger
CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON promotions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can see active promotions
CREATE POLICY promotions_public_select ON promotions
  FOR SELECT USING (
    is_active = TRUE AND CURRENT_DATE BETWEEN start_date AND end_date
  );

-- Only staff can manage promotions
CREATE POLICY promotions_staff_all ON promotions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.facility_id = promotions.facility_id OR promotions.facility_id IS NULL)
      AND profiles.role IN ('admin', 'super_admin_bms', 'super_admin_dev')
    )
  );

-- =====================================================
-- 3. FUNCTION: FEFO Batch Selection
-- =====================================================
-- Purpose: Select the oldest (First Expired, First Out) batch with sufficient quantity
CREATE OR REPLACE FUNCTION select_fefo_batch(
  p_item_id UUID,
  p_facility_id UUID,
  p_quantity INTEGER
) RETURNS TABLE (
  batch_id UUID,
  allocated_quantity INTEGER
) AS $$
DECLARE
  v_batch RECORD;
  v_remaining INTEGER := p_quantity;
BEGIN
  -- Loop through batches ordered by expiry date (FEFO)
  FOR v_batch IN
    SELECT id, current_quantity, expiry_date
    FROM item_batches
    WHERE item_id = p_item_id
      AND facility_id = p_facility_id
      AND current_quantity > 0
      AND expiry_date > CURRENT_DATE -- don't use expired batches
    ORDER BY expiry_date ASC, created_at ASC
  LOOP
    IF v_remaining <= 0 THEN
      EXIT;
    END IF;
    
    IF v_batch.current_quantity >= v_remaining THEN
      -- This batch can fulfill the remaining quantity
      batch_id := v_batch.id;
      allocated_quantity := v_remaining;
      v_remaining := 0;
      RETURN NEXT;
    ELSE
      -- Use entire batch and continue
      batch_id := v_batch.id;
      allocated_quantity := v_batch.current_quantity;
      v_remaining := v_remaining - v_batch.current_quantity;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  -- If we exit with remaining quantity, there's insufficient stock
  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Insufficient stock for item %. Required: %, Available: %',
      p_item_id, p_quantity, p_quantity - v_remaining;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. FUNCTION: Process Sale Stock Update (FEFO)
-- =====================================================
CREATE OR REPLACE FUNCTION process_sale_stock_update()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_batch_allocation RECORD;
  v_facility_id UUID;
BEGIN
  -- Get facility_id from the sale
  v_facility_id := NEW.facility_id;
  
  -- For each item in the sale
  FOR v_item IN SELECT * FROM jsonb_to_recordset(NEW.items) AS x(
    item_id UUID,
    quantity INTEGER,
    unit_price DECIMAL,
    batch_id UUID,
    entry_method TEXT
  ) LOOP
    
    -- If batch_id was specified (manual selection), use it
    IF v_item.batch_id IS NOT NULL THEN
      -- Direct batch allocation
      INSERT INTO stock_movements (
        item_id,
        batch_id,
        facility_id,
        movement_type,
        quantity,
        unit_price,
        reason,
        reference_id,
        performed_by
      ) VALUES (
        v_item.item_id,
        v_item.batch_id,
        v_facility_id,
        'OUT',
        -v_item.quantity, -- negative for OUT
        v_item.unit_price,
        'Sale transaction',
        NEW.id,
        NEW.sold_by_user_id
      );
      
      -- Update batch quantity
      UPDATE item_batches
      SET current_quantity = current_quantity - v_item.quantity
      WHERE id = v_item.batch_id;
      
    ELSE
      -- Use FEFO logic to allocate batches
      FOR v_batch_allocation IN
        SELECT * FROM select_fefo_batch(v_item.item_id, v_facility_id, v_item.quantity)
      LOOP
        -- Create stock movement for this batch allocation
        INSERT INTO stock_movements (
          item_id,
          batch_id,
          facility_id,
          movement_type,
          quantity,
          unit_price,
          reason,
          reference_id,
          performed_by
        ) VALUES (
          v_item.item_id,
          v_batch_allocation.batch_id,
          v_facility_id,
          'OUT',
          -v_batch_allocation.allocated_quantity,
          v_item.unit_price,
          'Sale transaction (FEFO)',
          NEW.id,
          NEW.sold_by_user_id
        );
        
        -- Update batch quantity
        UPDATE item_batches
        SET current_quantity = current_quantity - v_batch_allocation.allocated_quantity
        WHERE id = v_batch_allocation.batch_id;
      END LOOP;
    END IF;
    
    -- Check if we need to create low stock alert
    PERFORM check_and_create_stock_alert(v_item.item_id, v_facility_id);
    
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic stock update on sale
DROP TRIGGER IF EXISTS after_sale_insert ON sales;
CREATE TRIGGER after_sale_insert
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION process_sale_stock_update();

-- =====================================================
-- 5. FUNCTION: Check and Create Stock Alert
-- =====================================================
CREATE OR REPLACE FUNCTION check_and_create_stock_alert(
  p_item_id UUID,
  p_facility_id UUID
) RETURNS VOID AS $$
DECLARE
  v_item RECORD;
  v_total_stock INTEGER;
  v_existing_alert UUID;
BEGIN
  -- Get item details
  SELECT * INTO v_item FROM items WHERE id = p_item_id;
  
  -- Calculate total stock for this item at this facility
  SELECT COALESCE(SUM(current_quantity), 0) INTO v_total_stock
  FROM item_batches
  WHERE item_id = p_item_id AND facility_id = p_facility_id;
  
  -- Check if alert already exists and is unresolved
  SELECT id INTO v_existing_alert
  FROM alerts
  WHERE item_id = p_item_id
    AND facility_id = p_facility_id
    AND alert_type IN ('LOW_STOCK', 'STOCKOUT', 'REORDER_NEEDED')
    AND is_resolved = FALSE
  LIMIT 1;
  
  -- If total stock is 0, create STOCKOUT alert
  IF v_total_stock = 0 THEN
    IF v_existing_alert IS NULL THEN
      INSERT INTO alerts (
        facility_id,
        item_id,
        alert_type,
        severity,
        title,
        description
      ) VALUES (
        p_facility_id,
        p_item_id,
        'STOCKOUT',
        4, -- critical
        'Stock Out: ' || v_item.name,
        'Item is completely out of stock. Immediate reorder required.'
      );
    END IF;
  -- If stock is below min level, create LOW_STOCK or REORDER_NEEDED alert
  ELSIF v_total_stock <= v_item.min_level THEN
    IF v_existing_alert IS NULL THEN
      INSERT INTO alerts (
        facility_id,
        item_id,
        alert_type,
        severity,
        title,
        description
      ) VALUES (
        p_facility_id,
        p_item_id,
        'REORDER_NEEDED',
        3, -- high
        'Reorder Needed: ' || v_item.name,
        format('Stock level (%s) is at or below minimum level (%s).', v_total_stock, v_item.min_level)
      );
    END IF;
  -- If stock is above min level and alert exists, resolve it
  ELSIF v_total_stock > v_item.min_level AND v_existing_alert IS NOT NULL THEN
    UPDATE alerts
    SET is_resolved = TRUE,
        resolved_at = NOW()
    WHERE id = v_existing_alert;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. AUDIT LOGGING TRIGGERS FOR NEW TABLES
-- =====================================================

-- Function to log changes to audit_log
CREATE OR REPLACE FUNCTION log_table_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_log (table_name, record_id, action, previous_data, performed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_log (table_name, record_id, action, previous_data, new_data, performed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data, performed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add audit triggers to new tables
CREATE TRIGGER audit_customer_orders
  AFTER INSERT OR UPDATE OR DELETE ON customer_orders
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER audit_promotions
  AFTER INSERT OR UPDATE OR DELETE ON promotions
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Add audit triggers to existing critical tables (if not already present)
DROP TRIGGER IF EXISTS audit_sales ON sales;
CREATE TRIGGER audit_sales
  AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

DROP TRIGGER IF EXISTS audit_item_batches ON item_batches;
CREATE TRIGGER audit_item_batches
  AFTER INSERT OR UPDATE OR DELETE ON item_batches
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

DROP TRIGGER IF EXISTS audit_prescriptions ON prescriptions;
CREATE TRIGGER audit_prescriptions
  AFTER INSERT OR UPDATE OR DELETE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE customer_orders IS 'Customer order tracking for delivery and fulfillment';
COMMENT ON TABLE promotions IS 'Promotional discounts and offers';
COMMENT ON FUNCTION select_fefo_batch IS 'FEFO (First Expired, First Out) batch selection for stock allocation';
COMMENT ON FUNCTION process_sale_stock_update IS 'Automatically creates stock movements and updates batches when a sale is made';
COMMENT ON FUNCTION check_and_create_stock_alert IS 'Checks stock levels and creates/resolves alerts as needed';
COMMENT ON FUNCTION log_table_changes IS 'Logs all INSERT/UPDATE/DELETE operations to audit_log table';

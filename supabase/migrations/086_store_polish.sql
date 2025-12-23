-- 086_store_polish.sql
-- Refactor Sales Logic to be Schema-Aware (Inventory/Commerce)
-- Ensures FEFO and Stock Deduction works correctly after Zoning

-- 1. Update Helper: FEFO Batch Selection
CREATE OR REPLACE FUNCTION public.select_fefo_batch(
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
  -- Loop through batches from INVENTORY schema
  FOR v_batch IN
    SELECT id, current_quantity, expiry_date
    FROM inventory.item_batches
    WHERE item_id = p_item_id
      AND facility_id = p_facility_id
      AND current_quantity > 0
      AND expiry_date > CURRENT_DATE
    ORDER BY expiry_date ASC, created_at ASC
  LOOP
    IF v_remaining <= 0 THEN
      EXIT;
    END IF;
    
    IF v_batch.current_quantity >= v_remaining THEN
      batch_id := v_batch.id;
      allocated_quantity := v_remaining;
      v_remaining := 0;
      RETURN NEXT;
    ELSE
      batch_id := v_batch.id;
      allocated_quantity := v_batch.current_quantity;
      v_remaining := v_remaining - v_batch.current_quantity;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Insufficient stock for item %. Required: %, Available: %',
      p_item_id, p_quantity, p_quantity - v_remaining;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, inventory, commerce;

-- 2. Update Helper: Stock Alerts
CREATE OR REPLACE FUNCTION public.check_and_create_stock_alert(
  p_item_id UUID,
  p_facility_id UUID
) RETURNS VOID AS $$
DECLARE
  v_item RECORD;
  v_total_stock INTEGER;
  v_existing_alert UUID;
BEGIN
  SELECT * INTO v_item FROM inventory.items WHERE id = p_item_id;
  
  SELECT COALESCE(SUM(current_quantity), 0) INTO v_total_stock
  FROM inventory.item_batches
  WHERE item_id = p_item_id AND facility_id = p_facility_id;
  
  SELECT id INTO v_existing_alert
  FROM inventory.alerts
  WHERE item_id = p_item_id
    AND facility_id = p_facility_id
    AND alert_type IN ('LOW_STOCK', 'STOCKOUT', 'REORDER_NEEDED')
    AND is_resolved = FALSE
  LIMIT 1;
  
  IF v_total_stock = 0 THEN
    IF v_existing_alert IS NULL THEN
      INSERT INTO inventory.alerts (facility_id, item_id, alert_type, severity, title, description)
      VALUES (p_facility_id, p_item_id, 'STOCKOUT', 4, 'Stock Out: ' || v_item.name, 'Item is completely out of stock.');
    END IF;
  ELSIF v_total_stock <= v_item.min_level THEN
    IF v_existing_alert IS NULL THEN
         INSERT INTO inventory.alerts (facility_id, item_id, alert_type, severity, title, description)
         VALUES (p_facility_id, p_item_id, 'REORDER_NEEDED', 3, 'Reorder Needed: ' || v_item.name, 
         format('Stock level (%s) is at or below minimum level (%s).', v_total_stock, v_item.min_level));
    END IF;
  ELSIF v_total_stock > v_item.min_level AND v_existing_alert IS NOT NULL THEN
    UPDATE inventory.alerts
    SET is_resolved = TRUE, resolved_at = NOW()
    WHERE id = v_existing_alert;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, inventory;

-- 3. Update Main Trigger Function: Sales Stock Update
CREATE OR REPLACE FUNCTION public.process_sale_stock_update()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_batch_allocation RECORD;
  v_facility_id UUID;
BEGIN
  v_facility_id := NEW.facility_id;
  
  FOR v_item IN SELECT * FROM jsonb_to_recordset(NEW.items) AS x(
    item_id UUID, quantity INTEGER, unit_price DECIMAL, batch_id UUID
  ) LOOP
    
    IF v_item.batch_id IS NOT NULL THEN
      -- Direct batch
      INSERT INTO inventory.stock_movements (
        item_id, batch_id, facility_id, movement_type, quantity, unit_price, reason, reference_id, performed_by
      ) VALUES (
        v_item.item_id, v_item.batch_id, v_facility_id, 'OUT', -v_item.quantity, v_item.unit_price, 'Sale transaction', NEW.id, NEW.sold_by_user_id
      );
      
      UPDATE inventory.item_batches
      SET current_quantity = current_quantity - v_item.quantity
      WHERE id = v_item.batch_id;
      
    ELSE
      -- FEFO
      FOR v_batch_allocation IN
        SELECT * FROM public.select_fefo_batch(v_item.item_id, v_facility_id, v_item.quantity)
      LOOP
        INSERT INTO inventory.stock_movements (
          item_id, batch_id, facility_id, movement_type, quantity, unit_price, reason, reference_id, performed_by
        ) VALUES (
          v_item.item_id, v_batch_allocation.batch_id, v_facility_id, 'OUT', -v_batch_allocation.allocated_quantity, v_item.unit_price, 'Sale transaction (FEFO)', NEW.id, NEW.sold_by_user_id
        );
        
        UPDATE inventory.item_batches
        SET current_quantity = current_quantity - v_batch_allocation.allocated_quantity
        WHERE id = v_batch_allocation.batch_id;
      END LOOP;
    END IF;
    
    PERFORM public.check_and_create_stock_alert(v_item.item_id, v_facility_id);
    
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, inventory, commerce;

-- 4. Re-attach Trigger to COMMERCE.SALES (Physical Table)
-- Note: Trigger likely moved with table, but we ensure it relies on the updated function.
-- Drop and recreate to be sure.
DROP TRIGGER IF EXISTS after_sale_insert ON commerce.sales;
CREATE TRIGGER after_sale_insert
  AFTER INSERT ON commerce.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.process_sale_stock_update();

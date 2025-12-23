-- 084_schema_zoning_inventory.sql
-- Phase 11 Part 2: Inventory Zoning
-- Move Items, Batches, Movements to "inventory" schema
-- Maintain Public Interface via Views + Triggers

-- 1. Create Schema
CREATE SCHEMA IF NOT EXISTS inventory;
GRANT USAGE ON SCHEMA inventory TO postgres, authenticated, service_role;

-- 2. Move Tables
-- Note: items is referenced by almost everything. Moving it is safe via standard Postgres ALTER SET SCHEMA, 
-- but we must ensure we don't break the world.
ALTER TABLE public.items SET SCHEMA inventory;
ALTER TABLE public.item_batches SET SCHEMA inventory;
ALTER TABLE public.stock_movements SET SCHEMA inventory;
ALTER TABLE public.suppliers SET SCHEMA inventory;
-- Note: 'alerts', 'purchase_orders', 'cycle_counts', 'inventory_analytics', 'vendor_performance', 'search_logs'
-- are also inventory related. Ideally move them too.
-- Let's move ALL related tables to keep it clean.
ALTER TABLE public.alerts SET SCHEMA inventory;
ALTER TABLE public.purchase_orders SET SCHEMA inventory;
ALTER TABLE public.purchase_order_items SET SCHEMA inventory;
ALTER TABLE public.cycle_counts SET SCHEMA inventory;
ALTER TABLE public.cycle_count_results SET SCHEMA inventory;
ALTER TABLE public.inventory_analytics SET SCHEMA inventory;
ALTER TABLE public.vendor_performance SET SCHEMA inventory;

-- 3. Create Interface Views in Public
-- We only need views for tables accessed frequently by the frontend code (as it stands).
-- Likely: items, item_batches, stock_movements, suppliers, purchase_orders, alerts.

CREATE OR REPLACE VIEW public.items AS SELECT * FROM inventory.items;
CREATE OR REPLACE VIEW public.item_batches AS SELECT * FROM inventory.item_batches;
CREATE OR REPLACE VIEW public.stock_movements AS SELECT * FROM inventory.stock_movements;
CREATE OR REPLACE VIEW public.suppliers AS SELECT * FROM inventory.suppliers;
CREATE OR REPLACE VIEW public.alerts AS SELECT * FROM inventory.alerts;

-- 4. Create INSTEAD OF Triggers
-- Crucial for: items, item_batches, stock_movements. 
-- Suppliers/Alerts are less critical for writes usually, but let's add them for completeness.

-- A. Items Triggers
CREATE OR REPLACE FUNCTION public.io_items() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
         -- Explicitly listing columns to ensure complex types (Arrays, Enums) pass correctly
        INSERT INTO inventory.items (
            id, sku, name, generic_name, brand, description, dosage_form, strength, unit, barcode, 
            category, ven_class, min_level, max_level, safety_stock, reorder_formula, lead_time_days,
            active_ingredients, side_effects, usage_warning, common_uses, image_front_url, image_back_url,
            created_at, updated_at, is_global, facility_id
        )
        VALUES (
            COALESCE(NEW.id, gen_random_uuid()), NEW.sku, NEW.name, NEW.generic_name, NEW.brand, NEW.description, NEW.dosage_form, NEW.strength, NEW.unit, NEW.barcode,
            NEW.category, NEW.ven_class, NEW.min_level, NEW.max_level, NEW.safety_stock, NEW.reorder_formula, NEW.lead_time_days,
            NEW.active_ingredients, NEW.side_effects, NEW.usage_warning, NEW.common_uses, NEW.image_front_url, NEW.image_back_url,
            COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()), COALESCE(NEW.is_global, TRUE), NEW.facility_id
        )
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE inventory.items SET
            sku = NEW.sku, name = NEW.name, generic_name = NEW.generic_name, brand = NEW.brand, description = NEW.description,
            dosage_form = NEW.dosage_form, strength = NEW.strength, unit = NEW.unit, barcode = NEW.barcode,
            category = NEW.category, ven_class = NEW.ven_class, min_level = NEW.min_level, max_level = NEW.max_level,
            safety_stock = NEW.safety_stock, reorder_formula = NEW.reorder_formula, lead_time_days = NEW.lead_time_days,
            active_ingredients = NEW.active_ingredients, side_effects = NEW.side_effects, usage_warning = NEW.usage_warning,
            common_uses = NEW.common_uses, image_front_url = NEW.image_front_url, image_back_url = NEW.image_back_url,
            updated_at = now(), is_global = NEW.is_global, facility_id = NEW.facility_id
        WHERE id = OLD.id
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM inventory.items WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER io_items_trigger
    INSTEAD OF INSERT OR UPDATE OR DELETE ON public.items
    FOR EACH ROW EXECUTE FUNCTION public.io_items();

-- B. Item Batches Triggers
CREATE OR REPLACE FUNCTION public.io_item_batches() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO inventory.item_batches (
            id, item_id, facility_id, batch_no, manufacture_date, expiry_date, received_quantity, 
            current_quantity, cost_per_unit, supplier_id, received_date, created_at, updated_at
        )
        VALUES (
            COALESCE(NEW.id, gen_random_uuid()), NEW.item_id, NEW.facility_id, NEW.batch_no, NEW.manufacture_date, NEW.expiry_date, NEW.received_quantity,
            NEW.current_quantity, NEW.cost_per_unit, NEW.supplier_id, COALESCE(NEW.received_date, now()), COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now())
        )
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE inventory.item_batches SET
            batch_no = NEW.batch_no,
            manufacture_date = NEW.manufacture_date,
            expiry_date = NEW.expiry_date,
            received_quantity = NEW.received_quantity,
            current_quantity = NEW.current_quantity,
            cost_per_unit = NEW.cost_per_unit,
            supplier_id = NEW.supplier_id,
            updated_at = now()
        WHERE id = OLD.id
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM inventory.item_batches WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER io_item_batches_trigger
    INSTEAD OF INSERT OR UPDATE OR DELETE ON public.item_batches
    FOR EACH ROW EXECUTE FUNCTION public.io_item_batches();

-- C. Stock Movements Triggers
CREATE OR REPLACE FUNCTION public.io_stock_movements() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO inventory.stock_movements (
            id, item_id, batch_id, facility_id, movement_type, quantity, unit_price, reason, reference_id, performed_by, created_at
        )
        VALUES (
            COALESCE(NEW.id, gen_random_uuid()), NEW.item_id, NEW.batch_id, NEW.facility_id, NEW.movement_type, NEW.quantity, NEW.unit_price, NEW.reason, NEW.reference_id, NEW.performed_by, COALESCE(NEW.created_at, now())
        )
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Usually movements are immutable logs, but for completeness:
        UPDATE inventory.stock_movements SET
            movement_type = NEW.movement_type,
            quantity = NEW.quantity,
            reason = NEW.reason,
            reference_id = NEW.reference_id,
            performed_by = NEW.performed_by
        WHERE id = OLD.id
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM inventory.stock_movements WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER io_stock_movements_trigger
    INSTEAD OF INSERT OR UPDATE OR DELETE ON public.stock_movements
    FOR EACH ROW EXECUTE FUNCTION public.io_stock_movements();

-- 5. Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;

-- 6. Enable RLS on New Schema Tables
ALTER TABLE inventory.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.item_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.suppliers ENABLE ROW LEVEL SECURITY;

-- 7. Policy Check (Ensure existence)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'inventory' AND tablename = 'items') THEN
        -- Basic policy: authenticated can view
        CREATE POLICY "Authenticated view items" ON inventory.items FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

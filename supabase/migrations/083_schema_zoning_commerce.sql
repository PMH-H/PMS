-- 083_schema_zoning_commerce.sql
-- Phase 11: Commerce Zoning
-- Move Sales, Store Orders, Store Products to "commerce" schema
-- Maintain Public Interface via Views + Triggers

-- 1. Create Schema
CREATE SCHEMA IF NOT EXISTS commerce;
GRANT USAGE ON SCHEMA commerce TO postgres, authenticated, service_role;

-- 2. Move Tables
ALTER TABLE public.sales SET SCHEMA commerce;
ALTER TABLE public.store_orders SET SCHEMA commerce;
ALTER TABLE public.store_products SET SCHEMA commerce;

-- 3. Create Interface Views in Public

-- Sales View
CREATE OR REPLACE VIEW public.sales AS SELECT * FROM commerce.sales;

-- Store Orders View
CREATE OR REPLACE VIEW public.store_orders AS SELECT * FROM commerce.store_orders;

-- Store Products View
CREATE OR REPLACE VIEW public.store_products AS SELECT * FROM commerce.store_products;

-- 4. Create INSTEAD OF Triggers

-- A. Sales Triggers
CREATE OR REPLACE FUNCTION public.io_sales() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO commerce.sales (id, facility_id, items, total_price, customer_info, sold_by_user_id, payment_method, created_at, updated_at)
        VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.facility_id, NEW.items, NEW.total_price, NEW.customer_info, NEW.sold_by_user_id, NEW.payment_method, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()))
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE commerce.sales SET
            items = NEW.items,
            total_price = NEW.total_price,
            customer_info = NEW.customer_info,
            payment_method = NEW.payment_method,
            updated_at = now()
        WHERE id = OLD.id
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM commerce.sales WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER io_sales_trigger
    INSTEAD OF INSERT OR UPDATE OR DELETE ON public.sales
    FOR EACH ROW EXECUTE FUNCTION public.io_sales();

-- B. Store Orders Triggers
CREATE OR REPLACE FUNCTION public.io_store_orders() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO commerce.store_orders (id, customer_id, facility_id, items, total_price_cents, status, delivery_type, notes, created_at, updated_at, delivery_address, delivery_notes, expected_delivery_at, actual_delivery_at, assigned_to)
        VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.customer_id, NEW.facility_id, NEW.items, NEW.total_price_cents, NEW.status, NEW.delivery_type, NEW.notes, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()), NEW.delivery_address, NEW.delivery_notes, NEW.expected_delivery_at, NEW.actual_delivery_at, NEW.assigned_to)
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE commerce.store_orders SET
            items = NEW.items,
            total_price_cents = NEW.total_price_cents,
            status = NEW.status,
            delivery_type = NEW.delivery_type,
            notes = NEW.notes,
            delivery_address = NEW.delivery_address,
            delivery_notes = NEW.delivery_notes,
            expected_delivery_at = NEW.expected_delivery_at,
            actual_delivery_at = NEW.actual_delivery_at,
            assigned_to = NEW.assigned_to,
            updated_at = now()
        WHERE id = OLD.id
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM commerce.store_orders WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER io_store_orders_trigger
    INSTEAD OF INSERT OR UPDATE OR DELETE ON public.store_orders
    FOR EACH ROW EXECUTE FUNCTION public.io_store_orders();

-- C. Store Products Triggers
CREATE OR REPLACE FUNCTION public.io_store_products() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO commerce.store_products (id, facility_id, name, description, category, sku, price_cents, stock_quantity, reorder_level, supplier_id, image_url, is_active, tags, created_at, updated_at, created_by)
        VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.facility_id, NEW.name, NEW.description, NEW.category, NEW.sku, NEW.price_cents, NEW.stock_quantity, NEW.reorder_level, NEW.supplier_id, NEW.image_url, NEW.is_active, NEW.tags, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()), NEW.created_by)
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE commerce.store_products SET
            name = NEW.name,
            description = NEW.description,
            category = NEW.category,
            sku = NEW.sku,
            price_cents = NEW.price_cents,
            stock_quantity = NEW.stock_quantity,
            reorder_level = NEW.reorder_level,
            supplier_id = NEW.supplier_id,
            image_url = NEW.image_url,
            is_active = NEW.is_active,
            tags = NEW.tags,
            updated_at = now()
        WHERE id = OLD.id
        RETURNING * INTO NEW;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM commerce.store_products WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER io_store_products_trigger
    INSTEAD OF INSERT OR UPDATE OR DELETE ON public.store_products
    FOR EACH ROW EXECUTE FUNCTION public.io_store_products();

-- 5. Enable RLS on New Schema Tables
ALTER TABLE commerce.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce.store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce.store_products ENABLE ROW LEVEL SECURITY;

-- 6. Grant Permissions on Views
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_products TO authenticated;

-- 7. Ensure RLS Policies (Idempotent check)
DO $$
BEGIN
    -- Just ensures one policy exists as a check
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'commerce' AND tablename = 'sales') THEN
        -- Re-create the facility insert policy if missing
        CREATE POLICY "Users can insert sales at their facility" ON commerce.sales
            FOR INSERT WITH CHECK (
                facility_id IN (SELECT facility_id FROM public.profiles WHERE id = auth.uid())
            );
    END IF;
END $$;

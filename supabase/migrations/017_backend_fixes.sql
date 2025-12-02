-- Migration: 017_backend_fixes.sql
-- Description: Adds metric_events triggers, create_sale_atomic RPC, and audit_logs.

-- 1. Create audit_logs table if not exists
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID,
    action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_data JSONB,
    new_data JSONB,
    performed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin_bms', 'super_admin_dev')
        )
    );

-- 2. Create trigger function for audit logs
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, performed_by)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD) END, -- For UPDATE, store old data
        auth.uid()
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Apply audit trigger to sensitive tables
DROP TRIGGER IF EXISTS audit_sales_trigger ON public.sales;
CREATE TRIGGER audit_sales_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.sales
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Note: inventory_items table doesn't exist in current schema
-- DROP TRIGGER IF EXISTS audit_inventory_trigger ON public.inventory_items;
-- CREATE TRIGGER audit_inventory_trigger
--     AFTER INSERT OR UPDATE OR DELETE ON public.inventory_items
--     FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 4. Create metric_events triggers
-- Function to log metric event
CREATE OR REPLACE FUNCTION log_metric_event()
RETURNS TRIGGER AS $$
DECLARE
    payload JSONB;
    event_name TEXT;
BEGIN
    IF TG_TABLE_NAME = 'sales' THEN
        event_name := 'SALE_CREATED';
        payload := jsonb_build_object('sale_id', NEW.id, 'total', NEW.total_price, 'facility_id', NEW.facility_id);
    ELSIF TG_TABLE_NAME = 'inventory_adjustments' THEN
        event_name := 'INVENTORY_ADJUSTED';
        payload := jsonb_build_object('adjustment_id', NEW.id, 'item_id', NEW.item_id, 'quantity', NEW.quantity_change);
    ELSIF TG_TABLE_NAME = 'articles' THEN
        event_name := 'ARTICLE_PUBLISHED';
        payload := jsonb_build_object('article_id', NEW.id, 'title', NEW.title);
    END IF;

    IF event_name IS NOT NULL THEN
        INSERT INTO public.metric_events (name, payload, user_id)
        VALUES (event_name, payload, auth.uid());
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply metric triggers
DROP TRIGGER IF EXISTS metric_sales_trigger ON public.sales;
CREATE TRIGGER metric_sales_trigger
    AFTER INSERT ON public.sales
    FOR EACH ROW EXECUTE FUNCTION log_metric_event();

DROP TRIGGER IF EXISTS metric_articles_trigger ON public.articles;
CREATE TRIGGER metric_articles_trigger
    AFTER INSERT ON public.articles
    FOR EACH ROW EXECUTE FUNCTION log_metric_event();

-- 5. Create create_sale_atomic RPC
CREATE OR REPLACE FUNCTION create_sale_atomic(
    p_facility_id UUID,
    p_items JSONB, -- Array of {item_id, quantity, price}
    p_total_price NUMERIC,
    p_customer_info TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'CASH'
)
RETURNS JSONB AS $$
DECLARE
    v_sale_id UUID;
    v_item JSONB;
    v_item_id UUID;
    v_qty NUMERIC;
    v_current_stock NUMERIC;
BEGIN
    -- 1. Validate stock first (Locking)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := (v_item->>'item_id')::UUID;
        v_qty := (v_item->>'quantity')::NUMERIC;

        SELECT current_quantity INTO v_current_stock
        FROM public.inventory_items
        WHERE id = v_item_id AND facility_id = p_facility_id
        FOR UPDATE; -- Lock the row

        IF v_current_stock IS NULL OR v_current_stock < v_qty THEN
            RAISE EXCEPTION 'Insufficient stock for item %', v_item_id;
        END IF;
    END LOOP;

    -- 2. Create Sale Record
    INSERT INTO public.sales (facility_id, items, total_price, customer_info, sold_by_user_id, payment_method)
    VALUES (p_facility_id, p_items, p_total_price, p_customer_info, auth.uid(), p_payment_method)
    RETURNING id INTO v_sale_id;

    -- 3. Deduct Stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := (v_item->>'item_id')::UUID;
        v_qty := (v_item->>'quantity')::NUMERIC;

        UPDATE public.inventory_items
        SET current_quantity = current_quantity - v_qty,
            updated_at = NOW()
        WHERE id = v_item_id;
        
        -- Optional: Log adjustment if needed, but sale record might be enough
    END LOOP;

    RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

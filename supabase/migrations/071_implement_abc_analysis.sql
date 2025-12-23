-- Migration 071: Implement Automated ABC Analysis
-- Calculates inventory classification based on value (Cost * Quantity) or Usage.
-- For this MVP, we use (Cost * Quantity) as "Current Inventory Value".

-- 1. Create a function to recalculate ABC categories for a facility
CREATE OR REPLACE FUNCTION recalculate_abc_classes(p_facility_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_value NUMERIC;
    v_running_value NUMERIC := 0;
    r RECORD;
BEGIN
    -- Calculate total inventory value for the facility
    SELECT SUM(current_quantity * cost_per_unit) INTO v_total_value
    FROM item_batches
    WHERE facility_id = p_facility_id AND current_quantity > 0;

    -- Avoid division by zero
    IF v_total_value IS NULL OR v_total_value = 0 THEN
        RETURN;
    END IF;

    -- Iterate through items ordered by value (highest first)
    FOR r IN (
        SELECT id, (current_quantity * cost_per_unit) as item_value
        FROM item_batches
        WHERE facility_id = p_facility_id AND current_quantity > 0
        ORDER BY item_value DESC
    ) LOOP
        v_running_value := v_running_value + r.item_value;
        
        -- Determine Class based on cumulative percentage
        -- A: Top 70-80% of value (conventionally ~20% of items)
        -- B: Next 15-25% of value
        -- C: Bottom 5-10% of value
        -- Simplified for this MVP: 
        -- A = Cumulative value <= 70%
        -- B = Cumulative value <= 90%
        -- C = Remainder
        
        IF (v_running_value / v_total_value) <= 0.70 THEN
            UPDATE items SET category = 'A' WHERE id = (SELECT item_id FROM item_batches WHERE id = r.id);
        ELSIF (v_running_value / v_total_value) <= 0.90 THEN
            UPDATE items SET category = 'B' WHERE id = (SELECT item_id FROM item_batches WHERE id = r.id);
        ELSE
            UPDATE items SET category = 'C' WHERE id = (SELECT item_id FROM item_batches WHERE id = r.id);
        END IF; 
        -- Note: The schema links 'category' to 'items', but 'batches' hold the stock. 
        -- This logic assumes we update the PARENT item based on its batch value. 
        -- If an item has multiple batches, this loop might overwrite. 
        -- Better approach: Calculate Item Level Total Value first.
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Improved Function: Calculate at Item Level
CREATE OR REPLACE FUNCTION recalculate_abc_item_level(p_facility_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_value NUMERIC;
    v_running_value NUMERIC := 0;
    r RECORD;
BEGIN
    -- 1. Calculate Facility Total Value
    SELECT SUM(ib.current_quantity * ib.cost_per_unit) INTO v_total_value
    FROM item_batches ib
    WHERE ib.facility_id = p_facility_id;

    IF v_total_value IS NULL OR v_total_value = 0 THEN RETURN; END IF;

    -- 2. Iterate items aggregated by value
    FOR r IN (
        SELECT i.id, SUM(ib.current_quantity * ib.cost_per_unit) as total_item_value
        FROM items i
        JOIN item_batches ib ON i.id = ib.item_id
        WHERE ib.facility_id = p_facility_id
        GROUP BY i.id
        ORDER BY total_item_value DESC
    ) LOOP
        v_running_value := v_running_value + r.total_item_value;
        
        IF (v_running_value / v_total_value) <= 0.70 THEN
             UPDATE items SET category = 'A' WHERE id = r.id;
        ELSIF (v_running_value / v_total_value) <= 0.90 THEN
             UPDATE items SET category = 'B' WHERE id = r.id;
        ELSE
             UPDATE items SET category = 'C' WHERE id = r.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger to auto-update on significant inventory changes (Optional, or scheduled)
-- For now, we expose it as an RPC for the "AI Optimize" button.

GRANT EXECUTE ON FUNCTION recalculate_abc_item_level(UUID) TO authenticated;

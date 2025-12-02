// Additional types for new features added in Phase 1 implementation

export interface CustomerOrder {
    id: string;
    patient_id: string;
    prescription_id?: string;
    sale_id?: string;
    facility_id: string;
    status: 'pending' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'cancelled';
    delivery_address?: string;
    delivery_notes?: string;
    expected_delivery_date?: string;
    actual_delivery_date?: string;
    assigned_to?: string;
    created_at: string;
    updated_at: string;
}

export interface Promotion {
    id: string;
    name: string;
    description?: string;
    discount_percentage?: number;
    discount_amount?: number;
    start_date: string;
    end_date: string;
    applicable_item_ids?: string[];
    facility_id?: string;
    minimum_purchase_amount?: number;
    is_active: boolean;
    created_by?: string;
    created_at: string;
    updated_at: string;
}

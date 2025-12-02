import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';

interface Promotion {
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
}

interface PromotionManagerProps {
    currentUser: User;
    facilityId?: string;
}

const PromotionManager: React.FC<PromotionManagerProps> = ({ currentUser, facilityId }) => {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
    const [formData, setFormData] = useState<Partial<Promotion>>({
        name: '',
        description: '',
        discount_percentage: 0,
        discount_amount: undefined,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        is_active: true
    });
    const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage');

    useEffect(() => {
        fetchPromotions();
    }, [facilityId]);

    const fetchPromotions = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('promotions')
                .select('*')
                .order('created_at', { ascending: false });

            if (facilityId) {
                query = query.eq('facility_id', facilityId);
            }

            const { data, error } = await query;
            if (error) throw error;
            setPromotions(data || []);
        } catch (error) {
            console.error('Error fetching promotions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const promotionData = {
                ...formData,
                facility_id: facilityId,
                created_by: currentUser.id,
                discount_percentage: discountType === 'percentage' ? formData.discount_percentage : null,
                discount_amount: discountType === 'amount' ? formData.discount_amount : null
            };

            if (editingPromotion) {
                const { error } = await supabase
                    .from('promotions')
                    .update(promotionData)
                    .eq('id', editingPromotion.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('promotions')
                    .insert([promotionData]);
                if (error) throw error;
            }

            setShowModal(false);
            setEditingPromotion(null);
            setFormData({
                name: '',
                description: '',
                discount_percentage: 0,
                start_date: new Date().toISOString().split('T')[0],
                end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                is_active: true
            });
            fetchPromotions();
        } catch (error) {
            console.error('Error saving promotion:', error);
            alert('Failed to save promotion');
        }
    };

    const togglePromotionStatus = async (promotion: Promotion) => {
        try {
            const { error } = await supabase
                .from('promotions')
                .update({ is_active: !promotion.is_active })
                .eq('id', promotion.id);

            if (error) throw error;
            fetchPromotions();
        } catch (error) {
            console.error('Error toggling promotion:', error);
        }
    };

    const deletePromotion = async (id: string) => {
        if (!confirm('Are you sure you want to delete this promotion?')) return;

        try {
            const { error } = await supabase
                .from('promotions')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchPromotions();
        } catch (error) {
            console.error('Error deleting promotion:', error);
        }
    };

    const openEditModal = (promotion: Promotion) => {
        setEditingPromotion(promotion);
        setDiscountType(promotion.discount_percentage ? 'percentage' : 'amount');
        setFormData({
            name: promotion.name,
            description: promotion.description,
            discount_percentage: promotion.discount_percentage || 0,
            discount_amount: promotion.discount_amount || 0,
            start_date: promotion.start_date,
            end_date: promotion.end_date,
            minimum_purchase_amount: promotion.minimum_purchase_amount,
            is_active: promotion.is_active
        });
        setShowModal(true);
    };

    const isPromotionActive = (promotion: Promotion) => {
        if (!promotion.is_active) return false;
        const now = new Date();
        const start = new Date(promotion.start_date);
        const end = new Date(promotion.end_date);
        return now >= start && now <= end;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Promotions & Discounts</h2>
                    <p className="text-sm text-gray-500">Manage promotional offers</p>
                </div>
                <button
                    onClick={() => {
                        setEditingPromotion(null);
                        setShowModal(true);
                    }}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Promotion
                </button>
            </div>

            {/* Promotions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {promotions.map(promotion => (
                    <div
                        key={promotion.id}
                        className={`bg-white p-6 rounded-xl border-2 ${isPromotionActive(promotion)
                                ? 'border-green-400 shadow-lg'
                                : 'border-gray-200'
                            }`}
                    >
                        {/* Status indicator */}
                        <div className="flex justify-between items-start mb-4">
                            <span
                                className={`px-3 py-1 rounded-full text-xs font-bold ${isPromotionActive(promotion)
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                            >
                                {isPromotionActive(promotion) ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => togglePromotionStatus(promotion)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    {promotion.is_active ? '⏸' : '▶️'}
                                </button>
                            </div>
                        </div>

                        {/* Promotion details */}
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{promotion.name}</h3>
                        {promotion.description && (
                            <p className="text-sm text-gray-600 mb-4">{promotion.description}</p>
                        )}

                        {/* Discount value */}
                        <div className="bg-indigo-50 p-4 rounded-lg mb-4 text-center">
                            <p className="text-3xl font-bold text-indigo-700">
                                {promotion.discount_percentage
                                    ? `${promotion.discount_percentage}% OFF`
                                    : `ZMW ${promotion.discount_amount} OFF`}
                            </p>
                        </div>

                        {/* Date range */}
                        <div className="text-sm text-gray-500 mb-4">
                            <p>
                                <span className="font-bold">Start:</span> {new Date(promotion.start_date).toLocaleDateString()}
                            </p>
                            <p>
                                <span className="font-bold">End:</span> {new Date(promotion.end_date).toLocaleDateString()}
                            </p>
                        </div>

                        {/* Minimum purchase */}
                        {promotion.minimum_purchase_amount && (
                            <p className="text-xs text-gray-500 mb-4">
                                Min. purchase: ZMW {promotion.minimum_purchase_amount}
                            </p>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => openEditModal(promotion)}
                                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200"
                            >
                                Edit
                            </button>
                            <button
                                onClick={() => deletePromotion(promotion.id)}
                                className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-200"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {promotions.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                    <p className="text-gray-500 mb-4">No promotions yet</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="text-indigo-600 font-bold hover:text-indigo-700"
                    >
                        Create your first promotion
                    </button>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div
                    className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-2xl font-bold text-gray-900 mb-6">
                            {editingPromotion ? 'Edit Promotion' : 'New Promotion'}
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Promotion Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="e.g., Summer Sale 2024"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    rows={3}
                                    placeholder="Optional description"
                                />
                            </div>

                            {/* Discount Type */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Discount Type</label>
                                    <select
                                        value={discountType}
                                        onChange={e => setDiscountType(e.target.value as 'percentage' | 'amount')}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="percentage">Percentage</option>
                                        <option value="amount">Fixed Amount</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        {discountType === 'percentage' ? 'Discount %' : 'Discount Amount (ZMW)'}
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        max={discountType === 'percentage' ? 100 : undefined}
                                        step={discountType === 'percentage' ? 1 : 0.01}
                                        value={discountType === 'percentage' ? formData.discount_percentage : formData.discount_amount}
                                        onChange={e =>
                                            setFormData({
                                                ...formData,
                                                [discountType === 'percentage' ? 'discount_percentage' : 'discount_amount']: parseFloat(
                                                    e.target.value
                                                )
                                            })
                                        }
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Start Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">End Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.end_date}
                                        onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Minimum Purchase */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Minimum Purchase Amount (Optional)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.minimum_purchase_amount || ''}
                                    onChange={e =>
                                        setFormData({ ...formData, minimum_purchase_amount: parseFloat(e.target.value) || undefined })
                                    }
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="e.g., 50.00"
                                />
                            </div>

                            {/* Active checkbox */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                                    Activate promotion immediately
                                </label>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
                                >
                                    {editingPromotion ? 'Save Changes' : 'Create Promotion'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PromotionManager;

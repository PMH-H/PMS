
import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { checkoutService, OrderDetails } from '../services/checkoutService';
import { User } from '../types';
import { X, MapPin, Loader2, CheckCircle, Truck, Package } from 'lucide-react';

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, currentUser }) => {
    const { cart, cartTotal, clearCart } = useShop();

    const [step, setStep] = useState<'DETAILS' | 'CONFIRM' | 'SUCCESS'>('DETAILS');
    const [deliveryType, setDeliveryType] = useState<'PICKUP' | 'DELIVERY'>('DELIVERY');
    const [address, setAddress] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);

        try {
            const order: OrderDetails = {
                customer_id: currentUser.id,
                facility_id: currentUser.facility_id || cart[0]?.facility_id || '', // Fallback or need strict check
                items: cart,
                total_price_cents: cartTotal,
                delivery_type: deliveryType,
                delivery_address: deliveryType === 'DELIVERY' ? address : undefined,
                delivery_notes: deliveryType === 'DELIVERY' ? notes : undefined,
                notes: deliveryType === 'PICKUP' ? notes : undefined
            };

            await checkoutService.submitOrder(order);
            clearCart();
            setStep('SUCCESS');
        } catch (err: any) {
            setError(err.message || 'Failed to place order');
        } finally {
            setLoading(false);
        }
    };

    if (step === 'SUCCESS') {
        return (
            <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Confirmed!</h2>
                    <p className="text-gray-500 mb-6">Your order has been placed successfully. You can track its status in the "My Orders" tab.</p>
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-4">
                <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-gray-900">Checkout</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    {/* Delivery Type Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setDeliveryType('DELIVERY')}
                            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${deliveryType === 'DELIVERY'
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold ring-2 ring-indigo-600 ring-offset-1'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                }`}
                        >
                            <Truck size={24} />
                            <span>Home Delivery</span>
                        </button>
                        <button
                            onClick={() => setDeliveryType('PICKUP')}
                            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${deliveryType === 'PICKUP'
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold ring-2 ring-indigo-600 ring-offset-1'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                }`}
                        >
                            <Package size={24} />
                            <span>Store Pickup</span>
                        </button>
                    </div>

                    {/* Delivery Details */}
                    {deliveryType === 'DELIVERY' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Delivery Address</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 text-gray-400" size={18} />
                                    <textarea
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        placeholder="Enter your full delivery address..."
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Order Summary */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">Order Summary</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Subtotal ({cart.length} items)</span>
                                <span className="font-medium">ZMW {cartTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Delivery Fee</span>
                                <span className="font-medium text-emerald-600">
                                    {deliveryType === 'DELIVERY' ? 'ZMW 50.00 (Est.)' : 'Free'}
                                </span>
                            </div>
                            <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-bold text-lg text-gray-900">
                                <span>Total to Pay</span>
                                <span>ZMW {(cartTotal + (deliveryType === 'DELIVERY' ? 50 : 0)).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={loading || (deliveryType === 'DELIVERY' && !address.trim())}
                        className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <><Loader2 className="animate-spin" /> Processing...</>
                        ) : (
                            <>Confirm Order</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

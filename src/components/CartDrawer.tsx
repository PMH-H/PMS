import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { ShoppingCart, X, Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { CheckoutModal } from './CheckoutModal';
import { User } from '../types';
import { toast } from 'sonner';

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, currentUser }) => {
    const { cart, removeFromCart, updateQuantity, clearCart, cartTotal, itemCount } = useShop();
    const [showCheckout, setShowCheckout] = useState(false);

    if (!isOpen) return null;

    const handleRemoveItem = (itemId: string, itemName: string) => {
        removeFromCart(itemId);
        toast.success(`${itemName} removed from cart`);
    };

    const handleClearCart = () => {
        clearCart();
        toast.success('Cart cleared');
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Cart Panel */}
            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-[70] transform transition-transform duration-300 animate-in slide-in-from-right flex flex-col">

                {/* Header */}
                <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-full">
                            <ShoppingCart size={22} />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg">Your Cart</h2>
                            <p className="text-sm opacity-80">{itemCount} {itemCount === 1 ? 'item' : 'items'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        aria-label="Close cart"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4 py-12">
                            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
                                <ShoppingBag size={48} className="opacity-30" />
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-medium text-gray-500">Your cart is empty</p>
                                <p className="text-sm text-gray-400 mt-1">Add items from the shop to get started</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 transition-colors"
                            >
                                Continue Shopping
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Clear All Button */}
                            {cart.length > 1 && (
                                <button
                                    onClick={handleClearCart}
                                    className="w-full py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={14} />
                                    Clear All Items
                                </button>
                            )}

                            {cart.map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 transition-all hover:shadow-md"
                                >
                                    <div className="flex gap-4">
                                        {/* Product Image/Icon */}
                                        <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <span className="text-3xl">💊</span>
                                        </div>

                                        {/* Product Details */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-900 text-sm line-clamp-2 leading-tight">
                                                {item.name}
                                            </h4>
                                            <p className="text-indigo-600 font-bold mt-1">
                                                ZMW {(item.price_cents || 0).toFixed(2)}
                                            </p>

                                            {/* Quantity Controls */}
                                            <div className="flex items-center justify-between mt-3">
                                                <div className="flex items-center bg-gray-100 rounded-full overflow-hidden">
                                                    <button
                                                        onClick={() => updateQuantity(item.id, -1)}
                                                        className="w-9 h-9 flex items-center justify-center hover:bg-gray-200 transition-colors text-gray-600"
                                                        aria-label="Decrease quantity"
                                                    >
                                                        <Minus size={16} strokeWidth={2.5} />
                                                    </button>
                                                    <span className="w-10 text-center font-bold text-gray-900">
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, 1)}
                                                        className="w-9 h-9 flex items-center justify-center hover:bg-gray-200 transition-colors text-gray-600"
                                                        aria-label="Increase quantity"
                                                    >
                                                        <Plus size={16} strokeWidth={2.5} />
                                                    </button>
                                                </div>

                                                {/* Remove Button */}
                                                <button
                                                    onClick={() => handleRemoveItem(item.id, item.name)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                    aria-label="Remove item"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Item Subtotal */}
                                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Subtotal</span>
                                        <span className="font-bold text-gray-900">
                                            ZMW {((item.price_cents || 0) * item.quantity).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* Footer - Only show when cart has items */}
                {cart.length > 0 && (
                    <div className="bg-white border-t border-gray-200 p-5 space-y-4 shadow-lg">
                        {/* Totals */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>Subtotal ({itemCount} items)</span>
                                <span className="text-gray-900 font-medium">ZMW {cartTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>Delivery</span>
                                <span className="text-emerald-600 font-medium">Calculated at checkout</span>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                                <span className="text-lg font-bold text-gray-900">Total</span>
                                <span className="text-2xl font-bold text-indigo-600">
                                    ZMW {cartTotal.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {/* Checkout Button */}
                        <button
                            onClick={() => {
                                setShowCheckout(true);
                            }}
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold text-lg hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
                        >
                            <ShoppingBag size={22} />
                            Checkout
                            <ArrowRight size={20} />
                        </button>

                        {/* Continue Shopping Link */}
                        <button
                            onClick={onClose}
                            className="w-full py-2 text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
                        >
                            ← Continue Shopping
                        </button>
                    </div>
                )}
            </div>

            {/* Checkout Modal */}
            {showCheckout && (
                <CheckoutModal
                    isOpen={showCheckout}
                    onClose={() => setShowCheckout(false)}
                    currentUser={currentUser}
                />
            )}
        </>
    );
};

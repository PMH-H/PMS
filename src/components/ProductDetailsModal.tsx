
import React, { useState } from 'react';
import { Drug } from '../types';
import { useShop } from '../context/ShopContext';
import { X, ShoppingCart, Plus, Minus } from 'lucide-react';

interface ProductDetailsModalProps {
    product: Drug;
    onClose: () => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({ product, onClose }) => {
    const { addToCart } = useShop();
    const [quantity, setQuantity] = useState(1);

    const handleAddToCart = () => {
        for (let i = 0; i < quantity; i++) {
            addToCart(product);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                <div className="relative h-64 bg-gray-100 flex items-center justify-center">
                    {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-8xl">💊</span>
                    )}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 bg-white/80 p-2 rounded-full hover:bg-white transition-colors"
                    >
                        <X size={24} className="text-gray-600" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded">
                                {product.category || 'OTC Medicine'}
                            </span>
                            <h2 className="text-2xl font-bold text-gray-900 mt-2">{product.name}</h2>
                            <p className="text-sm text-gray-500">{product.manufacturer || 'Generic'}</p>
                        </div>
                        <div className="text-right">
                            {(product.price_cents || 0) > 0 ? (
                                <>
                                    <p className="text-2xl font-bold text-emerald-600">
                                        ZMW {(product.price_cents || 0).toFixed(2)}
                                    </p>
                                    <p className="text-xs text-gray-500">Per unit</p>
                                </>
                            ) : (
                                <p className="text-lg font-medium text-amber-600">Contact for price</p>
                            )}
                        </div>
                    </div>

                    <p className="text-gray-600 leading-relaxed mb-6">
                        {product.description || 'No detailed description available for this product.'}
                    </p>

                    <div className="flex items-center gap-6 p-4 bg-gray-50 rounded-xl mb-6">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-100"
                            >
                                <Minus size={16} />
                            </button>
                            <span className="font-bold text-lg w-8 text-center">{quantity}</span>
                            <button
                                onClick={() => setQuantity(quantity + 1)}
                                className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-100"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                        <button
                            onClick={handleAddToCart}
                            className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <ShoppingCart size={20} />
                            {(product.price_cents || 0) > 0
                                ? `Add to Cart - ZMW ${((product.price_cents || 0) * quantity).toFixed(2)}`
                                : 'Add to Cart'
                            }
                        </button>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                        <h4 className="font-bold text-sm text-gray-900 mb-2">Product Details</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">SKU:</span>
                                <span className="ml-2 text-gray-900 font-medium">{product.id.slice(0, 8)}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Stock Status:</span>
                                <span className="ml-2 text-emerald-600 font-medium">In Stock</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

import { useState, useMemo } from 'react';
import { ProductDetailsModal } from './ProductDetailsModal';
import { useShop } from '../context/ShopContext';
import type { Drug } from '../types';

interface ProductCatalogProps {
  inventory: Drug[];
}

const CATEGORIES = [
  { id: 'ALL', label: 'All Products', icon: '🏪' },
  { id: 'OTC', label: 'Over the Counter', icon: '💊' },
  { id: 'PRESCRIPTION', label: 'Prescription', icon: '📋' },
  { id: 'SUPPLEMENTS', label: 'Supplements', icon: '🌿' },
  { id: 'PERSONAL_CARE', label: 'Personal Care', icon: '🧴' },
  { id: 'MEDICAL_DEVICES', label: 'Medical Devices', icon: '🩺' },
];

const ProductCatalog: React.FC<ProductCatalogProps> = ({ inventory }) => {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Drug | null>(null);
  const { addToCart } = useShop();

  const filteredProducts = useMemo(() => {
    return inventory.filter(product => {
      const matchesCategory = activeCategory === 'ALL' || product.category === activeCategory;
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [inventory, activeCategory, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-slate-800">Pharmacy Shop</h2>
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>
      </div>

      {/* Categories */}
      <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all ${activeCategory === cat.id
              ? 'bg-indigo-600 text-white shadow-md transform scale-105'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500 text-lg">No products found in this category.</p>
          <button onClick={() => { setActiveCategory('ALL'); setSearchQuery(''); }} className="mt-4 text-indigo-600 font-bold hover:underline">
            View All Products
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(drug => (
            <div
              key={drug.id}
              onClick={() => setSelectedProduct(drug)}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all cursor-pointer flex flex-col group active:scale-[0.98]"
            >
              <div className="h-40 bg-gray-100 relative items-center justify-center flex">
                <span className="text-4xl filter grayscale group-hover:grayscale-0 transition-all duration-500">
                  {CATEGORIES.find(c => c.id === drug.category)?.icon || '💊'}
                </span>
                <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded-md text-xs font-bold shadow-sm opacity-90">
                  {drug.category || 'OTC'}
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{drug.name}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mt-1 flex-1">{drug.description || 'No description available.'}</p>

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 font-medium uppercase">Price</span>
                    {(drug.price_cents ?? 0) > 0 ? (
                      <span className="text-lg font-bold text-slate-900">ZMW {(drug.price_cents ?? 0).toFixed(2)}</span>
                    ) : (
                      <span className="text-sm font-medium text-amber-600">Contact for price</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCart(drug);
                      // Add basic toast here if possible, or reliance on context state update visual
                    }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"
                  >
                    Add +
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
};


export default ProductCatalog;

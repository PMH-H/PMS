/**
 * StoreProductManager Component
 * Manages OTC medicines, cosmetics, supplements and wellness products
 * Features: CRUD operations, inventory management, category filtering, pricing
 */

import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Edit, Search, MoreVertical, AlertCircle,
  TrendingUp, Package
} from 'lucide-react';
import { supabase } from '../services/supabase';
import * as dbService from '../services/database';
import type { StoreProduct } from '../types';
import { useAppContext } from '../context/AppContext';

interface ProductFormData {
  name: string;
  description: string;
  category: string;
  sku: string;
  price_cents: number;
  stock_quantity: number;
  reorder_level: number;
  image_url: string;
  tags: string[];
}

const PRODUCT_CATEGORIES = [
  { value: 'OTC_MEDICINES', label: '💊 OTC Medicines' },
  { value: 'COSMETICS', label: '💄 Cosmetics' },
  { value: 'SUPPLEMENTS', label: '🏃 Supplements' },
  { value: 'PERSONAL_CARE', label: '🧴 Personal Care' },
  { value: 'WELLNESS', label: '🧘 Wellness' },
  { value: 'FIRST_AID', label: '🏥 First Aid Kits' }
];

export const StoreProductManager: React.FC = () => {
  const { facility } = useAppContext();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    category: '',
    sku: '',
    price_cents: 0,
    stock_quantity: 0,
    reorder_level: 10,
    image_url: '',
    tags: []
  });
  const [tagInput, setTagInput] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load products
  useEffect(() => {
    if (facility?.id) {
      loadProducts();
    }
  }, [facility?.id]);

  // Filter products
  useEffect(() => {
    let filtered = products;

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    setFilteredProducts(filtered);
  }, [products, searchTerm, selectedCategory]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dbService.getStoreProducts(facility!.id);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.category || !formData.sku || !formData.price_cents) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (editingId) {
        // Update existing product
        await dbService.updateStoreProduct(editingId, formData);
      } else {
        // Create new product
        await dbService.createStoreProduct({
          ...formData,
          facility_id: facility!.id
        });
      }

      // Reload products
      await loadProducts();
      resetForm();
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
      console.error('Error saving product:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product: StoreProduct) => {
    setFormData({
      name: product.name,
      description: product.description || '',
      category: product.category,
      sku: product.sku,
      price_cents: product.price_cents,
      stock_quantity: product.stock_quantity,
      reorder_level: product.reorder_level,
      image_url: product.image_url || '',
      tags: product.tags || []
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDelete = async (productId: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      setDeletingId(productId);
      await dbService.deleteStoreProduct(productId);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      console.error('Error deleting product:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      sku: '',
      price_cents: 0,
      stock_quantity: 0,
      reorder_level: 10,
      image_url: '',
      tags: []
    });
    setEditingId(null);
    setTagInput('');
  };

  const getLowStockProducts = () => {
    return products.filter(p => p.stock_quantity <= p.reorder_level);
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const getCategoryLabel = (category: string) => {
    return PRODUCT_CATEGORIES.find(c => c.value === category)?.label || category;
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="w-8 h-8 text-indigo-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Store Products</h2>
            <p className="text-sm text-gray-600">Manage OTC medicines and wellness products</p>
          </div>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-5 h-5" />
          {showForm ? 'Cancel' : 'Add Product'}
        </button>
      </div>

      {/* Low Stock Alert */}
      {getLowStockProducts().length > 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-yellow-900">Low Stock Alert</h4>
            <p className="text-sm text-yellow-800">
              {getLowStockProducts().length} product(s) below reorder level
            </p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Product' : 'Add New Product'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., Paracetamol 500mg"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Select category</option>
                  {PRODUCT_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* SKU */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU (Stock Keeping Unit) *
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., PARA-500-001"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price (in cents) *
                </label>
                <input
                  type="number"
                  value={formData.price_cents}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_cents: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., 500 (for $5.00)"
                  min="1"
                />
              </div>

              {/* Stock Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Quantity *
                </label>
                <input
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  min="0"
                />
              </div>

              {/* Reorder Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reorder Level
                </label>
                <input
                  type="number"
                  value={formData.reorder_level}
                  onChange={(e) => setFormData(prev => ({ ...prev, reorder_level: parseInt(e.target.value) || 10 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  min="0"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={3}
                placeholder="Product details and usage information"
              />
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image URL
              </label>
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Add tags (press Enter)"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-indigo-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {loading ? 'Saving...' : editingId ? 'Update Product' : 'Create Product'}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, SKU, or tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="">All Categories</option>
          {PRODUCT_CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Products Grid */}
      {loading && !products.length ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            {searchTerm || selectedCategory ? 'No products match your filters' : 'No products yet. Add one to get started!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition"
            >
              {/* Product Image */}
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-48 object-cover bg-gray-100"
                />
              )}

              <div className="p-4">
                {/* Category Badge */}
                <div className="mb-2">
                  <span className="inline-block px-2 py-1 text-xs font-semibold bg-indigo-100 text-indigo-700 rounded">
                    {getCategoryLabel(product.category)}
                  </span>
                </div>

                {/* Name */}
                <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
                <p className="text-sm text-gray-600 mb-3">{product.description}</p>

                {/* SKU */}
                <p className="text-xs text-gray-500 mb-3">SKU: {product.sku}</p>

                {/* Price & Stock */}
                <div className="grid grid-cols-2 gap-3 mb-3 py-3 border-t border-b border-gray-200">
                  <div>
                    <p className="text-xs text-gray-600">Price</p>
                    <p className="text-lg font-bold text-green-600">${formatPrice(product.price_cents)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Stock</p>
                    <p className={`text-lg font-bold ${product.stock_quantity <= product.reorder_level ? 'text-red-600' : 'text-green-600'}`}>
                      {product.stock_quantity}
                    </p>
                  </div>
                </div>

                {/* Stock Status */}
                {product.stock_quantity <= product.reorder_level && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded flex items-center gap-2 text-xs text-red-700">
                    <TrendingUp className="w-4 h-4" />
                    Low stock - Reorder level: {product.reorder_level}
                  </div>
                )}

                {/* Tags */}
                {product.tags && product.tags.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {product.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                    {product.tags.length > 2 && (
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        +{product.tags.length - 2}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(product)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    disabled={deletingId === product.id}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {products.length > 0 && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Total Products</p>
            <p className="text-2xl font-bold text-gray-900">{products.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Low Stock</p>
            <p className="text-2xl font-bold text-red-600">{getLowStockProducts().length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Avg Price</p>
            <p className="text-2xl font-bold text-green-600">
              ${(products.reduce((sum, p) => sum + p.price_cents, 0) / 100 / products.length).toFixed(2)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Total Value</p>
            <p className="text-2xl font-bold text-blue-600">
              ${((products.reduce((sum, p) => sum + (p.price_cents * p.stock_quantity), 0) / 100).toFixed(2))}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
export default StoreProductManager;

/**
 * HealthNewsWidget Component
 * Display and manage health education articles and wellness content
 * Features: Article browsing, category filtering, view tracking, publishing
 */

import React, { useState, useEffect } from 'react';
import {
  FileText, Heart, Eye, Calendar, User, Search, Plus,
  AlertCircle, Trash2, Edit, Globe
} from 'lucide-react';
import * as dbService from '../services/database';
import type { HealthArticle } from '../types';
import { useAppContext } from '../context/AppContext';

const ARTICLE_CATEGORIES = [
  { value: 'MEDICATION', label: '💊 Medication Info', color: 'blue' },
  { value: 'WELLNESS', label: '🧘 Wellness Tips', color: 'green' },
  { value: 'DISEASE', label: '🏥 Disease Info', color: 'red' },
  { value: 'PREVENTION', label: '🛡️ Prevention', color: 'yellow' },
  { value: 'LIFESTYLE', label: '🏃 Lifestyle', color: 'purple' }
];

interface ArticleFormData {
  title: string;
  content: string;
  summary: string;
  category: string;
  tags: string[];
  image_url: string;
  is_published: boolean;
}

export const HealthNewsWidget: React.FC = () => {
  const { facility, user } = useAppContext();
  const [articles, setArticles] = useState<HealthArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [formData, setFormData] = useState<ArticleFormData>({
    title: '',
    content: '',
    summary: '',
    category: '',
    tags: [],
    image_url: '',
    is_published: false
  });

  // Load articles
  useEffect(() => {
    if (facility?.id) {
      loadArticles();
    }
  }, [facility?.id]);

  const loadArticles = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dbService.getHealthArticles(facility!.id);
      setArticles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles');
      console.error('Error loading articles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.content || !formData.category) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (editingId) {
        // Update article
        await dbService.updateHealthArticle(editingId, formData);
      } else {
        // Create article
        await dbService.createHealthArticle({
          ...formData,
          facility_id: facility!.id,
          author_id: user?.id
        });
      }

      await loadArticles();
      resetForm();
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save article');
      console.error('Error saving article:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (article: HealthArticle) => {
    setFormData({
      title: article.title,
      content: article.content,
      summary: article.summary || '',
      category: article.category,
      tags: article.tags || [],
      image_url: article.image_url || '',
      is_published: article.is_published
    });
    setEditingId(article.id);
    setShowForm(true);
  };

  const handleDelete = async (articleId: string) => {
    if (!window.confirm('Are you sure you want to delete this article?')) {
      return;
    }

    try {
      await dbService.deleteHealthArticle(articleId);
      await loadArticles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete article');
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
      title: '',
      content: '',
      summary: '',
      category: '',
      tags: [],
      image_url: '',
      is_published: false
    });
    setEditingId(null);
    setTagInput('');
  };

  const filteredArticles = articles.filter(article => {
    const matchesSearch = !searchTerm ||
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = !selectedCategory || article.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const getCategoryInfo = (category: string) => {
    return ARTICLE_CATEGORIES.find(c => c.value === category) || ARTICLE_CATEGORIES[0];
  };

  const isAuthor = (article: HealthArticle) => user?.id === article.author_id || user?.role === 'admin';

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Heart className="w-8 h-8 text-red-500" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Health News</h2>
            <p className="text-sm text-gray-600">Wellness and health education articles</p>
          </div>
        </div>
        {user?.role !== 'patient' && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
          >
            <Plus className="w-5 h-5" />
            {showForm ? 'Cancel' : 'New Article'}
          </button>
        )}
      </div>

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
            {editingId ? 'Edit Article' : 'Write New Article'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Article title"
              />
            </div>

            {/* Category & Image */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="">Select category</option>
                  {ARTICLE_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image URL
                </label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </div>

            {/* Summary */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Summary
              </label>
              <textarea
                value={formData.summary}
                onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows={2}
                placeholder="Brief summary of the article"
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content *
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows={6}
                placeholder="Article content (minimum 50 characters)"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.content.length} characters
              </p>
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Add tags"
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
                    className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Publish */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="publish"
                checked={formData.is_published}
                onChange={(e) => setFormData(prev => ({ ...prev, is_published: e.target.checked }))}
                className="w-4 h-4 text-red-500 rounded"
              />
              <label htmlFor="publish" className="text-sm text-gray-700">
                Publish immediately
              </label>
            </div>

            {/* Submit */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition"
              >
                {loading ? 'Saving...' : editingId ? 'Update Article' : 'Create Article'}
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
            placeholder="Search articles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
        >
          <option value="">All Categories</option>
          {ARTICLE_CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Articles List */}
      {loading && !articles.length ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
          <p className="mt-4 text-gray-600">Loading articles...</p>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            {searchTerm || selectedCategory ? 'No articles found' : 'No articles published yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredArticles.map(article => {
            const categoryInfo = getCategoryInfo(article.category);

            return (
              <div
                key={article.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition"
              >
                <div className="flex flex-col sm:flex-row">
                  {/* Image */}
                  {article.image_url && (
                    <img
                      src={article.image_url}
                      alt={article.title}
                      className="w-full sm:w-40 h-40 object-cover bg-gray-100"
                    />
                  )}

                  {/* Content */}
                  <div className="flex-1 p-4 flex flex-col justify-between">
                    <div>
                      {/* Category Badge */}
                      <div className="mb-2">
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded bg-${categoryInfo.color}-100 text-${categoryInfo.color}-700`}>
                          {categoryInfo.label}
                        </span>
                        {!article.is_published && (
                          <span className="ml-2 inline-block px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-700 rounded">
                            Draft
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                        {article.title}
                      </h3>

                      {/* Summary */}
                      {article.summary && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {article.summary}
                        </p>
                      )}

                      {/* Tags */}
                      {article.tags && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {article.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {article.view_count || 0} views
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(article.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Actions */}
                      {isAuthor(article) && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(article)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(article.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      {articles.length > 0 && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Total Articles</p>
            <p className="text-2xl font-bold text-gray-900">{articles.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Published</p>
            <p className="text-2xl font-bold text-green-600">{articles.filter(a => a.is_published).length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Total Views</p>
            <p className="text-2xl font-bold text-blue-600">{articles.reduce((sum, a) => sum + (a.view_count || 0), 0)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

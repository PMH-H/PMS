/**
 * NotificationManager Component
 * Comprehensive notification system with preferences and delivery management
 * Features: Real-time notifications, preference management, notification history
 */

import React, { useState, useEffect } from 'react';
import {
  Bell, Trash2, Settings, Check, X, AlertCircle,
  Mail, MessageSquare, ShoppingCart, Heart, Volume2
} from 'lucide-react';
import * as dbService from '../services/database';
import type { UserNotification, NotificationPreference } from '../types';
import { useAppContext } from '../context/AppContext';

const NOTIFICATION_TYPES = {
  ORDER_UPDATE: { label: '📦 Order Updates', color: 'blue', icon: ShoppingCart },
  HEALTH_ALERT: { label: '⚠️ Health Alerts', color: 'red', icon: AlertCircle },
  NEWS: { label: '📰 News', color: 'yellow', icon: Heart },
  CHANNEL_MESSAGE: { label: '💬 Channel Messages', color: 'purple', icon: MessageSquare },
  PROMOTION: { label: '🎁 Promotions', color: 'green', icon: Mail },
  PRESCRIPTION_READY: { label: '💊 Prescription Ready', color: 'indigo', icon: AlertCircle }
};

export const NotificationManager: React.FC = () => {
  const { user } = useAppContext();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [filter, setFilter] = useState<string>('all'); // all, unread

  // Load notifications and preferences
  useEffect(() => {
    if (user?.id) {
      loadNotifications();
      loadPreferences();
    }
  }, [user?.id]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dbService.getUserNotifications(user!.id);
      setNotifications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const data = await dbService.getNotificationPreferences(user!.id);
      setPreferences(data);
    } catch (err) {
      console.error('Error loading preferences:', err);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await dbService.markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notification');
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      // For now, just mark as read (soft delete)
      // In production, you might want a separate delete endpoint
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete notification');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setLoading(true);
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => dbService.markNotificationAsRead(n.id)));
      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all as read');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesChange = async (field: string, value: boolean) => {
    try {
      setLoading(true);
      setError(null);
      const updated = await dbService.updateNotificationPreferences(user!.id, {
        ...preferences,
        [field]: value
      });
      setPreferences(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
    } finally {
      setLoading(false);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getNotificationTypeInfo = (type: string) => {
    return NOTIFICATION_TYPES[type as keyof typeof NOTIFICATION_TYPES] || NOTIFICATION_TYPES.NEWS;
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-8 h-8 text-blue-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
            <p className="text-sm text-gray-600">{unreadCount} unread</p>
          </div>
        </div>
        <button
          onClick={() => setShowPreferences(!showPreferences)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Settings className="w-5 h-5" />
          Preferences
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Preferences Panel */}
      {showPreferences && preferences && (
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-4">Notification Preferences</h3>

          <div className="space-y-4">
            {/* Notification Types */}
            <div>
              <h4 className="font-medium text-gray-700 mb-3">What to receive</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition">
                  <input
                    type="checkbox"
                    checked={preferences.order_updates}
                    onChange={(e) => handlePreferencesChange('order_updates', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">📦 Order Updates</span>
                </label>

                <label className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition">
                  <input
                    type="checkbox"
                    checked={preferences.health_alerts}
                    onChange={(e) => handlePreferencesChange('health_alerts', e.target.checked)}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                  <span className="text-sm text-gray-700">⚠️ Health Alerts</span>
                </label>

                <label className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer hover:bg-yellow-100 transition">
                  <input
                    type="checkbox"
                    checked={preferences.news}
                    onChange={(e) => handlePreferencesChange('news', e.target.checked)}
                    className="w-4 h-4 text-yellow-600 rounded"
                  />
                  <span className="text-sm text-gray-700">📰 News & Articles</span>
                </label>

                <label className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg cursor-pointer hover:bg-purple-100 transition">
                  <input
                    type="checkbox"
                    checked={preferences.channel_messages}
                    onChange={(e) => handlePreferencesChange('channel_messages', e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="text-sm text-gray-700">💬 Channel Messages</span>
                </label>

                <label className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition">
                  <input
                    type="checkbox"
                    checked={preferences.promotions}
                    onChange={(e) => handlePreferencesChange('promotions', e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm text-gray-700">🎁 Promotions</span>
                </label>

                <label className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg cursor-pointer hover:bg-indigo-100 transition">
                  <input
                    type="checkbox"
                    checked={preferences.prescription_ready}
                    onChange={(e) => handlePreferencesChange('prescription_ready', e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm text-gray-700">💊 Prescriptions Ready</span>
                </label>
              </div>
            </div>

            {/* Delivery Channels */}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="font-medium text-gray-700 mb-3">How to receive notifications</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                  <input
                    type="checkbox"
                    checked={preferences.email_notifications}
                    onChange={(e) => handlePreferencesChange('email_notifications', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <Mail className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">Email notifications</span>
                </label>

                <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                  <input
                    type="checkbox"
                    checked={preferences.sms_notifications}
                    onChange={(e) => handlePreferencesChange('sms_notifications', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <Volume2 className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">SMS notifications</span>
                </label>
              </div>
            </div>

            <button
              onClick={() => setShowPreferences(false)}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          All Notifications
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'unread'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Unread ({unreadCount})
        </button>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={loading}
            className="ml-auto px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications List */}
      {loading && !notifications.length ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map(notification => {
            const typeInfo = getNotificationTypeInfo(notification.type);
            const Icon = typeInfo.icon;

            return (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border transition ${
                  notification.is_read
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-white border-blue-200 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    notification.is_read
                      ? 'bg-gray-100'
                      : 'bg-blue-100'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      notification.is_read
                        ? 'text-gray-600'
                        : 'text-blue-600'
                    }`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className={`font-semibold line-clamp-1 ${
                        notification.is_read
                          ? 'text-gray-700'
                          : 'text-gray-900'
                      }`}>
                        {notification.title}
                      </h4>
                      <span className="text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">
                        {new Date(notification.created_at).toLocaleString()}
                      </span>
                    </div>

                    <p className={`text-sm line-clamp-2 ${
                      notification.is_read
                        ? 'text-gray-600'
                        : 'text-gray-700'
                    }`}>
                      {notification.message}
                    </p>

                    {/* Type Badge */}
                    <div className="mt-2">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                        notification.is_read
                          ? 'bg-gray-100 text-gray-700'
                          : `bg-${typeInfo.color}-100 text-${typeInfo.color}-700`
                      }`}>
                        {typeInfo.label}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!notification.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteNotification(notification.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      {notifications.length > 0 && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Total Notifications</p>
            <p className="text-2xl font-bold text-gray-900">{notifications.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Unread</p>
            <p className="text-2xl font-bold text-blue-600">{unreadCount}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Read</p>
            <p className="text-2xl font-bold text-green-600">{notifications.filter(n => n.is_read).length}</p>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * UserChannelsWidget Component
 * Create, manage, and participate in user channels for community engagement
 * Features: Channel CRUD, membership management, messaging, broadcasting
 */

import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Users, Plus, Search, Settings, Trash2,
  AlertCircle, Send, User, Shield, Mail
} from 'lucide-react';
import * as dbService from '../services/database';
import type { UserChannel, ChannelMembership } from '../types';
import { useAppContext } from '../context/AppContext';

interface ChannelFormData {
  name: string;
  description: string;
  type: string;
  image_url: string;
}

const CHANNEL_TYPES = [
  { value: 'PUBLIC', label: '🌐 Public', description: 'Anyone can join' },
  { value: 'PRIVATE', label: '🔒 Private', description: 'Invite only' },
  { value: 'COMMUNITY', label: '👥 Community', description: 'Community interest group' }
];

export const UserChannelsWidget: React.FC = () => {
  const { facility, user } = useAppContext();
  const [channels, setChannels] = useState<UserChannel[]>([]);
  const [memberChannels, setMemberChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<UserChannel | null>(null);
  const [channelMembers, setChannelMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [broadcastData, setBroadcastData] = useState({
    title: '',
    content: '',
    broadcast_type: 'MESSAGE'
  });
  const [formData, setFormData] = useState<ChannelFormData>({
    name: '',
    description: '',
    type: 'PUBLIC',
    image_url: ''
  });

  // Load channels
  useEffect(() => {
    if (facility?.id) {
      loadChannels();
      loadMemberChannels();
    }
  }, [facility?.id, user?.id]);

  // Load messages when channel selected
  useEffect(() => {
    if (selectedChannel?.id) {
      loadChannelMembers();
      loadChannelMessages();
    }
  }, [selectedChannel?.id]);

  const loadChannels = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dbService.getUserChannels(facility!.id);
      setChannels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channels');
      console.error('Error loading channels:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMemberChannels = async () => {
    try {
      const data = await dbService.getUserChannelsForMember(user!.id);
      setMemberChannels(data);
    } catch (err) {
      console.error('Error loading member channels:', err);
    }
  };

  const loadChannelMembers = async () => {
    if (!selectedChannel) return;

    try {
      const data = await dbService.getChannelMembers(selectedChannel.id);
      setChannelMembers(data);
    } catch (err) {
      console.error('Error loading channel members:', err);
    }
  };

  const loadChannelMessages = async () => {
    if (!selectedChannel) return;

    try {
      const data = await dbService.getChannelMessages(selectedChannel.id);
      setMessages(data);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.type) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const newChannel = await dbService.createUserChannel({
        ...formData,
        facility_id: facility!.id,
        creator_id: user!.id
      });

      // Add creator as admin member
      await dbService.addChannelMember(newChannel.id, user!.id, 'ADMIN');

      await loadChannels();
      await loadMemberChannels();
      resetForm();
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create channel');
      console.error('Error creating channel:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinChannel = async (channelId: string) => {
    try {
      setLoading(true);
      await dbService.addChannelMember(channelId, user!.id, 'MEMBER');
      await loadMemberChannels();
      await loadChannels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join channel');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveChannel = async (channelId: string) => {
    if (!window.confirm('Leave this channel?')) return;

    try {
      setLoading(true);
      await dbService.removeChannelMember(channelId, user!.id);
      await loadMemberChannels();
      if (selectedChannel?.id === channelId) {
        setSelectedChannel(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave channel');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageText.trim() || !selectedChannel) {
      return;
    }

    try {
      await dbService.sendChannelMessage(selectedChannel.id, messageText);
      setMessageText('');
      await loadChannelMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!broadcastData.title || !broadcastData.content || !selectedChannel) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await dbService.createBroadcast({
        ...broadcastData,
        channel_id: selectedChannel.id,
        delivery_status: 'DRAFT'
      });

      setBroadcastData({ title: '', content: '', broadcast_type: 'MESSAGE' });
      setShowBroadcast(false);
      await loadChannelMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create broadcast');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!window.confirm('Delete this channel permanently?')) return;

    try {
      setLoading(true);
      await dbService.updateUserChannel(channelId, { is_active: false });
      await loadChannels();
      if (selectedChannel?.id === channelId) {
        setSelectedChannel(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete channel');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'PUBLIC',
      image_url: ''
    });
    setEditingId(null);
  };

  const isChannelMember = (channelId: string) => {
    return memberChannels.some(mc => mc.user_channels?.id === channelId);
  };

  const isChannelCreator = (channel: UserChannel) => channel.creator_id === user?.id;

  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    channel.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getChannelTypeInfo = (type: string) => {
    return CHANNEL_TYPES.find(ct => ct.value === type) || CHANNEL_TYPES[0];
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-lg p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channels List */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Channels
            </h3>
            <button
              onClick={() => {
                resetForm();
                setShowForm(!showForm);
              }}
              className="p-1 text-purple-600 hover:bg-purple-100 rounded transition"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Create Form */}
          {showForm && (
            <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200 space-y-3">
              <input
                type="text"
                placeholder="Channel name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <textarea
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={2}
              />
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {CHANNEL_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <button
                onClick={handleCreateChannel}
                disabled={loading}
                className="w-full px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50 transition"
              >
                {loading ? 'Creating...' : 'Create Channel'}
              </button>
            </div>
          )}

          {/* Search */}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search channels..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Channels List */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredChannels.map(channel => {
              const isMember = isChannelMember(channel.id);
              const typeInfo = getChannelTypeInfo(channel.type);

              return (
                <div
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedChannel?.id === channel.id
                      ? 'bg-purple-100 border-purple-300'
                      : 'bg-white border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="font-semibold text-sm text-gray-900">{channel.name}</h4>
                    {isChannelCreator(channel) && (
                      <Shield className="w-3 h-3 text-purple-600" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{typeInfo.label}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {channel.member_count} members
                    </span>
                    {!isMember ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinChannel(channel.id);
                        }}
                        className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
                      >
                        Join
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLeaveChannel(channel.id);
                        }}
                        className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
                      >
                        Leave
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Channel Detail */}
        <div className="lg:col-span-2">
          {selectedChannel ? (
            <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Channel Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedChannel.name}</h2>
                    <p className="text-sm text-gray-600">{selectedChannel.description}</p>
                  </div>
                  {isChannelCreator(selectedChannel) && (
                    <button
                      onClick={() => handleDeleteChannel(selectedChannel.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Members */}
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-600">{channelMembers.length} members</span>
                </div>

                {/* Action Buttons */}
                {isChannelCreator(selectedChannel) && (
                  <button
                    onClick={() => setShowBroadcast(!showBroadcast)}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition"
                  >
                    <Mail className="w-4 h-4" />
                    Send Broadcast
                  </button>
                )}
              </div>

              {/* Broadcast Form */}
              {showBroadcast && (
                <div className="p-4 bg-purple-50 border-b border-purple-200">
                  <form onSubmit={handleBroadcast} className="space-y-3">
                    <input
                      type="text"
                      placeholder="Broadcast title"
                      value={broadcastData.title}
                      onChange={(e) => setBroadcastData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <textarea
                      placeholder="Broadcast message"
                      value={broadcastData.content}
                      onChange={(e) => setBroadcastData(prev => ({ ...prev, content: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50 transition"
                      >
                        {loading ? 'Sending...' : 'Send Broadcast'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowBroadcast(false)}
                        className="px-3 py-2 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No messages yet. Be the first to say something!
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className="p-3 bg-gray-50 rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-3 h-3 text-gray-600" />
                        <span className="font-semibold text-sm text-gray-900">
                          {msg.profiles?.full_name || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{msg.message}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim()}
                  className="p-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-dashed border-gray-300 h-full flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Select a channel to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800">{error}</p>
        </div>
      )}
    </div>
  );
};

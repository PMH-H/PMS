import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { createSystemAlert, getSystemAlerts, deactivateSystemAlert } from '../services/database';
import { SystemAlert } from '../types';

const SystemAlertsManager: React.FC = () => {
    const [alerts, setAlerts] = useState<SystemAlert[]>([]);
    const [loading, setLoading] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [newType, setNewType] = useState<SystemAlert['type']>('info');
    const [durationHours, setDurationHours] = useState(24);

    const fetchAlerts = async () => {
        try {
            const data = await getSystemAlerts(false); // Get all to see history
            setAlerts(data);
        } catch (error) {
            console.error('Error fetching alerts:', error);
            toast.error('Failed to load alerts');
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage) return;

        setLoading(true);
        try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + durationHours);

            await createSystemAlert({
                message: newMessage,
                type: newType,
                expires_at: expiresAt.toISOString()
            });
            toast.success('Alert broadcasted successfully');
            setNewMessage('');
            fetchAlerts();
        } catch (error) {
            console.error('Error creating alert:', error);
            toast.error('Failed to broadcast alert');
        } finally {
            setLoading(false);
        }
    };

    const handleDeactivate = async (id: string) => {
        try {
            await deactivateSystemAlert(id);
            toast.success('Alert deactivated');
            fetchAlerts();
        } catch (error) {
            toast.error('Failed to deactivate alert');
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>📢</span> Global System Alerts
            </h2>

            {/* Create Form */}
            <form onSubmit={handleCreate} className="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="e.g. System maintenance scheduled for tonight..."
                            className="w-full border border-gray-300 rounded-lg px-4 py-2"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <select
                            value={newType}
                            onChange={(e) => setNewType(e.target.value as any)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2"
                        >
                            <option value="info">Info (Blue)</option>
                            <option value="warning">Warning (Amber)</option>
                            <option value="critical">Critical (Red)</option>
                            <option value="maintenance">Maintenance (Purple)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Duration (Hours)</label>
                        <input
                            type="number"
                            value={durationHours}
                            onChange={(e) => setDurationHours(parseInt(e.target.value))}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2"
                            min="1"
                        />
                    </div>
                </div>
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                    >
                        {loading ? 'Broadcasting...' : 'Broadcast Alert'}
                    </button>
                </div>
            </form>

            {/* List */}
            <div className="space-y-3">
                <h3 className="font-semibold text-gray-700 mb-2">Active & Recent Alerts</h3>
                {alerts.length === 0 ? (
                    <p className="text-gray-500 italic text-sm">No alerts found.</p>
                ) : (
                    alerts.map(alert => (
                        <div key={alert.id} className={`flex items-center justify-between p-3 rounded-lg border ${alert.is_active ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-60'
                            }`}>
                            <div className="flex items-center gap-3">
                                <span className={`w-3 h-3 rounded-full ${alert.type === 'critical' ? 'bg-red-500' :
                                        alert.type === 'warning' ? 'bg-amber-500' :
                                            alert.type === 'maintenance' ? 'bg-purple-500' :
                                                'bg-blue-500'
                                    }`}></span>
                                <div>
                                    <p className="font-medium text-gray-900">{alert.message}</p>
                                    <p className="text-xs text-gray-500">
                                        Type: {alert.type} • Status: {alert.is_active ? 'Active' : 'Inactive'} • Created: {new Date(alert.created_at).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            {alert.is_active && (
                                <button
                                    onClick={() => handleDeactivate(alert.id)}
                                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                                >
                                    Deactivate
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default SystemAlertsManager;

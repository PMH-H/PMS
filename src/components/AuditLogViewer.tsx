import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface AuditLogEntry {
    id: string;
    table_name: string;
    record_id: string;
    action: string;
    previous_data?: any;
    new_data?: any;
    performed_by?: string;
    created_at: string;
}

interface AuditLogViewerProps {
    facilityId?: string; // optional, if provided filters to facility
}

const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ facilityId }) => {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        table: 'all',
        action: 'all',
        dateFrom: '',
        dateTo: ''
    });
    const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

    const [stats, setStats] = useState({
        total: 0,
        inserts: 0,
        updates: 0,
        deletes: 0
    });

    useEffect(() => {
        fetchLogs();
        fetchStats();
    }, [filters, facilityId]);

    const fetchStats = async () => {
        try {
            // Apply filtering if needed, but for general stats 'all' is usually better unless strict scope
            let baseQuery = supabase.from('audit_log').select('*', { count: 'exact', head: true });
            if (facilityId) baseQuery = baseQuery.eq('facility_id', facilityId);

            const [total, inserts, updates, deletes] = await Promise.all([
                baseQuery,
                supabase.from('audit_log').select('*', { count: 'exact', head: true }).eq('action', 'INSERT'),
                supabase.from('audit_log').select('*', { count: 'exact', head: true }).eq('action', 'UPDATE'),
                supabase.from('audit_log').select('*', { count: 'exact', head: true }).eq('action', 'DELETE'),
            ]);

            setStats({
                total: total.count || 0,
                inserts: inserts.count || 0,
                updates: updates.count || 0,
                deletes: deletes.count || 0
            });
        } catch (e) {
            console.error("Error fetching stats", e);
        }
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('audit_log')
                .select('*, profiles!audit_log_performed_by_fkey(full_name)')
                .order('created_at', { ascending: false })
                .limit(100);

            if (filters.table !== 'all') {
                query = query.eq('table_name', filters.table);
            }

            if (filters.action !== 'all') {
                query = query.eq('action', filters.action);
            }

            if (filters.dateFrom) {
                query = query.gte('created_at', filters.dateFrom);
            }

            if (filters.dateTo) {
                query = query.lte('created_at', filters.dateTo);
            }

            const { data, error } = await query;
            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        const headers = ['Timestamp', 'Table', 'Action', 'User', 'Record ID'];
        const rows = logs.map(log => [
            new Date(log.created_at).toLocaleString(),
            log.table_name,
            log.action,
            (log as any).profiles?.full_name || 'System',
            log.record_id
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
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
                    <h2 className="text-2xl font-bold text-gray-900">Audit Log</h2>
                    <p className="text-sm text-gray-500">Complete system activity history</p>
                </div>
                <button
                    onClick={exportToCSV}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                </button>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase font-bold">Total Actions</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase font-bold">Inserts</p>
                    <p className="text-2xl font-bold text-green-600">{stats.inserts.toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase font-bold">Updates</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.updates.toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase font-bold">Deletes</p>
                    <p className="text-2xl font-bold text-red-600">{stats.deletes.toLocaleString()}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <select
                        value={filters.table}
                        onChange={e => setFilters({ ...filters, table: e.target.value })}
                        className="p-2 border border-gray-300 rounded-lg text-sm"
                    >
                        <option value="all">All Tables</option>
                        <option value="sales">Sales</option>
                        <option value="items">Items</option>
                        <option value="item_batches">Item Batches</option>
                        <option value="prescriptions">Prescriptions</option>
                        <option value="customer_orders">Customer Orders</option>
                        <option value="promotions">Promotions</option>
                    </select>

                    <select
                        value={filters.action}
                        onChange={e => setFilters({ ...filters, action: e.target.value })}
                        className="p-2 border border-gray-300 rounded-lg text-sm"
                    >
                        <option value="all">All Actions</option>
                        <option value="INSERT">INSERT</option>
                        <option value="UPDATE">UPDATE</option>
                        <option value="DELETE">DELETE</option>
                    </select>

                    <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={e => setFilters({ ...filters, dateFrom: e.target.value })}
                        className="p-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="From date"
                    />

                    <input
                        type="date"
                        value={filters.dateTo}
                        onChange={e => setFilters({ ...filters, dateTo: e.target.value })}
                        className="p-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="To date"
                    />
                </div>
            </div>

            {/* Log entries */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="text-left p-4 font-bold text-gray-700">Timestamp</th>
                            <th className="text-left p-4 font-bold text-gray-700">Table</th>
                            <th className="text-left p-4 font-bold text-gray-700">Action</th>
                            <th className="text-left p-4 font-bold text-gray-700">User</th>
                            <th className="text-left p-4 font-bold text-gray-700">Record ID</th>
                            <th className="text-left p-4 font-bold text-gray-700"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {logs.map(log => (
                            <tr key={log.id} className="hover:bg-gray-50">
                                <td className="p-4 text-gray-600">
                                    {new Date(log.created_at).toLocaleString()}
                                </td>
                                <td className="p-4">
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-bold">
                                        {log.table_name}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${log.action === 'INSERT' ? 'bg-green-100 text-green-800' :
                                        log.action === 'UPDATE' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                        {log.action}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-700">
                                    {(log as any).profiles?.full_name || 'System'}
                                </td>
                                <td className="p-4 font-mono text-xs text-gray-500">
                                    {log.record_id.slice(0, 8)}...
                                </td>
                                <td className="p-4">
                                    <button
                                        onClick={() => setSelectedLog(log)}
                                        className="text-indigo-600 hover:text-indigo-800 font-bold"
                                    >
                                        View
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {logs.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                    <p className="text-gray-500">No audit logs found for selected filters</p>
                </div>
            )}

            {/* Detail Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
                    <div className="bg-white rounded-2xl max-w-4xl w-full p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h3 className="text-2xl font-bold text-gray-900 mb-6">Audit Log Details</h3>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-bold text-gray-500">Table</p>
                                    <p className="text-lg text-gray-900">{selectedLog.table_name}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-500">Action</p>
                                    <p className="text-lg text-gray-900">{selectedLog.action}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-500">User</p>
                                    <p className="text-lg text-gray-900">{(selectedLog as any).profiles?.full_name || 'System'}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-500">Timestamp</p>
                                    <p className="text-lg text-gray-900">{new Date(selectedLog.created_at).toLocaleString()}</p>
                                </div>
                            </div>

                            {selectedLog.previous_data && (
                                <div>
                                    <p className="text-sm font-bold text-gray-500 mb-2">Previous Data</p>
                                    <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto">
                                        {JSON.stringify(selectedLog.previous_data, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {selectedLog.new_data && (
                                <div>
                                    <p className="text-sm font-bold text-gray-500 mb-2">New Data</p>
                                    <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto">
                                        {JSON.stringify(selectedLog.new_data, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setSelectedLog(null)}
                            className="mt-6 w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLogViewer;

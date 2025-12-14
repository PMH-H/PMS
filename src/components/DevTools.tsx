import React, { useState } from 'react';
import { supabase } from '../services/supabase';

const DevTools: React.FC = () => {
    const [sqlQuery, setSqlQuery] = useState('');
    const [queryResult, setQueryResult] = useState<any>(null);
    const [executing, setExecuting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const executeSafeSQL = async () => {
        // Only allow SELECT queries
        const trimmed = sqlQuery.trim().toUpperCase();
        if (!trimmed.startsWith('SELECT')) {
            setError('Only SELECT queries are allowed');
            return;
        }

        setExecuting(true);
        setError(null);
        try {
            const { data, error: execError } = await supabase.functions.invoke('dev-sql-runner', {
                body: { query: sqlQuery }
            });

            if (execError) throw execError;
            setQueryResult(data);
        } catch (err: any) {
            setError(err.message || 'Query execution failed');
        } finally {
            setExecuting(false);
        }
    };

    const replayEvents = async () => {
        try {
            const { data, error } = await supabase.functions.invoke('dev-event-replayer', {
                body: { count: 10 }
            });

            if (error) throw error;
            alert(`Replayed ${data.count} events successfully`);
        } catch (err: any) {
            setError(err.message || 'Event replay failed');
        }
    };

    return (
        <div className="space-y-6">
            {/* SQL Runner */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">🔧 SQL Runner (Read-Only)</h3>
                <div className="space-y-4">
                    <textarea
                        value={sqlQuery}
                        onChange={(e) => setSqlQuery(e.target.value)}
                        placeholder="SELECT * FROM profiles LIMIT 10;"
                        className="w-full h-32 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />

                    {error && (
                        <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={executeSafeSQL}
                        disabled={executing || !sqlQuery.trim()}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                        {executing ? 'Executing...' : 'Execute Query'}
                    </button>

                    {queryResult && (
                        <div className="mt-4 p-4 bg-slate-900 border border-slate-600 rounded-lg overflow-x-auto">
                            <pre className="text-xs text-green-400 font-mono">
                                {JSON.stringify(queryResult, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>

            {/* Event Replayer */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">🔄 Event Replayer</h3>
                <p className="text-slate-400 text-sm mb-4">
                    Generate sample metric_events for testing real-time dashboards
                </p>
                <button
                    onClick={replayEvents}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                    Replay 10 Events
                </button>
            </div>

            {/* Function Logs Viewer */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">📋 Edge Function Logs</h3>
                <p className="text-slate-400 text-sm">
                    View recent Edge Function execution logs (coming soon)
                </p>
            </div>
        </div>
    );
};

export default DevTools;

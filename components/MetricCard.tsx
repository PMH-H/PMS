import React from 'react';

interface MetricCardProps {
    id: string;
    title: string;
    value: number | string;
    delta?: number;
    sparkData?: number[];
    onConfigure?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({ id, title, value, delta, sparkData, onConfigure }) => {
    return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-emerald-500 transition-colors">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <div className="text-sm text-slate-400">{title}</div>
                    <div className="text-3xl font-bold text-white mt-1">{value}</div>
                </div>
                {delta !== undefined && (
                    <div className={`text-sm font-medium ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {delta >= 0 ? '+' : ''}{delta}%
                    </div>
                )}
            </div>

            {/* Simple sparkline placeholder */}
            {sparkData && sparkData.length > 0 && (
                <div className="h-12 mt-3">
                    <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
                        <polyline
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-emerald-500"
                            points={sparkData.map((val, i) =>
                                `${(i / (sparkData.length - 1)) * 100},${40 - (val / Math.max(...sparkData)) * 40}`
                            ).join(' ')}
                        />
                    </svg>
                </div>
            )}

            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-700">
                <button
                    onClick={onConfigure}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                >
                    Configure
                </button>
                <span className="text-xs text-slate-500">ID: {id.slice(0, 8)}</span>
            </div>
        </div>
    );
};

export default MetricCard;

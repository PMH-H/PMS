import React from 'react';

export type AlertLevel = 'CRITICAL' | 'SEVERE' | 'MODERATE' | 'INFO';

export interface InteractionAlert {
  id: string;
  level: AlertLevel;
  title: string;
  description: string;
  source: 'Database' | 'AI Analysis';
}

interface DrugInteractionAlertsProps {
  alerts: InteractionAlert[];
  onAcknowledge: (alertId: string) => void;
}

const alertStyles: { [key in AlertLevel]: { base: string; icon: string; } } = {
  CRITICAL: { base: 'bg-red-100 border-red-500 text-red-800', icon: 'text-red-500' },
  SEVERE:   { base: 'bg-orange-100 border-orange-500 text-orange-800', icon: 'text-orange-500' },
  MODERATE: { base: 'bg-yellow-100 border-yellow-500 text-yellow-800', icon: 'text-yellow-500' },
  INFO:     { base: 'bg-blue-100 border-blue-500 text-blue-800', icon: 'text-blue-500' },
};

const DrugInteractionAlerts: React.FC<DrugInteractionAlertsProps> = ({ alerts, onAcknowledge }) => {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      <h4 className="text-md font-semibold text-gray-800">Safety Alerts</h4>
      {alerts.map(alert => (
        <div key={alert.id} className={`p-3 border-l-4 rounded-r-lg ${alertStyles[alert.level].base}`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {/* SVG icon placeholder */}
              <svg className={`h-5 w-5 ${alertStyles[alert.level].icon}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-bold">{alert.title} <span className="text-xs font-normal">({alert.source})</span></p>
              <p className="text-sm mt-1">{alert.description}</p>
              <button 
                onClick={() => onAcknowledge(alert.id)}
                className="mt-2 text-xs font-semibold text-gray-700 hover:text-gray-900"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DrugInteractionAlerts;

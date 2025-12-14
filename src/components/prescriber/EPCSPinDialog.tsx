import React, { useState } from 'react';

interface EPCSPinDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void;
  isConfirming: boolean;
}

const EPCSPinDialog: React.FC<EPCSPinDialogProps> = ({ isOpen, onClose, onConfirm, isConfirming }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    if (pin.length !== 6) { // Basic validation
      setError('PIN must be 6 digits.');
      return;
    }
    setError('');
    onConfirm(pin);
  };

  const handleClose = () => {
      setPin('');
      setError('');
      onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
        <h2 className="text-lg font-bold mb-4">EPCS Authentication Required</h2>
        <p className="text-sm mb-4 text-gray-600">
          To prescribe this controlled substance, please enter your 6-digit EPCS PIN.
        </p>
        
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          maxLength={6}
          className={`w-full px-4 py-2 border rounded-md text-center tracking-widest ${error ? 'border-red-500' : 'border-gray-300'}`}
          placeholder="••••••"
        />
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

        <div className="mt-6 flex justify-end space-x-3">
          <button 
            onClick={handleClose}
            disabled={isConfirming}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={isConfirming}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:bg-indigo-400"
          >
            {isConfirming ? 'Confirming...' : 'Confirm & Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EPCSPinDialog;

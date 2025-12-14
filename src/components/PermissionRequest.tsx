import React, { useState, useEffect } from 'react';

interface PermissionRequestProps {
    onPermissionsGranted: (permissions: { camera: boolean; location: boolean; location_coords?: { lat: number; lng: number } }) => void;
}

const PermissionRequest: React.FC<PermissionRequestProps> = ({ onPermissionsGranted }) => {
    const [cameraGranted, setCameraGranted] = useState(false);
    const [locationGranted, setLocationGranted] = useState(false);
    const [requesting, setRequesting] = useState(false);

    const requestCameraPermission = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop()); // Stop immediately, just checking permission
            setCameraGranted(true);
            return true;
        } catch (err) {
            console.error('Camera permission denied:', err);
            return false;
        }
    };

    const requestLocationPermission = async (): Promise<{ granted: boolean; coords?: { lat: number; lng: number } }> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve({ granted: false });
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocationGranted(true);
                    resolve({
                        granted: true,
                        coords: {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        }
                    });
                },
                (error) => {
                    console.error('Location permission denied:', error);
                    resolve({ granted: false });
                }
            );
        });
    };

    const handleRequestPermissions = async () => {
        setRequesting(true);

        const camera = await requestCameraPermission();
        const location = await requestLocationPermission();

        onPermissionsGranted({
            camera,
            location: location.granted,
            location_coords: location.coords
        });

        setRequesting(false);
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">📍 Enable Features</h3>
            <p className="text-sm text-gray-600 mb-4">
                To provide the best experience, we need access to:
            </p>

            <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${cameraGranted ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {cameraGranted ? '✓' : '📷'}
                    </div>
                    <div>
                        <p className="font-medium text-sm">Camera Access</p>
                        <p className="text-xs text-gray-500">For scanning prescriptions and barcodes</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${locationGranted ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {locationGranted ? '✓' : '📍'}
                    </div>
                    <div>
                        <p className="font-medium text-sm">Location Access</p>
                        <p className="text-xs text-gray-500">To find nearest pharmacies and delivery options</p>
                    </div>
                </div>
            </div>

            <button
                onClick={handleRequestPermissions}
                disabled={requesting || (cameraGranted && locationGranted)}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {requesting ? 'Requesting...' : (cameraGranted && locationGranted) ? 'Permissions Granted ✓' : 'Grant Permissions'}
            </button>

            <button
                onClick={() => onPermissionsGranted({ camera: false, location: false })}
                className="w-full mt-2 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
                Skip for now
            </button>
        </div>
    );
};

export default PermissionRequest;

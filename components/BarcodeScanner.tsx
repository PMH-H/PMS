import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

interface BarcodeScannerProps {
    onScan: (result: string) => void;
    onClose: () => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const codeReader = new BrowserMultiFormatReader();
        let selectedDeviceId: string | undefined;

        const startScanner = async () => {
            try {
                const videoInputDevices = await navigator.mediaDevices.enumerateDevices();
                const rearCamera = videoInputDevices.find(device =>
                    device.kind === 'videoinput' && device.label.toLowerCase().includes('back')
                );

                selectedDeviceId = rearCamera ? rearCamera.deviceId : videoInputDevices.find(d => d.kind === 'videoinput')?.deviceId;

                if (!selectedDeviceId) {
                    throw new Error("No video input devices found.");
                }

                if (videoRef.current) {
                    codeReader.decodeFromVideoDevice(selectedDeviceId, videoRef.current, (result, err) => {
                        if (result) {
                            onScan(result.getText());
                        }
                        if (err && !(err instanceof NotFoundException)) {
                            setError('Error decoding barcode.');
                        }
                    });
                }
            } catch (err) {
                setError(err.message);
            }
        };

        startScanner();

        return () => {
            codeReader.reset();
        };
    }, [onScan]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">Scan Barcode</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-4 relative">
                    <video ref={videoRef} className="w-full h-64 object-cover rounded-md bg-gray-100" />
                    <div className="absolute inset-0 border-4 border-dashed border-emerald-500 rounded-lg" style={{
                        clipPath: 'polygon(0% 0%, 0% 100%, 25% 100%, 25% 25%, 75% 25%, 75% 75%, 25% 75%, 25% 100%, 100% 100%, 100% 0%)'
                    }}></div>
                    {error && <div className="mt-2 text-center text-sm text-red-600 bg-red-50 p-2 rounded-md">{error}</div>}
                </div>
                 <div className="p-4 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-500">
                    <p>Position the barcode within the frame. The scanner will automatically detect it.</p>
                </div>
            </div>
        </div>
    );
};

export default BarcodeScanner;

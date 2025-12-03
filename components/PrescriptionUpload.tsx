import React, { useState, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { supabase } from '../services/supabase';

interface PrescriptionUploadProps {
    userId: string;
    onUploadComplete: (prescriptionId: string) => void;
    onError: (error: string) => void;
}

const PrescriptionUpload: React.FC<PrescriptionUploadProps> = ({ userId, onUploadComplete, onError }) => {
    const [uploading, setUploading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scannedCode, setScannedCode] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

    const handleFileUpload = async (file: File) => {
        if (!file) return;

        setUploading(true);
        try {
            // Convert file to base64 for AI processing
            const reader = new FileReader();
            reader.readAsDataURL(file);

            await new Promise((resolve, reject) => {
                reader.onload = resolve;
                reader.onerror = reject;
            });

            const base64Image = reader.result as string;

            // Upload to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}-${Date.now()}.${fileExt}`;
            const filePath = `prescriptions/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('prescriptions')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('prescriptions')
                .getPublicUrl(filePath);

            // Parse prescription with AI
            let medications: any[] = [];
            let interactions: any[] = [];

            try {
                // Import AI service
                const { analyzePrescriptionImage, checkDrugInteractions } = await import('../services/geminiService');

                // Extract medications from image
                medications = await analyzePrescriptionImage(base64Image);

                // Check for drug interactions
                if (medications.length > 0) {
                    interactions = await checkDrugInteractions(medications);
                }
            } catch (aiErr) {
                console.warn('AI processing failed:', aiErr);
                // Continue without AI parsing - pharmacist can review manually
            }

            // Create prescription record with parsed data
            const { data: prescription, error: prescriptionError } = await supabase
                .from('prescriptions')
                .insert({
                    patient_id: userId,
                    image_url: publicUrl,
                    status: 'PENDING',
                    medications: medications,
                    interactions: interactions
                })
                .select()
                .single();

            if (prescriptionError) throw prescriptionError;

            onUploadComplete(prescription.id);
        } catch (err: any) {
            console.error('Upload error:', err);
            onError(err.message || 'Failed to upload prescription');
        } finally {
            setUploading(false);
        }
    };

    const startBarcodeScanner = async () => {
        setScanning(true);
        try {
            const codeReader = new BrowserMultiFormatReader();
            codeReaderRef.current = codeReader;

            // Try to get video devices, fallback to default if not supported
            let selectedDeviceId: string | undefined;

            try {
                const videoInputDevices = await codeReader.listVideoInputDevices();
                if (videoInputDevices.length === 0) {
                    throw new Error('No camera found');
                }
                selectedDeviceId = videoInputDevices[0].deviceId;
            } catch (deviceError) {
                console.warn('Device enumeration not supported, using default camera:', deviceError);
                // Use undefined to let browser choose default camera
                selectedDeviceId = undefined;
            }

            codeReader.decodeFromVideoDevice(
                selectedDeviceId,
                videoRef.current!,
                (result, err) => {
                    if (result) {
                        setScannedCode(result.getText());
                        stopBarcodeScanner();
                    }
                }
            );
        } catch (err: any) {
            console.error('Scanner error:', err);
            onError(err.message || 'Failed to start barcode scanner. Please ensure camera permissions are granted.');
            setScanning(false);
        }
    };

    const stopBarcodeScanner = () => {
        if (codeReaderRef.current) {
            codeReaderRef.current.reset();
            codeReaderRef.current = null;
        }
        setScanning(false);
    };

    const handleCameraCapture = async () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    return (
        <div className="space-y-4">
            {/* File Upload */}
            <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Upload Prescription</h3>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    capture="environment"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                    }}
                    className="hidden"
                />

                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={handleCameraCapture}
                        disabled={uploading}
                        className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                    >
                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">
                            {uploading ? 'Uploading...' : 'Take Photo'}
                        </span>
                    </button>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                    >
                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">Choose File</span>
                    </button>
                </div>
            </div>

            {/* Barcode Scanner */}
            <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Scan Medication Barcode</h3>

                {!scanning && !scannedCode && (
                    <button
                        onClick={startBarcodeScanner}
                        className="w-full flex items-center justify-center gap-2 p-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                        Start Scanner
                    </button>
                )}

                {scanning && (
                    <div className="space-y-3">
                        <video
                            ref={videoRef}
                            className="w-full rounded-lg bg-black"
                            style={{ maxHeight: '300px' }}
                        />
                        <button
                            onClick={stopBarcodeScanner}
                            className="w-full p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                            Stop Scanner
                        </button>
                    </div>
                )}

                {scannedCode && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800 font-medium">Scanned Code:</p>
                        <p className="text-lg font-mono text-green-900 mt-1">{scannedCode}</p>
                        <button
                            onClick={() => {
                                setScannedCode(null);
                                startBarcodeScanner();
                            }}
                            className="mt-3 text-sm text-green-700 hover:text-green-900 font-medium"
                        >
                            Scan Another
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrescriptionUpload;

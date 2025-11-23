import React, { useEffect, useRef, useState } from 'react';

interface BarcodeScannerProps {
    onDetected: (code: string) => void;
    onClose: () => void;
}

declare global {
    interface Window {
        Html5Qrcode: any;
    }
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onDetected, onClose }) => {
    const [error, setError] = useState<string>('');
    const scannerRef = useRef<any>(null);

    useEffect(() => {
        let html5QrCode: any;

        const startScanner = async () => {
            try {
                if (!window.Html5Qrcode) {
                    setError("Scanner library not loaded.");
                    return;
                }

                html5QrCode = new window.Html5Qrcode("reader");
                scannerRef.current = html5QrCode;

                const config = {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                };
                
                await html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText: string) => {
                        onDetected(decodedText);
                    },
                    (errorMessage: string) => {
                        // ignore scanning errors
                    }
                );

            } catch (err) {
                console.error("Scanner Error:", err);
                setError("Camera access denied or not available.");
            }
        };

        const timer = setTimeout(startScanner, 100);

        return () => {
            clearTimeout(timer);
            if (scannerRef.current) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current.clear();
                }).catch((err: any) => console.error("Stop failed", err));
            }
        };
    }, [onDetected]);

    // Fallback simulation
    const simulateScan = (code: string) => {
        onDetected(code);
    };

    return (
        <div className="fixed inset-0 bg-black z-[70] flex flex-col h-full w-full">
            {/* Header */}
            <div className="bg-slate-900 p-4 flex justify-between items-center z-10 shadow-md shrink-0 safe-top">
                <div className="flex items-center gap-2">
                    <div className="bg-emerald-500 rounded-full p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                        </svg>
                    </div>
                    <span className="text-white font-medium">Scan Barcode</span>
                </div>
                <button 
                    onClick={onClose}
                    className="bg-white/10 text-white p-2 rounded-full hover:bg-white/20 active:bg-white/30 backdrop-blur-sm transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Scanner Viewport */}
            <div className="relative flex-grow bg-black flex items-center justify-center overflow-hidden">
                {error ? (
                    <div className="text-red-400 p-6 text-center max-w-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-3 opacity-50">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <p className="font-medium">{error}</p>
                        <p className="text-sm mt-2 text-gray-500">Please check permissions or try manual entry.</p>
                    </div>
                ) : (
                    <div id="reader" className="w-full h-full object-cover"></div>
                )}
                
                {/* Visual Guide Overlay */}
                {!error && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-64 h-64 border-2 border-emerald-500/50 rounded-lg relative">
                            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-500 -mt-1 -ml-1"></div>
                            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-500 -mt-1 -mr-1"></div>
                            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-500 -mb-1 -ml-1"></div>
                            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-500 -mb-1 -mr-1"></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="bg-slate-900 p-6 border-t border-slate-800 shrink-0 pb-safe">
                 <p className="text-xs text-gray-500 mb-4 text-center uppercase tracking-wider font-bold">Quick Actions (Demo)</p>
                 <div className="grid grid-cols-2 gap-3">
                     <button onClick={() => simulateScan('111000')} className="px-4 py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white text-sm font-bold rounded-lg transition-colors border border-slate-700">
                         Simulate Amox
                     </button>
                     <button onClick={() => simulateScan('222000')} className="px-4 py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white text-sm font-bold rounded-lg transition-colors border border-slate-700">
                         Simulate Lisino
                     </button>
                 </div>
            </div>
        </div>
    );
};

export default BarcodeScanner;
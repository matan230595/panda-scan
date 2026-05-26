import React, { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Camera, X, Flashlight, FlashlightOff } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export default function QRScannerComponent({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [hasFlash, setHasFlash] = useState<boolean>(false);
  const [flashOn, setFlashOn] = useState<boolean>(false);
  const scannerRef = useRef<QrScanner | null>(null);

  useEffect(() => {
    let active = true;

    const initScanner = async () => {
      const hasCam = await QrScanner.hasCamera();
      if (!active) return;
      
      setHasCamera(hasCam);

      if (hasCam && videoRef.current) {
        scannerRef.current = new QrScanner(
          videoRef.current,
          (result) => {
            if (result && result.data) {
              onScan(result.data);
            }
          },
          {
            highlightScanRegion: true,
            highlightCodeOutline: true,
            returnDetailedScanResult: true,
          }
        );
        scannerRef.current.start().then(() => {
          if (!active) return;
          scannerRef.current?.hasFlash().then(hasF => setHasFlash(hasF));
        }).catch((e) => {
          console.error("Scanner failed to start", e);
        });
      }
    };

    initScanner();

    return () => {
      active = false;
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
      }
    };
  }, [onScan]);

  const toggleFlash = () => {
    if (scannerRef.current) {
      if (flashOn) {
        scannerRef.current.turnFlashOff();
        setFlashOn(false);
      } else {
        scannerRef.current.turnFlashOn().then(() => setFlashOn(true)).catch(() => {});
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="p-4 flex justify-between items-center bg-black/50 absolute top-0 left-0 right-0 z-10">
        <h2 className="text-white font-bold flex items-center gap-2">
          <Camera className="w-5 h-5" />
          סורק QR / ברקוד
        </h2>
        <div className="flex items-center gap-2">
          {hasFlash && (
            <button
              onClick={toggleFlash}
              className={`p-2 rounded-full transition-colors ${flashOn ? 'bg-amber-500 text-white' : 'text-white hover:bg-white/20'}`}
              title="תאורה"
            >
              {flashOn ? <Flashlight className="w-5 h-5" /> : <FlashlightOff className="w-5 h-5" />}
            </button>
          )}
          <button 
            onClick={onClose}
            className="text-white p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center bg-slate-900">
        {!hasCamera ? (
          <div className="text-white text-center p-8">
            <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>לא נמצאה מצלמה במכשיר זה, או שאין הרשאת גישה.</p>
          </div>
        ) : (
          <video 
            ref={videoRef} 
            className="w-full h-full object-cover" 
          />
        )}
      </div>
    </div>
  );
}

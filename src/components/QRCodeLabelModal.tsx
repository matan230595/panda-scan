import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer } from 'lucide-react';
import { FirebaseInventoryItem } from '../lib/inventoryService';

interface QRCodeLabelModalProps {
  items: (FirebaseInventoryItem & { id: string })[];
  onClose: () => void;
}

export default function QRCodeLabelModal({ items, onClose }: QRCodeLabelModalProps) {

  const handlePrint = () => {
    window.print();
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm print:p-0 print:bg-white print:block">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl relative flex flex-col print:shadow-none print:max-h-none print:overflow-visible print:max-w-none print:rounded-none">
        
        {/* Header - Not printed */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 print:hidden">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Printer className="w-5 h-5" />
            הדפסת מדבקות QR ({items.length})
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 px-4 rounded-lg flex items-center gap-2 transition-colors font-bold text-sm"
            >
              הדפס
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Printable Area */}
        <div 
          className="flex-1 overflow-y-auto p-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 bg-white dark:bg-slate-900 print:grid-cols-4 print:gap-4 print:p-0 print:overflow-visible print:bg-white print:w-full"
          dir="rtl"
        >
          {items.map(item => (
            <div key={item.id} className="flex flex-col items-center justify-center p-4 border border-slate-200 dark:border-slate-800 rounded-xl print:border-black print:rounded-none print:page-break-inside-avoid">
              <QRCodeSVG value={item.barcode} size={100} className="mb-3 print:w-24 print:h-24" />
              <div className="text-center w-full">
                <p className="font-bold text-slate-900 dark:text-white text-sm truncate w-full print:text-black">
                  {item.deviceName}
                </p>
                <p className="font-mono text-slate-500 text-xs mt-1 print:text-black">{item.barcode}</p>
                <p className="text-slate-400 text-[10px] mt-1 truncate w-full print:text-black">{item.room}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

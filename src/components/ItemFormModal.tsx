import React, { useState, useEffect } from 'react';
import { X, Check, Wand2, QrCode } from 'lucide-react';
import { FirebaseInventoryItem } from '../lib/inventoryService';
import QRCodeLabelModal from './QRCodeLabelModal';

interface ItemFormModalProps {
  isOpen: boolean;
  item: (FirebaseInventoryItem & { id?: string }) | null;
  onClose: () => void;
  onSave: (item: FirebaseInventoryItem & { id?: string }) => Promise<void>;
}

export default function ItemFormModal({ isOpen, item, onClose, onSave }: ItemFormModalProps) {
  const [formData, setFormData] = useState<Partial<FirebaseInventoryItem>>({
    barcode: '',
    deviceName: '',
    status: 'פעיל',
    room: '',
    sku: '',
    deviceType: '',
    appLogoUrl: '',
    linkedApp: '',
    deviceNetwork: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData(item);
    } else {
      setFormData({
        barcode: '',
        deviceName: '',
        status: 'פעיל',
        room: '',
        sku: '',
        deviceType: '',
        appLogoUrl: '',
        linkedApp: '',
        deviceNetwork: '',
      });
    }
    setError(null);
  }, [item, isOpen]);

  const generateBarcode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({...formData, barcode: `APP-${result}`});
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.barcode || !formData.deviceName) {
      setError('חובה למלא ברקוד ושם מכשיר');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave(formData as (FirebaseInventoryItem & { id?: string }));
      onClose();
    } catch (err: any) {
      setError(err.message || 'אירעה שגיאה בשמירה');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0" dir="rtl">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {item ? 'עריכת מכשיר' : 'הוספת מכשיר חדש'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm font-medium border border-red-200 dark:border-red-900/50">
              {error}
            </div>
          )}
          
          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">ברקוד (חובה)</label>
              {!item && (
                <button 
                  type="button" 
                  onClick={generateBarcode}
                  className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 hover:underline"
                >
                  <Wand2 className="w-3 h-3" />
                  ייצר ברקוד
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={formData.barcode}
                onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                disabled={!!item}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono"
              />
              {!!item && item.barcode && (
                <button
                  type="button"
                  onClick={() => setIsQRModalOpen(true)}
                  className="shrink-0 flex items-center justify-center p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg transition-colors border border-slate-300 dark:border-slate-700"
                  title="הדפס ברקוד"
                >
                  <QrCode className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">שם המכשיר</label>
            <input 
              type="text" 
              value={formData.deviceName}
              onChange={(e) => setFormData({...formData, deviceName: e.target.value})}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">מקט (SKU)</label>
              <input 
                type="text" 
                value={formData.sku}
                onChange={(e) => setFormData({...formData, sku: e.target.value})}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">חדר / מיקום</label>
              <input 
                type="text" 
                value={formData.room}
                onChange={(e) => setFormData({...formData, room: e.target.value})}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">סוג המכשיר</label>
              <input 
                type="text" 
                value={formData.deviceType || ''}
                onChange={(e) => setFormData({...formData, deviceType: e.target.value})}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">רשת מכשיר</label>
              <input 
                type="text" 
                value={formData.deviceNetwork || ''}
                onChange={(e) => setFormData({...formData, deviceNetwork: e.target.value})}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">אפליקציה מקושרת</label>
              <input 
                type="text" 
                value={formData.linkedApp || ''}
                onChange={(e) => setFormData({...formData, linkedApp: e.target.value})}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">קישור לוגו אפליקציה</label>
              <input 
                type="url" 
                value={formData.appLogoUrl || ''}
                onChange={(e) => setFormData({...formData, appLogoUrl: e.target.value})}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="https://"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">סטטוס</label>
            <select 
              value={formData.status}
              onChange={(e) => setFormData({...formData, status: e.target.value})}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="פעיל">פעיל</option>
              <option value="בתיקון">בתיקון</option>
              <option value="במחסן">במחסן</option>
            </select>
          </div>

          <div className="mt-8 pt-4 flex gap-3 border-t border-slate-100 dark:border-slate-800">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
            >
              ביטול
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>שמור מכשיר</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      
      {isQRModalOpen && item && item.barcode && (
        <QRCodeLabelModal
          onClose={() => setIsQRModalOpen(false)}
          items={[item as any]}
        />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Package, Search, Plus, Edit2, Trash2, DownloadCloud, QrCode } from 'lucide-react';
import { FirebaseInventoryItem } from '../lib/inventoryService';
import QRCodeLabelModal from './QRCodeLabelModal';

interface InventoryListProps {
  items: (FirebaseInventoryItem & { id: string })[];
  isLoading: boolean;
  onEdit: (item: FirebaseInventoryItem & { id: string }) => void;
  onDelete: (item: FirebaseInventoryItem & { id: string }) => void;
  onAddNew: () => void;
  onImportClick: (filteredItems: (FirebaseInventoryItem & { id: string })[]) => void;
  onBulkUpdateStatus: (itemIds: string[], newStatus: string) => Promise<void>;
}

export default function InventoryList({ items, isLoading, onEdit, onDelete, onAddNew, onImportClick, onBulkUpdateStatus }: InventoryListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [itemsToPrint, setItemsToPrint] = useState<(FirebaseInventoryItem & { id: string })[]>([]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedItems(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    if (selectedItems.size === 0) return;
    setIsBulkUpdating(true);
    await onBulkUpdateStatus(Array.from(selectedItems), status);
    setSelectedItems(new Set());
    setIsBulkUpdating(false);
  };

  const filteredItems = items.filter(item => 
    item.barcode.includes(searchTerm) || 
    item.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950/50">
      <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="חיפוש לפי שם, חדר, ברקוד..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block pl-10 pr-10 p-2.5 outline-none transition-all"
            dir="rtl"
          />
        </div>
        <div className="flex w-full sm:w-auto gap-2">
          {filteredItems.length > 0 && (
            <button 
              onClick={() => setItemsToPrint(filteredItems)}
              className="flex-none flex items-center justify-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 px-3 py-2.5 rounded-lg font-medium transition-all shadow-sm active:scale-95 text-sm"
              title="הדפס תוצאות סינון"
            >
              <QrCode className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={() => onImportClick(filteredItems)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2.5 rounded-lg font-medium transition-all shadow-sm active:scale-95 text-sm"
            title="ייבוא מאקסל"
          >
            <DownloadCloud className="w-5 h-5" />
            <span className="hidden sm:inline">ייבוא / ייצוא אקסל</span>
          </button>
          <button 
            onClick={onAddNew}
            className="flex-2 sm:flex-none w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-md active:scale-95 text-sm"
          >
            <Plus className="w-5 h-5" />
            <span>הוסף מכשיר</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6" dir="rtl">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Package className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">לא נמצאו מכשירים</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredItems.map(item => (
              <div key={item.id} className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between ${selectedItems.has(item.id) ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200 dark:border-slate-800'}`}>
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3 w-full pr-1">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded-lg border-slate-300 dark:border-slate-850 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                      {item.appLogoUrl ? (
                        <img src={item.appLogoUrl} alt="App Logo" className="w-9 h-9 rounded-xl object-cover bg-slate-100 shrink-0 border border-slate-200/50 dark:border-slate-805" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200/50 dark:border-slate-800">
                          <Package className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                      <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white line-clamp-1 truncate flex-1">{item.deviceName}</h3>
                    </div>
                    <span className={`px-3 py-1 text-xs font-black rounded-full shrink-0 mr-2
                      ${item.status === 'פעיל' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' :
                      item.status === 'בתיקון' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' :
                      item.status === 'במחסן' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
                      'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                      {item.status || 'חדש'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400 mb-4 mt-3">
                    <p className="flex justify-between border-b border-dashed border-slate-100 dark:border-slate-800/80 pb-1.5">
                      <span className="font-bold text-slate-400 dark:text-slate-500 text-xs">ברקוד / מק״ט:</span> 
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{item.barcode !== item.sku ? `${item.barcode} / ${item.sku}` : item.barcode}</span>
                    </p>
                    <p className="flex justify-between border-b border-dashed border-slate-100 dark:border-slate-800/80 pb-1.5">
                      <span className="font-bold text-slate-400 dark:text-slate-500 text-xs">מיקום / חדר:</span> 
                      <span className="font-bold text-slate-850 dark:text-slate-200">{item.room || 'ללא מיקום'}</span>
                    </p>
                    {(item.deviceType || item.deviceNetwork || item.linkedApp) && (
                      <div className="pt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
                        {item.deviceType && <span className="bg-blue-50/85 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-lg border border-blue-100/50 dark:border-blue-900/30">{item.deviceType}</span>}
                        {item.deviceNetwork && <span className="bg-purple-50/85 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 px-2.5 py-1 rounded-lg border border-purple-100/50 dark:border-purple-900/30">{item.deviceNetwork}</span>}
                        {item.linkedApp && <span className="bg-pink-50/85 dark:bg-pink-950/20 text-pink-700 dark:text-pink-400 px-2.5 py-1 rounded-lg border border-pink-100/50 dark:border-pink-900/30">{item.linkedApp}</span>}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/10 -mx-5 -mb-5 px-5 py-3.5 shrink-0">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-bold">
                    ID: #{item.id.substring(0, 6)}
                  </span>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => setItemsToPrint([item])}
                      className="p-2 text-emerald-600 hover:text-emerald-750 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 rounded-xl transition-all"
                      title="הדפס ברקוד"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onEdit(item)}
                      className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30 rounded-xl transition-all"
                      title="ערוך מכשיר"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDelete(item)}
                      className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 rounded-xl transition-all"
                      title="מחק מכשיר"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedItems.size > 0 && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-auto sm:bottom-8 sm:fixed sm:w-full sm:flex sm:justify-center z-50 animate-in slide-in-from-bottom-5">
          <div className="bg-slate-900 dark:bg-slate-800 text-white p-3 px-4 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full max-w-xl mx-auto">
            <div className="flex items-center gap-2 font-bold whitespace-nowrap">
              <span className="bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full text-xs">
                {selectedItems.size}
              </span>
              <span>נבחרו</span>
              <button 
                onClick={toggleSelectAll}
                className="text-xs text-slate-400 hover:text-white underline mr-2"
              >
                {selectedItems.size === filteredItems.length ? 'בטל הכל' : 'בחר הכל'}
              </button>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
              <button 
                onClick={() => setItemsToPrint(items.filter(i => selectedItems.has(i.id)))}
                className="flex-shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">הדפס</span>
              </button>
              <button 
                disabled={isBulkUpdating}
                onClick={() => handleBulkStatusChange('פעיל')}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                פעיל
              </button>
              <button 
                disabled={isBulkUpdating}
                onClick={() => handleBulkStatusChange('בתיקון')}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                בתיקון
              </button>
              <button 
                disabled={isBulkUpdating}
                onClick={() => handleBulkStatusChange('במחסן')}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                במחסן
              </button>
            </div>
          </div>
        </div>
      )}

      {itemsToPrint.length > 0 && (
        <QRCodeLabelModal 
          items={itemsToPrint} 
          onClose={() => setItemsToPrint([])} 
        />
      )}
    </div>
  );
}

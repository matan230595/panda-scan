import React, { useState, useRef } from 'react';
import { X, UploadCloud, DownloadCloud, Loader2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { FirebaseInventoryItem, saveInventoryItem, saveInventoryItemsBatch } from '../lib/inventoryService';
import { playSuccessSound, playErrorSound, vibrateSuccess, vibrateError } from '../lib/feedback';

// Safe XLSX resolution logic for Vite's various packaging configurations (CommonJS/ESM compatibility)
const xlsxLib = (XLSX as any).default && (XLSX as any).default.read ? (XLSX as any).default : XLSX;

interface ExcelImportModalProps {
  items?: (FirebaseInventoryItem & { id: string })[];
  onClose: () => void;
  onImportDone: () => void;
}

export default function ExcelImportModal({ items, onClose, onImportDone }: ExcelImportModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState<{current: number, total: number} | null>(null);
  
  // Mapping State
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const TARGET_FIELDS = [
    { id: 'barcode', label: 'ברקוד (חובה)', required: true },
    { id: 'deviceName', label: 'שם המכשיר', required: true },
    { id: 'sku', label: 'מק״ט / SKU', required: false },
    { id: 'status', label: 'סטטוס', required: false },
    { id: 'room', label: 'מיקום / חדר', required: false },
    { id: 'deviceType', label: 'סוג המכשיר', required: false },
    { id: 'deviceNetwork', label: 'רשת', required: false },
    { id: 'linkedApp', label: 'אפליקציה מקושרת', required: false },
    { id: 'appLogoUrl', label: 'קישור לוגו (App)', required: false }
  ];

  const handleExport = () => {
    if (!items || items.length === 0) {
      setError('אין נתונים לייצוא');
      return;
    }
    try {
      const dataToExport = items.map(item => ({
        'ברקוד': item.barcode,
        'שם המכשיר': item.deviceName,
        'סטטוס': item.status,
        'חדר': item.room,
        'מקט': item.sku,
        'סוג המכשיר': item.deviceType || '',
        'App': item.appLogoUrl || '',
        'רשת מכשיר': item.deviceNetwork || '',
        'אפליקציה מקושרת': item.linkedApp || '',
        'תאריך עדכון': new Date(item.lastUpdated).toLocaleString('he-IL')
      }));

      const worksheet = xlsxLib.utils.json_to_sheet(dataToExport);
      const workbook = xlsxLib.utils.book_new();
      xlsxLib.utils.book_append_sheet(workbook, worksheet, "Inventory");
      
      const fileName = `inventory_${new Date().toISOString().split('T')[0]}.xlsx`;
      xlsxLib.writeFile(workbook, fileName);
      setSuccess('הקובץ יוצא בהצלחה!');
      playSuccessSound();
    } catch (err: any) {
      console.error(err);
      setError('שגיאה ביצירת קובץ אקסל');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    // We use FileReader which is 100% resilient across older browsers and mobile platforms
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const arrayBuffer = evt.target?.result;
        if (!arrayBuffer) {
          throw new Error('לא ניתן לקרוא את קובץ האקסל.');
        }
        
        const data = new Uint8Array(arrayBuffer as ArrayBuffer);
        const workbook = xlsxLib.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = xlsxLib.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          throw new Error('הקובץ ריק או שאין אפשרות לקרוא אותו.');
        }

        const extractedHeaders = Object.keys(jsonData[0] || {});
        setHeaders(extractedHeaders);
        setParsedData(jsonData);

        // Auto Mapping
        const autoMap: Record<string, string> = {};
        extractedHeaders.forEach(col => {
          const c = col.toLowerCase();
          if (c.includes('ברקוד') || c.includes('barcode') || c === 'id') autoMap.barcode = col;
          if (c.includes('שם') || c.includes('name')) autoMap.deviceName = col;
          if (c.includes('סטטוס') || c.includes('status')) autoMap.status = col;
          if (c.includes('חדר') || c.includes('room') || c.includes('מיקום')) autoMap.room = col;
          if (c.includes('מקט') || c.includes('sku') || c.includes('מק"ט')) autoMap.sku = col;
          if (c.includes('סוג')) autoMap.deviceType = col;
          if (c.includes('רשת')) autoMap.deviceNetwork = col;
          if (c.includes('אפליקציה מקושרת')) autoMap.linkedApp = col;
          if (c.includes('app') || c.includes('לוגו')) autoMap.appLogoUrl = col;
        });
        setMapping(autoMap);

      } catch (err: any) {
        console.error('Excel Import Error during parsing:', err);
        setError(err.message || 'שגיאה בייבוא הקובץ. אנא ודא שמדובר בקובץ אקסל תקין.');
        playErrorSound();
        vibrateError();
      } finally {
        setIsLoading(false);
        setProgress(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      setError('אירעה שגיאה בקריאת הקובץ מהדיסק.');
      setIsLoading(false);
      playErrorSound();
      vibrateError();
    };

    reader.readAsArrayBuffer(file);
  };

  const confirmImport = async () => {
    if (!parsedData) return;
    if (!mapping.barcode && !mapping.sku) {
      setError('חובה לבחור עמודה עבור ברקוד או מק״ט');
      return;
    }

    setIsLoading(true);
    setError(null);
    let importedCount = 0;
    
    try {
      const extractUrl = (val: any) => {
        if (!val) return undefined;
        const str = String(val);
        const match = str.match(/\((https?:\/\/[^)]+)\)/);
        return match ? match[1] : (str.startsWith('http') ? str : undefined);
      };

      const itemsToSave: FirebaseInventoryItem[] = [];

      for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        
        let barcodeField = row[mapping.barcode];
        if (!barcodeField) barcodeField = row[mapping.sku]; // Fallback to SKU if no barcode

        if (!barcodeField) {
          continue; // skip empty
        }

        const item: FirebaseInventoryItem = {
          barcode: String(barcodeField),
          deviceName: String(mapping.deviceName ? row[mapping.deviceName] : 'ללא שם'),
          status: String(mapping.status && row[mapping.status] ? row[mapping.status] : 'פעיל'),
          room: String(mapping.room && row[mapping.room] ? row[mapping.room] : 'ללא מיקום'),
          sku: String(mapping.sku && row[mapping.sku] ? row[mapping.sku] : barcodeField),
          deviceType: mapping.deviceType && row[mapping.deviceType] ? String(row[mapping.deviceType]) : undefined,
          appLogoUrl: mapping.appLogoUrl ? extractUrl(row[mapping.appLogoUrl]) : undefined,
          linkedApp: mapping.linkedApp && row[mapping.linkedApp] ? String(row[mapping.linkedApp]) : undefined,
          deviceNetwork: mapping.deviceNetwork && row[mapping.deviceNetwork] ? String(row[mapping.deviceNetwork]) : undefined,
          lastUpdated: Date.now()
        };
        itemsToSave.push(item);
      }

      const total = itemsToSave.length;
      if (total === 0) {
        throw new Error('לא נמצאו פריטים תקינים לייבוא בקובץ.');
      }

      // Use high-performance server batching to write data fast and safely in single request payloads
      await saveInventoryItemsBatch(itemsToSave, (currentProgress) => {
        setProgress({ current: currentProgress, total });
      });
      importedCount = total;

      setSuccess(`ייבוא של ${importedCount} פריטים הושלם בהצלחה!`);
      playSuccessSound();
      vibrateSuccess();
      
      setTimeout(() => {
        onImportDone();
      }, 2500);

    } catch (err: any) {
      console.error('Import Error details:', err);
      let friendlyError = 'שגיאה במהלך עדכון הנתונים.';
      if (err instanceof Error) {
        friendlyError = `שגיאה: ${err.message}`;
      } else if (err && err.error) {
        friendlyError = `שגיאה ב-Firebase: ${err.error}`;
      } else if (typeof err === 'object') {
        friendlyError = `שגיאה: ${JSON.stringify(err)}`;
      } else if (err) {
        friendlyError = `שגיאה: ${String(err)}`;
      }
      setError(friendlyError);
      playErrorSound();
      vibrateError();
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col" dir="rtl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
            ייבוא מאקסל
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            העלה קובץ אקסל (XLSX, CSV). נדרשת לפחות עמודה בשם <strong className="text-slate-900 dark:text-white">״ברקוד״</strong> או <strong className="text-slate-900 dark:text-white">״Barcode״</strong>. עמודות אופציונליות: שם ציוד, מיקום, מק״ט, סטטוס.
          </p>
          
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}
            
            {success && (
              <div className="p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-sm font-medium">
                {success}
              </div>
            )}

            {progress && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>מייבא...</span>
                  <span>{progress.current} / {progress.total}</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-600 transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
            
            {parsedData && headers.length > 0 ? (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-400 mb-4 flex items-center justify-between">
                  <span>נמצאו {parsedData.length} שורות. אנא התאם את השדות.</span>
                  <button 
                    onClick={() => { setParsedData(null); setHeaders([]); setMapping({}); }}
                    className="text-xs font-bold underline"
                  >
                    בטל והחלף קובץ
                  </button>
                </div>
                
                <div className="grid gap-3">
                  {TARGET_FIELDS.map(field => (
                    <div key={field.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </div>
                      <select
                        value={mapping[field.id] || ''}
                        onChange={(e) => setMapping({...mapping, [field.id]: e.target.value})}
                        className="w-full sm:w-1/2 p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">-- התעלם (השאר ריק) --</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={confirmImport}
                    disabled={isLoading}
                    className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-md transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                    אישור וייבוא ({parsedData.length} רשומות)
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div 
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 text-center cursor-pointer transition-colors relative flex flex-col justify-center"
                  onClick={() => !isLoading && fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    disabled={isLoading}
                  />
                  
                  {isLoading ? (
                    <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-500 mx-auto animate-spin mb-3" />
                  ) : (
                    <UploadCloud className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
                  )}
                  
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {isLoading ? 'קורא נתונים...' : 'ייבוא קובץ'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">XLSX, CSV</p>
                </div>

                <div 
                  className="border-2 border-solid border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-slate-900 rounded-xl p-6 text-center cursor-pointer transition-colors relative flex flex-col justify-center"
                  onClick={() => !isLoading && handleExport()}
                >
                  <DownloadCloud className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    ייצא ל-Excel
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {items?.length || 0} פריטים
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

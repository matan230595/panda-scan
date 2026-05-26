import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Loader2, CheckCircle2, AlertCircle, Monitor, Box, Package, MapPin, Hash, Wifi, WifiOff, RefreshCcw, Moon, Sun, CloudOff, Database, LogOut, LogIn, List, ScanLine, SmartphoneNfc, History, QrCode, BarChart3, Volume2, VolumeX, Settings } from 'lucide-react';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useDarkMode } from './hooks/useDarkMode';
import { cacheItem, getCachedItem, InventoryItem } from './lib/cache';
import { enqueueUpdate, getQueue, dequeueUpdate, QueuedUpdate } from './lib/queue';
import { fetchInventoryItemByBarcode, updateInventoryItemStatus, FirebaseInventoryItem, getAllInventoryItems, saveInventoryItem, deleteInventoryItem } from './lib/inventoryService';
import { auth } from './lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { playSuccessSound, playErrorSound, vibrateSuccess, vibrateError, isAudioMuted, setAudioMuted } from './lib/feedback';
import { addAuditLog } from './lib/auditLog';

import InventoryList from './components/InventoryList';
import ItemFormModal from './components/ItemFormModal';
import QRScannerComponent from './components/QRScanner';
import AuditLogList from './components/AuditLogList';
import ExcelImportModal from './components/ExcelImportModal';
import SettingsTab from './components/SettingsTab';
import AppHealthMonitor from './components/AppHealthMonitor';

import Dashboard from './components/Dashboard';

type ConflictState = {
  remoteStatus: string;
  localStatus: string;
  deviceName: string;
  onResolve: (decision: 'local' | 'remote') => void;
};

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'scanner' | 'inventory' | 'audit' | 'dashboard' | 'settings'>('scanner');
  
  // Scanner state
  const [barcode, setBarcode] = useState('');
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [inventoryItem, setInventoryItem] = useState<InventoryItem | null>(null);
  
  // Inventory List Data
  const [allInventoryList, setAllInventoryList] = useState<(FirebaseInventoryItem & { id: string })[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [itemsToExport, setItemsToExport] = useState<(FirebaseInventoryItem & { id: string })[]>([]);
  const [editingItem, setEditingItem] = useState<(FirebaseInventoryItem & { id?: string }) | null>(null);

  // General App State
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [muted, setMutedState] = useState(isAudioMuted());
  
  const [syncQueue, setSyncQueue] = useState<QueuedUpdate[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const isOnline = useNetworkStatus();
  const { isDark, toggleDarkMode } = useDarkMode();
  const lastFetchedBarcodeRef = useRef<string>('');

  const toggleMute = () => {
    setAudioMuted(!muted);
    setMutedState(!muted);
  };

  useEffect(() => {
    if (activeTab === 'scanner' && barcode.trim() !== '' && barcode !== lastFetchedBarcodeRef.current) {
      if (barcode.length >= 3) { // rudimentary protection against small entries
        const handler = setTimeout(() => {
          lastFetchedBarcodeRef.current = barcode;
          fetchItem(barcode);
        }, 800); // 800ms debounce
        return () => clearTimeout(handler);
      }
    }
  }, [barcode, activeTab]);

  const loadQueue = useCallback(async () => {
    const q = await getQueue();
    setSyncQueue(q);
  }, []);

  useEffect(() => {
    loadQueue();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthInitialized(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [loadQueue]);

  // Load Inventory Data
  const loadAllItems = async () => {
    setIsListLoading(true);
    const items = await getAllInventoryItems();
    setAllInventoryList(items);
    setIsListLoading(false);
  };

  useEffect(() => {
    if (user && (activeTab === 'inventory' || activeTab === 'dashboard' || activeTab === 'settings')) {
      loadAllItems();
    }
  }, [user, activeTab]);

  // Global Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S -> Open Scanner / Focus Scan Field
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setActiveTab('scanner');
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
      // Ctrl+I or Cmd+I -> Open Import Modal
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        setItemsToExport(allInventoryList);
        setIsExcelModalOpen(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allInventoryList]);

  // Sync logic when network becomes available
  useEffect(() => {
    if (isOnline && syncQueue.length > 0 && !isSyncing && !conflictState && user) {
      processQueue();
    }
  }, [isOnline, syncQueue.length, isSyncing, conflictState, user]);

  const resolveConflict = (remoteStatus: string, localStatus: string, deviceName: string) => {
    return new Promise<'local' | 'remote'>((resolve) => {
      setConflictState({
        remoteStatus,
        localStatus,
        deviceName,
        onResolve: (decision: 'local' | 'remote') => {
          setConflictState(null);
          resolve(decision);
        }
      });
    });
  };

  const processQueue = async (manualRetry: boolean = false) => {
    setIsSyncing(true);
    let queue = await getQueue();

    for (const update of queue) {
      if (!isOnline && !manualRetry) break;

      try {
        const remoteData = await fetchInventoryItemByBarcode(update.barcode);
        
        if (remoteData) {
          const remoteStatus = remoteData.status;
          
          if (remoteStatus && remoteStatus !== update.oldStatus && remoteStatus !== update.newStatus) {
            const decision = await resolveConflict(remoteStatus, update.newStatus, update.deviceName);
            if (decision === 'remote') {
              await dequeueUpdate(update.id!);
              continue; 
            }
          }
        }

        await updateInventoryItemStatus(update.recordId, update.newStatus);
        
        await dequeueUpdate(update.id!);
        
        const cached = await getCachedItem(update.barcode);
        if (cached) {
          await cacheItem({ ...cached, status: update.newStatus });
          if (inventoryItem && inventoryItem.barcode === update.barcode) {
            setInventoryItem(prev => prev ? { ...prev, status: update.newStatus } : null);
          }
        }
      } catch (err) {
        console.error("Sync error:", err);
        break; 
      }
    }
    
    await loadQueue();
    // optionally refresh list if open
    if (activeTab === 'inventory') {
      loadAllItems();
    }
    setIsSyncing(false);
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setLoading(true);
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      console.error(e);
      setError("שגיאה בהזדהות. אם אתה במסך תצוגה מוקדמת, לחץ על סמל 'פתח בכרטיסייה חדשה' (Open in New Tab) בפינה הימנית העליונה של המסך ואז נסה להתחבר.");
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setInventoryItem(null);
    setAllInventoryList([]);
    setActiveTab('scanner');
  };

  const fetchItem = async (scannedBarcode: string) => {
    if (!scannedBarcode.trim() || !user) return;
    
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setInventoryItem(null);

    try {
      const cached = await getCachedItem(scannedBarcode);
      if (cached) {
        setInventoryItem(cached);
        if (!isOnline) {
             setSuccessMessage('נשלף מהזיכרון המקומי (אופליין)');
             setTimeout(() => setSuccessMessage(null), 3000);
             setBarcode('');
             lastFetchedBarcodeRef.current = '';
             inputRef.current?.focus();
             setLoading(false);
             playSuccessSound();
             vibrateSuccess();
             addAuditLog({
               barcode: scannedBarcode,
               action: 'סריקת פריט (אופליין)',
               status: 'success',
               message: cached.deviceName
             });
             return;
        }
      }

      const remoteData = await fetchInventoryItemByBarcode(scannedBarcode);

      if (remoteData) {
        const newItem = {
          id: remoteData.id,
          barcode: remoteData.barcode,
          deviceName: remoteData.deviceName || 'ללא שם',
          status: remoteData.status || '',
          room: remoteData.room || 'ללא חדר',
          sku: remoteData.sku || 'ללא מקט'
        };
        
        setInventoryItem(newItem);
        await cacheItem(newItem); 
        
        playSuccessSound();
        vibrateSuccess();
        addAuditLog({
          barcode: scannedBarcode,
          action: 'סריקת פריט',
          status: 'success',
          message: newItem.deviceName
        });
        
        setTimeout(() => {
          setBarcode('');
          lastFetchedBarcodeRef.current = '';
          inputRef.current?.focus();
        }, 2000);
      } else {
        if (!cached) {
           playErrorSound();
           vibrateError();
           addAuditLog({
             barcode: scannedBarcode,
             action: 'סריקת פריט',
             status: 'error',
             message: 'פריט לא נמצא במערכת'
           });
           
           // Not found, open create view automatically or just show error
           setError(`ברקוד ${scannedBarcode} לא נמצא במערכת`);
           setBarcode('');
           lastFetchedBarcodeRef.current = '';
           inputRef.current?.focus();
           
           // Optionally prepopulate a new item with the barcode
           setTimeout(() => {
             setEditingItem({
                barcode: scannedBarcode,
                deviceName: '',
                status: 'פעיל',
                room: '',
                sku: ''
             });
             setIsModalOpen(true);
             setError(null);
           }, 1000);
        }
      }
    } catch (err: any) {
      console.error("Fetch error:", err);
      if (!inventoryItem) {
        setError("שגיאת תקשורת: ודא חיבור לרשת ונסה שוב");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (barcode !== lastFetchedBarcodeRef.current) {
        lastFetchedBarcodeRef.current = barcode;
        fetchItem(barcode);
      }
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!inventoryItem || !user) return;
    
    setUpdating(true);
    setError(null);
    setSuccessMessage(null);

    const oldStatus = inventoryItem.status;
    const updatedItem = { ...inventoryItem, status: newStatus };
    
    setInventoryItem(updatedItem);
    await cacheItem(updatedItem);

    if (!isOnline) {
      await enqueueUpdate({
        recordId: inventoryItem.id,
        barcode: inventoryItem.barcode,
        deviceName: inventoryItem.deviceName,
        newStatus,
        oldStatus,
        timestamp: Date.now()
      });
      await loadQueue();
      setSuccessMessage(`נשמר מקומית ויסתנכרן כשהרשת תחזור`);
      setUpdating(false);
      setTimeout(() => setSuccessMessage(null), 3000);
      inputRef.current?.focus();
      playSuccessSound();
      vibrateSuccess();
      addAuditLog({
        barcode: inventoryItem.barcode,
        action: 'עדכון סטטוס מקומי',
        status: 'offline_queued',
        message: `סטטוס שונה ל-${newStatus} (ממתין לרשת)`
      });
      return;
    }

    try {
      await updateInventoryItemStatus(inventoryItem.id, newStatus);
      setSuccessMessage(`סטטוס עודכן ל-${newStatus}`);
      setTimeout(() => setSuccessMessage(null), 3000);
      inputRef.current?.focus();
      playSuccessSound();
      vibrateSuccess();
      addAuditLog({
        barcode: inventoryItem.barcode,
        action: 'עדכון סטטוס',
        status: 'success',
        message: `סטטוס שונה ל-${newStatus}`
      });
    } catch (err: any) {
      console.error("Update error, queuing:", err);
      await enqueueUpdate({
        recordId: inventoryItem.id,
        barcode: inventoryItem.barcode,
        deviceName: inventoryItem.deviceName,
        newStatus,
        oldStatus,
        timestamp: Date.now()
      });
      await loadQueue();
      setSuccessMessage(`חיבור אבד. הפעולה נשמרה בתור`);
      setTimeout(() => setSuccessMessage(null), 3000);
      playErrorSound();
      vibrateError();
      addAuditLog({
        barcode: inventoryItem.barcode,
        action: 'עדכון סטטוס',
        status: 'offline_queued',
        message: `נשמר בתור במצב לא מקוון`
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleBulkUpdateStatus = async (itemIds: string[], newStatus: string) => {
    setUpdating(true);
    let successCount = 0;
    
    for (const id of itemIds) {
      const item = allInventoryList.find(i => i.id === id);
      if (!item) continue;
      
      const oldStatus = item.status;
      const updatedItem = { ...item, status: newStatus };
      
      setAllInventoryList(prev => prev.map(i => i.id === id ? updatedItem : i));
      
      if (inventoryItem && inventoryItem.id === id) {
        setInventoryItem(updatedItem);
      }
      
      await cacheItem(updatedItem);
      
      if (!isOnline) {
        await enqueueUpdate({
          recordId: item.id,
          barcode: item.barcode,
          deviceName: item.deviceName,
          newStatus,
          oldStatus,
          timestamp: Date.now()
        });
        successCount++;
        addAuditLog({
          barcode: item.barcode,
          action: 'עדכון קבוצתי מקומי',
          status: 'offline_queued',
          message: `סטטוס שונה ל-${newStatus} (ממתין לרשת)`
        });
      } else {
        try {
          await updateInventoryItemStatus(item.id, newStatus);
          successCount++;
          addAuditLog({
            barcode: item.barcode,
            action: 'עדכון קבוצתי',
            status: 'success',
            message: `סטטוס שונה ל-${newStatus}`
          });
        } catch (err: any) {
          console.error("Update error, queuing:", err);
          await enqueueUpdate({
            recordId: item.id,
            barcode: item.barcode,
            deviceName: item.deviceName,
            newStatus,
            oldStatus,
            timestamp: Date.now()
          });
          successCount++;
          addAuditLog({
            barcode: item.barcode,
            action: 'עדכון קבוצתי',
            status: 'offline_queued',
            message: `נשמר בתור במצב לא מקוון`
          });
        }
      }
    }
    
    await loadQueue();
    playSuccessSound();
    vibrateSuccess();
    setUpdating(false);
  };

  const handleSaveItem = async (item: FirebaseInventoryItem & { id?: string }) => {
    if (!isOnline) {
      throw new Error('לא ניתן להוסיף יו לערוך פריטים ללא חיבור אינטרנט פעיל');
    }
    await saveInventoryItem(item);
    
    if (activeTab === 'inventory') {
      await loadAllItems();
    }
    
    // Update active scanner view if we just edited the same item
    if (inventoryItem && (inventoryItem.id === item.id || inventoryItem.barcode === item.barcode)) {
      setInventoryItem({ ...inventoryItem, ...item } as InventoryItem);
      await cacheItem({ ...inventoryItem, ...item } as InventoryItem);
    }
  };

  const handleDeleteItem = async (item: FirebaseInventoryItem & { id: string }) => {
    if (!isOnline) {
      alert('לא ניתן למחוק פריטים ללא חיבור אינטרנט פעיל');
      return;
    }
    if(window.confirm('האם אתה בטוח שברצונך למחוק את הפריט הזה? הפעולה אינה הפיכה.')) {
      try {
        await deleteInventoryItem(item.id);
        await loadAllItems();
        if (inventoryItem && inventoryItem.id === item.id) {
          setInventoryItem(null);
          setBarcode('');
        }
      } catch (err: any) {
        alert('שגיאה במחיקת הפריט: ' + err.message);
      }
    }
  };

  const handleWrapperClick = () => {
    if (activeTab === 'scanner' && !loading && !updating && !conflictState && user && !isModalOpen) {
      inputRef.current?.focus();
    }
  };

  if (!authInitialized) return null;

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden" dir="rtl">
      
      {/* App Header */}
      <header className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between z-20 relative shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-xl shadow-[0_2px_10px_rgba(37,99,235,0.3)]">
            <Package className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
             <h1 className="text-base sm:text-lg font-black tracking-tight leading-none text-slate-900 dark:text-white">ניהול ציוד חכם וניידים</h1>
             <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Smart Assets Management</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold transition-colors ${!isOnline && 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40'}`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5 text-blue-600" /> : <WifiOff className="w-3.5 h-3.5 text-red-600" />}
            <span className="hidden md:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {syncQueue.length > 0 && user && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded-full text-xs font-bold border border-amber-200 dark:border-amber-800/50">
                <Database className="w-3 h-3" />
                <span>{syncQueue.length}</span>
                {isSyncing && <RefreshCcw className="w-3 h-3 animate-spin mx-1" />}
              </div>
              <button
                onClick={() => processQueue(true)}
                disabled={isSyncing}
                className="text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/50 dark:hover:bg-amber-900/70 dark:text-amber-400 px-2.5 py-1 rounded-full transition-colors active:scale-95 disabled:opacity-50"
              >
                סנכרן כעת
              </button>
            </div>
          )}

          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

          <button onClick={toggleMute} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-400">
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <button onClick={toggleDarkMode} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-400">
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          {user ? (
            <button onClick={handleLogout} className="p-2 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 rounded-full transition-colors text-slate-600 dark:text-slate-400" title="התנתק">
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={handleLogin} className="p-2 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 rounded-full transition-colors text-slate-600 dark:text-slate-400" title="התחבר">
               <LogIn className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-hidden relative flex flex-col max-w-7xl mx-auto w-full" onClick={handleWrapperClick}>
        {!user && !loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
               <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 max-w-md w-full">
                 <Package className="w-16 h-16 text-blue-600 mx-auto mb-6" />
                 <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">מערכת ניהול ציוד ערך</h2>
                 <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto leading-relaxed">
                    גישה מאובטחת לניהול מכשירים חכמים, ניידים, ומחשבים בארגון. התחבר באמצעות חשבון Google כדי לשמור, לסנכרן ולערוך נתונים.
                 </p>
                 <button onClick={handleLogin} className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-md">
                    <LogIn className="w-5 h-5" />
                    התחבר למערכת
                 </button>
               </div>
            </div>
        ) : user ? (
          activeTab === 'scanner' ? (
             <div className="flex flex-col h-full animate-in fade-in duration-300">
                {/* Scanner View */}
                <div className="p-4 sm:p-6 lg:p-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm z-10 shrink-0">
                   <div className="max-w-2xl mx-auto">
                      <label className="block text-sm sm:text-base font-bold text-slate-700 dark:text-slate-300 mb-3 mx-1">חיפוש קטלוגי / ברקוד:</label>
                      <div className="relative group">
                        <input
                          ref={inputRef}
                          type="text"
                          autoFocus
                          value={barcode}
                          onChange={(e) => setBarcode(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="000-0000"
                          disabled={loading || updating || !!conflictState}
                          className="w-full h-16 sm:h-20 text-3xl sm:text-4xl font-mono tracking-widest px-6 pl-16 pr-16 bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white transition-all disabled:opacity-50 text-left outline-none uppercase shadow-inner"
                          inputMode="none" // Optimizes for physical scanners by keeping mobile KB down
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-6 pointer-events-none">
                          <ScanLine className="w-7 h-7 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <div className="absolute inset-y-0 left-0 flex items-center pl-4">
                          <button 
                            onClick={() => setIsQRScannerOpen(true)}
                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 p-2 rounded-xl transition-colors shadow-sm"
                            title="סרוק בעזרת מצלמה"
                          >
                            <QrCode className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                      
                      {error && !loading && (
                        <div className="mt-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 sm:p-4 rounded-xl font-bold flex items-center border border-red-100 dark:border-red-900/50 text-sm">
                          <AlertCircle className="w-5 h-5 ml-2.5 shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      {successMessage && !loading && !error && (
                        <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 p-3 sm:p-4 rounded-xl font-bold flex items-center border border-emerald-100 dark:border-emerald-900/50 text-sm">
                          <CheckCircle2 className="w-5 h-5 ml-2.5 shrink-0" />
                          <span>{successMessage}</span>
                        </div>
                      )}
                   </div>
                </div>
                
                {/* Result Card */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col bg-slate-50 dark:bg-slate-950 max-w-5xl mx-auto w-full relative">
                    {loading && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                        <span className="font-bold tracking-widest text-slate-600 dark:text-slate-400 uppercase">מחפש רשומה...</span>
                      </div>
                    )}
                    
                    {!inventoryItem && !loading && !error && (
                      <div className="m-auto flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 opacity-60">
                        <SmartphoneNfc className="w-24 h-24 mb-6 stroke-1" />
                        <p className="text-xl font-bold uppercase tracking-widest text-center">המתנה לסריקת מכשיר</p>
                        <p className="text-sm mt-3 max-w-xs text-center font-medium">סרוק ברקוד בעזרת הקורא או הקלד מזהה לבדיקת סטטוס ומיקום</p>
                      </div>
                    )}

                    {inventoryItem && !loading && (
                      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col flex-1 animate-in slide-in-from-bottom-4 duration-300 max-h-[600px]">
                        <div className="p-6 sm:p-10 flex-1 flex flex-col">
                          <div className="flex justify-between items-start mb-6">
                            <div>
                               <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">מזהה מכשיר</p>
                               <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white flex items-center leading-tight">
                                 {inventoryItem.deviceName}
                               </h3>
                            </div>
                            <button 
                                onClick={() => { setEditingItem(inventoryItem); setIsModalOpen(true); }}
                                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 p-3 rounded-full transition-colors shadow-sm text-slate-600 dark:text-slate-300"
                                title="ערוך מכשיר"
                            >
                                <Monitor className="w-6 h-6" />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-6 sm:gap-10 border-t border-slate-100 dark:border-slate-800 pt-8 mt-auto flex-1 content-start">
                            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                                <Hash className="w-3.5 h-3.5 ml-1.5" /> מקט (P/N)
                              </p>
                              <p className="text-lg sm:text-2xl font-mono font-medium text-slate-700 dark:text-slate-300 break-all">{inventoryItem.sku}</p>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                                <MapPin className="w-3.5 h-3.5 ml-1.5" /> חדר / מיקום
                              </p>
                              <p className="text-lg sm:text-2xl font-medium text-slate-700 dark:text-slate-300">{inventoryItem.room}</p>
                            </div>
                            
                            <div className="col-span-2 flex flex-col items-center text-center mt-2">
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">סטטוס מכשיר נוכחי</p>
                              <span className={`inline-flex items-center justify-center min-w-[200px] px-8 py-3 rounded-xl font-black tracking-widest uppercase border-2 text-xl
                                ${
                                  inventoryItem.status === 'פעיל' ? 'bg-green-50 text-green-700 border-green-600 dark:bg-green-950/30 dark:border-green-500/50 dark:text-green-400 shadow-[0_0_15px_rgba(22,163,74,0.15)]' :
                                  inventoryItem.status === 'בתיקון' ? 'bg-amber-50 text-amber-700 border-amber-600 dark:bg-amber-950/30 dark:border-amber-500/50 dark:text-amber-400 shadow-[0_0_15px_rgba(217,119,6,0.15)]' :
                                  inventoryItem.status === 'במחסן' ? 'bg-slate-100 text-slate-700 border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-500 shadow-sm' :
                                  'bg-slate-100 text-slate-500 border-slate-400 dark:bg-slate-800 dark:text-slate-400'
                                }`}>
                                {inventoryItem.status || 'חדש'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-2 sm:p-3 gap-2 sm:gap-3">
                          <button
                            onClick={() => updateStatus('פעיל')}
                            disabled={updating || inventoryItem.status === 'פעיל' || !!conflictState}
                            className="py-4 sm:py-5 bg-white hover:bg-green-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 dark:hover:border-green-500/50 disabled:opacity-40 disabled:hover:border-slate-200 disabled:bg-slate-50 dark:disabled:bg-slate-900/50 text-slate-700 hover:text-green-700 dark:text-slate-300 dark:hover:text-green-400 flex flex-col items-center justify-center transition-all rounded-2xl outline-none"
                          >
                            <span className="text-base sm:text-lg font-black">פעיל</span>
                            <span className="text-[10px] opacity-60 uppercase font-mono tracking-tighter mt-1">Set Active</span>
                          </button>
                          
                          <button
                            onClick={() => updateStatus('בתיקון')}
                            disabled={updating || inventoryItem.status === 'בתיקון' || !!conflictState}
                            className="py-4 sm:py-5 bg-white hover:bg-amber-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:hover:border-amber-500/50 disabled:opacity-40 disabled:hover:border-slate-200 disabled:bg-slate-50 dark:disabled:bg-slate-900/50 text-slate-700 hover:text-amber-700 dark:text-slate-300 dark:hover:text-amber-400 flex flex-col items-center justify-center transition-all rounded-2xl outline-none"
                          >
                            <span className="text-base sm:text-lg font-black">בתיקון</span>
                            <span className="text-[10px] opacity-60 uppercase font-mono tracking-tighter mt-1">Repair</span>
                          </button>
                          
                          <button
                            onClick={() => updateStatus('במחסן')}
                            disabled={updating || inventoryItem.status === 'במחסן' || !!conflictState}
                            className="py-4 sm:py-5 bg-white hover:bg-slate-100 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 dark:hover:border-slate-500/50 disabled:opacity-40 disabled:hover:border-slate-200 disabled:bg-slate-50 dark:disabled:bg-slate-900/50 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white flex flex-col items-center justify-center transition-all rounded-2xl outline-none"
                          >
                            <span className="text-base sm:text-lg font-black">במחסן</span>
                            <span className="text-[10px] opacity-60 uppercase font-mono tracking-tighter mt-1">Storage</span>
                          </button>
                        </div>
                      </div>
                    )}
                </div>
             </div>
          ) : activeTab === 'inventory' ? (
             <div className="flex-1 overflow-hidden animate-in fade-in duration-300">
               <InventoryList 
                 items={allInventoryList} 
                 isLoading={isListLoading} 
                 onEdit={(item) => { setEditingItem(item); setIsModalOpen(true); }}
                 onDelete={handleDeleteItem}
                 onAddNew={() => { setEditingItem(null); setIsModalOpen(true); }}
                 onImportClick={(filteredItems) => {
                   setItemsToExport(filteredItems);
                   setIsExcelModalOpen(true);
                 }}
                 onBulkUpdateStatus={handleBulkUpdateStatus}
               />
             </div>
          ) : activeTab === 'dashboard' ? (
             <div className="flex-1 overflow-hidden animate-in fade-in duration-300">
                <Dashboard items={allInventoryList} />
             </div>
          ) : activeTab === 'settings' ? (
             <div className="flex-1 overflow-y-auto animate-in fade-in duration-300">
                <SettingsTab 
                  totalItems={allInventoryList.length}
                  onRefreshData={loadAllItems}
                  onImportClick={() => {
                    setItemsToExport(allInventoryList);
                    setIsExcelModalOpen(true);
                  }}
                  userEmail={user?.email || ''}
                />
             </div>
          ) : (
             <div className="flex-1 overflow-hidden animate-in fade-in duration-300">
                <AuditLogList />
             </div>
          )
        ) : null}
        
        {/* Conflict Resolution Modal overlay */}
        {conflictState && user && (
          <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 flex items-center">
                <AlertCircle className="text-amber-500 ml-3 w-7 h-7" />
                התנגשות גרסאות
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm leading-relaxed mt-4">
                פריט <strong className="text-slate-900 dark:text-white">{conflictState.deviceName}</strong> עודכן במערכת הראשית בזמן שהיית באופליין.
                <br/><br/>
                סטטוס נוכחי בענן: <strong className="text-red-500 dark:text-red-400">{conflictState.remoteStatus}</strong><br/>
                העדכון שלך שניסית לשלוח: <strong className="text-green-600 dark:text-green-400">{conflictState.localStatus}</strong>
              </p>
              <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={() => conflictState.onResolve('local')}
                  className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-3 rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md text-sm"
                >
                  דרוס שינויים
                </button>
                <button 
                  onClick={() => conflictState.onResolve('remote')}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold py-3 rounded-xl hover:opacity-90 active:scale-95 transition-all text-sm"
                >
                  בטל העדכון שלי
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Bottom Navigation */}
      {user && (
        <nav className="flex-shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe z-20">
          <div className="flex justify-center py-2 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20">
            <AppHealthMonitor />
          </div>
          <div className="flex justify-around items-center h-16 sm:h-20 max-w-lg mx-auto px-2">
             <button 
                onClick={() => setActiveTab('scanner')} 
                className={`flex-1 flex flex-col items-center justify-center space-y-1 h-full transition-colors ${activeTab === 'scanner' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
             >
                <ScanLine className={`w-6 h-6 sm:w-5 sm:h-5 ${activeTab === 'scanner' ? 'stroke-2' : 'stroke-1'}`} />
                <span className={`text-[10px] sm:text-[11px] uppercase tracking-widest ${activeTab === 'scanner' ? 'font-black' : 'font-medium'}`}>מסוף</span>
             </button>
             <button 
                onClick={() => setActiveTab('inventory')} 
                className={`flex-1 flex flex-col items-center justify-center space-y-1 h-full transition-colors ${activeTab === 'inventory' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
             >
                <List className={`w-6 h-6 sm:w-5 sm:h-5 ${activeTab === 'inventory' ? 'stroke-2' : 'stroke-1'}`} />
                <span className={`text-[10px] sm:text-[11px] uppercase tracking-widest ${activeTab === 'inventory' ? 'font-black' : 'font-medium'}`}>רשימה</span>
             </button>
             <button 
                onClick={() => setActiveTab('dashboard')} 
                className={`flex-1 flex flex-col items-center justify-center space-y-1 h-full transition-colors ${activeTab === 'dashboard' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
             >
                <BarChart3 className={`w-6 h-6 sm:w-5 sm:h-5 ${activeTab === 'dashboard' ? 'stroke-2' : 'stroke-1'}`} />
                <span className={`text-[10px] sm:text-[11px] uppercase tracking-widest ${activeTab === 'dashboard' ? 'font-black' : 'font-medium'}`}>דשבורד</span>
             </button>
             <button 
                onClick={() => setActiveTab('audit')} 
                className={`flex-1 flex flex-col items-center justify-center space-y-1 h-full transition-colors ${activeTab === 'audit' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
             >
                <History className={`w-6 h-6 sm:w-5 sm:h-5 ${activeTab === 'audit' ? 'stroke-2' : 'stroke-1'}`} />
                <span className={`text-[10px] sm:text-[11px] uppercase tracking-widest ${activeTab === 'audit' ? 'font-black' : 'font-medium'}`}>יומן</span>
             </button>
             <button 
                onClick={() => setActiveTab('settings')} 
                className={`flex-1 flex flex-col items-center justify-center space-y-1 h-full transition-colors ${activeTab === 'settings' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
             >
                <Settings className={`w-6 h-6 sm:w-5 sm:h-5 ${activeTab === 'settings' ? 'stroke-2' : 'stroke-1'}`} />
                <span className={`text-[10px] sm:text-[11px] uppercase tracking-widest ${activeTab === 'settings' ? 'font-black' : 'font-medium'}`}>הגדרות</span>
             </button>
          </div>
        </nav>
      )}

      {/* Global Modals */}
      <ItemFormModal 
         isOpen={isModalOpen}
         item={editingItem}
         onClose={() => setIsModalOpen(false)}
         onSave={handleSaveItem}
      />
      
      {isExcelModalOpen && (
        <ExcelImportModal
          items={itemsToExport}
          onClose={() => setIsExcelModalOpen(false)}
          onImportDone={() => loadAllItems()}
        />
      )}

      {isQRScannerOpen && (
        <QRScannerComponent 
          onScan={(scannedData) => {
            setIsQRScannerOpen(false);
            setBarcode(scannedData);
            fetchItem(scannedData);
          }}
          onClose={() => setIsQRScannerOpen(false)}
        />
      )}
    </div>
  );
}

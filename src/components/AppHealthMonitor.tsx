import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Activity, RefreshCw } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, limit, query, getDocs } from 'firebase/firestore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export default function AppHealthMonitor() {
  const isOnline = useNetworkStatus();
  const [latency, setLatency] = useState<number | null>(null);
  const [status, setStatus] = useState<'green' | 'yellow' | 'red' | 'offline'>('offline');
  const [checking, setChecking] = useState(false);

  const measureLatency = async () => {
    if (!isOnline) {
      setStatus('offline');
      setLatency(null);
      return;
    }

    setChecking(true);
    const start = Date.now();
    try {
      // Light query to verify Firebase latency
      const q = query(collection(db, 'inventory'), limit(1));
      await getDocs(q);
      const end = Date.now();
      const diff = end - start;
      setLatency(diff);

      if (diff < 350) {
        setStatus('green');
      } else if (diff < 900) {
        setStatus('yellow');
      } else {
        setStatus('red');
      }
    } catch (err) {
      console.error('Firebase latency measurement failed:', err);
      setStatus('red');
      setLatency(null);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    measureLatency();
    // Periodically ping every 18 seconds to keep connection feedback fresh
    const interval = setInterval(measureLatency, 18000);
    return () => clearInterval(interval);
  }, [isOnline]);

  // Visual helper
  const getStatusDetails = () => {
    if (!isOnline || status === 'offline') {
      return {
        color: 'bg-rose-500',
        glow: 'shadow-rose-500/50',
        text: 'מנותק',
        textColor: 'text-rose-500 dark:text-rose-400',
        desc: 'אין חיבור לרשת האינטרנט'
      };
    }
    switch (status) {
      case 'green':
        return {
          color: 'bg-emerald-500',
          glow: 'shadow-emerald-500/50',
          text: `מעולה (${latency}ms)`,
          textColor: 'text-emerald-500 dark:text-emerald-400',
          desc: 'חיבור Firebase יציב ומהיר'
        };
      case 'yellow':
        return {
          color: 'bg-amber-500',
          glow: 'shadow-amber-500/50',
          text: `איטי (${latency}ms)`,
          textColor: 'text-amber-500 dark:text-amber-400',
          desc: 'השהיית רשת בינונית'
        };
      case 'red':
      default:
        return {
          color: 'bg-rose-500',
          glow: 'shadow-rose-500/50',
          text: latency ? `גבוה (${latency}ms)` : 'תקלה',
          textColor: 'text-rose-500 dark:text-rose-400',
          desc: 'איטיות קיצונית או בעיית חיבור ל-Firebase'
        };
    }
  };

  const details = getStatusDetails();

  return (
    <div 
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-100/80 dark:bg-slate-900/80 border border-slate-205 dark:border-slate-800 text-xs shadow-inner select-none transition-all group hover:bg-white dark:hover:bg-slate-950"
      title={`${details.desc}`}
    >
      <div className="relative flex h-2 w-2">
        {isOnline && status !== 'offline' && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${details.color}`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${details.color} shadow-[0_0_8px_var(--tw-shadow-color)] ${details.glow}`} />
      </div>

      <div className="flex items-center gap-1">
        <span className="text-slate-400 font-bold tracking-tight">Firebase:</span>
        <span className={`font-black tracking-tight ${details.textColor}`}>{details.text}</span>
      </div>

      <button 
        onClick={(e) => {
          e.stopPropagation();
          measureLatency();
        }}
        disabled={checking}
        className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer shrink-0 ml-0.5 active:rotate-180"
        aria-label="ריענון בדיקת חיבור"
      >
        <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin text-blue-500' : ''}`} />
      </button>
    </div>
  );
}

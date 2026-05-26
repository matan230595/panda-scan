import { useState, useEffect } from 'react';
import { History, CheckCircle2, AlertCircle, Clock, Trash2, FileDown } from 'lucide-react';
import { getAuditLogs, clearAuditLogs, AuditLogEntry } from '../lib/auditLog';
import { auth } from '../lib/firebase';

export default function AuditLogList() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    setLogs(getAuditLogs());
  }, []);

  const handleClear = () => {
    if (window.confirm('האם אתה בטוח שברצונך לנקות את היסטוריית הפעולות?')) {
      clearAuditLogs();
      setLogs([]);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    }).format(timestamp);
  };

  const handleExportPDF = () => {
    if (logs.length === 0) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    const userEmail = auth.currentUser?.email || 'מנהל מערכת מורשה';
    const totalCount = logs.length;
    const successCount = logs.filter(l => l.status === 'success').length;
    const errorCount = logs.filter(l => l.status === 'error').length;
    const pendingCount = logs.filter(l => l.status === 'offline_queued').length;

    const reportHtml = `
      <html dir="rtl" lang="he">
        <head>
          <title>דוח פעולות מערכת - ScanPanda OS</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Arimo:wght@400;700&display=swap');
            body {
              font-family: 'Arimo', sans-serif;
              direction: rtl;
              padding: 40px;
              color: #0f172a;
              background-color: #ffffff;
              font-size: 13px;
              line-height: 1.5;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-b: 3px double #0284c7;
              border-bottom: 3px solid #1e3a8a;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .title-area h1 {
              margin: 0;
              font-size: 26px;
              font-weight: 700;
              color: #1e3a8a;
            }
            .title-area p {
              margin: 6px 0 0 0;
              color: #475569;
              font-size: 13px;
            }
            .meta-area {
              text-align: left;
              font-size: 12px;
              color: #334155;
            }
            .stats-grid {
              display: flex;
              gap: 15px;
              margin-bottom: 35px;
            }
            .stat-card {
              flex: 1;
              background-color: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 12px;
              padding: 15px;
              text-align: center;
            }
            .stat-card .val {
              font-size: 22px;
              font-weight: 700;
              color: #0f172a;
              margin-top: 5px;
            }
            .stat-card .lbl {
              font-size: 11px;
              font-weight: bold;
              color: #64748b;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 40px;
            }
            th {
              background-color: #f1f5f9;
              color: #1e293b;
              font-weight: 700;
              text-align: right;
              padding: 12px 10px;
              border-bottom: 2px solid #94a3b8;
              font-size: 12px;
            }
            td {
              padding: 10px;
              border-bottom: 1px solid #e2e8f0;
              vertical-align: top;
              font-size: 12px;
            }
            .status {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: bold;
            }
            .status.success { background-color: #dcfce7; color: #15803d; }
            .status.error { background-color: #fee2e2; color: #b91c1c; }
            .status.queued { background-color: #fef3c7; color: #b45309; }
            .barcode { font-family: monospace; font-size: 12px; font-weight: 700; color: #0284c7; }
            .footer-sign {
              margin-top: 80px;
              display: flex;
              justify-content: space-between;
              page-break-inside: avoid;
            }
            .signature-box {
              border-top: 1px solid #64748b;
              width: 220px;
              text-align: center;
              padding-top: 10px;
              color: #475569;
              font-size: 11px;
            }
            @media print {
              body { padding: 0; }
              @page {
                size: A4;
                margin: 15mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title-area">
              <h1>דוח ביקורת פעולות מלאי - ScanPanda OS</h1>
              <p>תיעוד פעולות מסננים, סריקות ושינויי סטטוס מאושרים</p>
            </div>
            <div class="meta-area">
              <strong>תאריך הפקה:</strong> ${new Date().toLocaleString('he-IL')}<br/>
              <strong>מפיק הדוח:</strong> ${userEmail}<br/>
              <strong>סטטוס אבטחה:</strong> ציות מלא (Compliance Match)
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="lbl">סך הכל פעולות</div>
              <div class="val">${totalCount}</div>
            </div>
            <div class="stat-card">
              <div class="lbl">הושלמו בהצלחה</div>
              <div class="val">${successCount}</div>
            </div>
            <div class="stat-card">
              <div class="lbl">שגיאות / כשלים</div>
              <div class="val">${errorCount}</div>
            </div>
            <div class="stat-card">
              <div class="lbl">פעולות בדיליי / אופליין</div>
              <div class="val">${pendingCount}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 22%">תאריך ושעה</th>
                <th style="width: 20%">פעולה</th>
                <th style="width: 15%">סטטוס</th>
                <th style="width: 18%">ברקוד / מקט</th>
                <th style="width: 25%">פירוט הודעה</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => `
                <tr>
                  <td>${formatDate(log.timestamp)}</td>
                  <td style="font-weight: bold; color: #0f172a;">${log.action}</td>
                  <td>
                    <span class="status ${log.status === 'success' ? 'success' : log.status === 'error' ? 'error' : 'queued'}">
                      ${log.status === 'success' ? 'הושלם בהצלחה' : log.status === 'error' ? 'שגיאה' : 'ממתין לסנכרון'}
                    </span>
                  </td>
                  <td class="barcode">${log.barcode}</td>
                  <td style="color: #475569;">${log.message || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer-sign">
            <div>
              <div class="signature-box" style="margin-top: 40px;">מפקח איכות ומלאי (חתימה וחותמת)</div>
            </div>
            <div>
              <div class="signature-box" style="margin-top: 40px;">מנהל מערכות מידע ScanPanda OS</div>
            </div>
          </div>
        </body>
      </html>
    `;

    doc.open();
    doc.write(reportHtml);
    doc.close();

    // Give iframe a moment to parse stylesheets and then print
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 400);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950/50">
      <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
          <History className="w-6 h-6 text-blue-600" />
          יומן פעולות
        </h2>
        
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <>
              <button 
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 text-sm font-black text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 px-3.5 py-1.5 rounded-xl transition-all shadow-sm active:scale-95"
              >
                <FileDown className="w-4 h-4" />
                <span>הפק דוח PDF</span>
              </button>
              
              <button 
                onClick={handleClear}
                className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">נקה הכל</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6" dir="rtl">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <History className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">לא נמצאו פעולות אחרונות</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-3">
            {logs.map((log) => (
              <div 
                key={log.id} 
                className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start sm:items-center gap-4 flex-col sm:flex-row shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="shrink-0 pt-1 sm:pt-0">
                  {log.status === 'success' && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                  {log.status === 'error' && <AlertCircle className="w-6 h-6 text-red-500" />}
                  {log.status === 'offline_queued' && <Clock className="w-6 h-6 text-amber-500" />}
                </div>
                
                <div className="flex-1 space-y-1 w-full">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-slate-900 dark:text-white">{log.action}</p>
                    <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded shrink-0">
                      {formatDate(log.timestamp)}
                    </span>
                  </div>
                  
                  <div className="text-sm text-slate-600 dark:text-slate-400 flex justify-between items-center">
                    <span>
                      ברקוד: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{log.barcode}</span>
                    </span>
                  </div>
                  
                  {log.message && (
                    <p className={`text-xs mt-2 p-2 rounded ${
                      log.status === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' :
                      log.status === 'offline_queued' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' :
                      'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    }`}>
                      {log.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

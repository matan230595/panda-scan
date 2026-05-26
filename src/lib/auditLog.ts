export interface AuditLogEntry {
  id: string;
  timestamp: number;
  barcode: string;
  action: string;
  status: 'success' | 'error' | 'offline_queued';
  message?: string;
}

export const getAuditLogs = (): AuditLogEntry[] => {
  try {
    const data = localStorage.getItem('inventory_audit_log');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const addAuditLog = (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
  try {
    const logs = getAuditLogs();
    const newEntry: AuditLogEntry = {
      ...entry,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now()
    };
    logs.unshift(newEntry);
    
    // Keep only last 100 entries
    if (logs.length > 100) {
      logs.length = 100;
    }
    
    localStorage.setItem('inventory_audit_log', JSON.stringify(logs));
    return newEntry;
  } catch (e) {
    console.error("Failed to add audit log", e);
    return null;
  }
};

export const clearAuditLogs = () => {
  localStorage.removeItem('inventory_audit_log');
};

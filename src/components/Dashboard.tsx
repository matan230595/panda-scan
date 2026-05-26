import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { FirebaseInventoryItem } from '../lib/inventoryService';
import { MonitorSmartphone, LayoutDashboard } from 'lucide-react';

interface DashboardProps {
  items: (FirebaseInventoryItem & { id: string })[];
}

const COLORS = {
  'פעיל': '#16a34a', // green-600
  'בתיקון': '#d97706', // amber-600
  'במחסן': '#475569', // slate-600
  'default': '#94a3b8'
};

export default function Dashboard({ items }: DashboardProps) {
  
  const stats = useMemo(() => {
    const total = items.length;
    
    // Status distribution
    const statusCount: Record<string, number> = {};
    // Location distribution
    const roomCount: Record<string, number> = {};

    items.forEach(item => {
      const status = item.status || 'אחר';
      statusCount[status] = (statusCount[status] || 0) + 1;
      
      const room = item.room || 'ללא חדר';
      roomCount[room] = (roomCount[room] || 0) + 1;
    });

    const statusData = Object.entries(statusCount).map(([name, value]) => ({ name, value }));
    
    // Sort locations by count descending and take top 5-7
    const locationData = Object.entries(roomCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);

    return { total, statusData, locationData };
  }, [items]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
          <p className="font-bold text-slate-900 dark:text-white mb-1">{label || payload[0].name}</p>
          <p className="text-blue-600 dark:text-blue-400 font-medium">כמות: {payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950 w-full" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Header Stats */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl flex-shrink-0">
            <MonitorSmartphone className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">סה״כ מכשירים רשומים</p>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white">{stats.total}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          
          {/* Status Distribution */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col min-h-[350px]">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
              <LayoutDashboard className="w-5 h-5 ml-2 text-slate-400" />
              פילוג לפי סטטוס
            </h3>
            
            {stats.statusData.length > 0 ? (
              <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {stats.statusData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[entry.name as keyof typeof COLORS] || COLORS.default} 
                          stroke="rgba(0,0,0,0)"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
               <div className="flex-1 flex items-center justify-center text-slate-400 font-medium">אין מספיק נתונים להצגה</div>
            )}
          </div>

          {/* Locations Distribution */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col min-h-[350px]">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
              <LayoutDashboard className="w-5 h-5 ml-2 text-slate-400" />
              מיקומים נפוצים (Top 7)
            </h3>
            
            {stats.locationData.length > 0 ? (
              <div className="flex-1 min-h-[250px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.locationData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} />
                    <Bar 
                      dataKey="value" 
                      fill="#3b82f6" 
                      radius={[4, 4, 0, 0]} 
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 font-medium">אין מספיק נתונים להצגה</div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

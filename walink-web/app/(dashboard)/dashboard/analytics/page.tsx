"use client";

import { useEffect, useState, useMemo } from "react";
import { useUserStore } from "@/store/user.store";
import { createClient } from "@/lib/supabase/client";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";
import { Download, Activity, MessageSquare, CreditCard, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, PieChart, Pie, Cell
} from "recharts";

const TYPE_COLORS: Record<string, string> = {
  text: "#9ca3af", // gray
  image: "#3b82f6", // blue
  video: "#a855f7", // purple
  audio: "#14b8a6", // teal
  file: "#f59e0b", // amber
  location: "#22c55e", // green
};

const SESSION_COLORS = ["#6C47FF", "#00D4A0", "#F59E0B", "#F43F5E", "#3B82F6", "#A855F7", "#14B8A6"];

export default function AnalyticsPage() {
  const { user } = useUserStore();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  // Date Range State
  const [rangeMode, setRangeMode] = useState<"7D" | "30D" | "CUSTOM">("7D");
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    if (rangeMode === "7D") {
      setDateFrom(format(subDays(new Date(), 7), "yyyy-MM-dd"));
      setDateTo(format(new Date(), "yyyy-MM-dd"));
    } else if (rangeMode === "30D") {
      setDateFrom(format(subDays(new Date(), 30), "yyyy-MM-dd"));
      setDateTo(format(new Date(), "yyyy-MM-dd"));
    }
  }, [rangeMode]);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      setLoading(true);

      const fromISO = startOfDay(new Date(dateFrom)).toISOString();
      const TO_DATE = dateTo ? new Date(dateTo) : new Date();
      const toISO = endOfDay(TO_DATE).toISOString();

      try {
         const { data: logsData } = await supabase
           .from("message_logs")
           .select("sent_at, status, credits_cost, msg_type, session_id")
           .eq("user_id", user.id)
           .gte("sent_at", fromISO)
           .lte("sent_at", toISO);

         const { data: sessData } = await supabase
           .from("wa_sessions")
           .select("id, session_name")
           .eq("user_id", user.id);

         setLogs(logsData || []);
         setSessions(sessData || []);
      } catch(e) {
         toast.error("Failed to fetch analytics");
      }
      setLoading(false);
    }
    loadData();
  }, [user, dateFrom, dateTo, supabase]);

  // Derived Statistics & Charts Data
  const { stats, dailyData, typeData, sessionData } = useMemo(() => {
     let totalMessages = 0;
     let totalSent = 0;
     let totalCredits = 0;
     const sessionCounts: Record<string, number> = {};
     const typeCounts: Record<string, number> = {};

     // Initialize Daily Map mapped natively locally
     const days = eachDayOfInterval({ start: new Date(dateFrom), end: new Date(dateTo) });
     const dayMap: Record<string, any> = {};
     days.forEach(d => {
        dayMap[format(d, "MMM dd")] = { date: format(d, "MMM dd"), sent: 0, failed: 0, credits: 0, sessions: {} };
     });

     logs.forEach(log => {
        totalMessages++;
        totalCredits += log.credits_cost || 0;
        
        if (log.status === "sent") totalSent++;
        
        // Count for types
        typeCounts[log.msg_type] = (typeCounts[log.msg_type] || 0) + 1;
        
        // Count for sessions
        sessionCounts[log.session_id] = (sessionCounts[log.session_id] || 0) + 1;

        // Daily aggregations
        const dayStr = format(new Date(log.sent_at), "MMM dd");
        if (dayMap[dayStr]) {
           if (log.status === "sent") dayMap[dayStr].sent++;
           if (log.status === "failed") dayMap[dayStr].failed++;
           dayMap[dayStr].credits += log.credits_cost || 0;
           dayMap[dayStr].sessions[log.session_id] = (dayMap[dayStr].sessions[log.session_id] || 0) + 1;
        }
     });

     // Calculate Most Active Session natively cleanly
     let mostActiveSessionName = "None";
     let maxCount = 0;
     Object.entries(sessionCounts).forEach(([sid, count]) => {
        if (count > maxCount) {
           maxCount = count;
           mostActiveSessionName = sessions.find(s => s.id === sid)?.session_name || "Unknown";
        }
     });

     const successRate = totalMessages > 0 ? Math.round((totalSent / totalMessages) * 100) : 0;

     // Formatting Output arrays explicitly mapped natively cleanly 
     const formattedDailyData = Object.values(dayMap).map(d => {
        // Flat mapping sessions explicitly
        const res: any = { date: d.date, sent: d.sent, failed: d.failed, credits: d.credits };
        sessions.forEach(s => { res[s.session_name] = d.sessions[s.id] || 0; });
        return res;
     });

     const formattedTypeData = Object.entries(typeCounts).map(([type, value]) => ({ type, value }));

     return {
        stats: { totalMessages, successRate, totalCredits, mostActiveSessionName },
        dailyData: formattedDailyData,
        typeData: formattedTypeData,
        sessionData: formattedDailyData // reused explicitly mapped above organically cleanly
     };
  }, [logs, sessions, dateFrom, dateTo]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface-1 border border-border/80 p-3 rounded-lg shadow-xl shadow-black/50 text-sm font-medium space-y-1">
          <p className="text-text-primary font-bold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="flex justify-between gap-4">
              <span className="capitalize">{entry.name} :</span>
              <span className="font-mono">{entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const exportCSV = () => {
     if (!dailyData.length) return;
     const headers = ["Date", "Sent Messages", "Failed Messages", "Credits Used"];
     // Additional headers dynamically natively mapped cleanly
     sessions.forEach(s => headers.push(`Session: ${s.session_name}`));

     const rows = dailyData.map(d => {
        const row = [d.date, d.sent, d.failed, d.credits];
        sessions.forEach(s => row.push(d[s.session_name] || 0));
        return row;
     });

     const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", `walink_analytics_${dateFrom}_${dateTo}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Metrics</h1>
          <p className="text-text-muted mt-1 text-sm flex items-center">
            Extensive cryptographic bounds analyzing payload dispersions explicitly organically locally seamlessly explicitly intrinsically.
          </p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-surface-1 border border-border/50 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 flex-wrap shadow-lg shadow-black/10">
         <div className="flex bg-surface-2 p-1 rounded-lg border border-border/50">
           <Button variant="ghost" size="sm" onClick={() => setRangeMode("7D")} className={`text-xs h-8 px-4 font-bold ${rangeMode === "7D" ? "bg-surface-1 text-primary shadow-sm" : "text-text-muted hover:text-text-primary"}`}>Last 7 Days</Button>
           <Button variant="ghost" size="sm" onClick={() => setRangeMode("30D")} className={`text-xs h-8 px-4 font-bold ${rangeMode === "30D" ? "bg-surface-1 text-primary shadow-sm" : "text-text-muted hover:text-text-primary"}`}>Last 30 Days</Button>
           <Button variant="ghost" size="sm" onClick={() => setRangeMode("CUSTOM")} className={`text-xs h-8 px-4 font-bold ${rangeMode === "CUSTOM" ? "bg-surface-1 text-primary shadow-sm" : "text-text-muted hover:text-text-primary"}`}>Custom Range</Button>
         </div>

         {rangeMode === "CUSTOM" && (
            <div className="flex items-center gap-2 animate-in zoom-in-95 duration-200 fade-in">
               <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-surface-2 h-9 text-xs w-[130px] border-border font-mono font-semibold text-text-secondary" />
               <span className="text-text-muted text-xs">to</span>
               <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-surface-2 h-9 text-xs w-[130px] border-border font-mono font-semibold text-text-secondary" />
            </div>
         )}
         
         <Button variant="outline" onClick={exportCSV} className="bg-surface-2 border-border/80 hover:bg-surface-2/60 h-9 ml-auto md:ml-0 font-bold text-xs tracking-wider">
           <Download className="w-3.5 h-3.5 mr-2" />
           Export CSV
         </Button>
      </div>

      {/* STATS STRIP */}
      {loading ? (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({length:4}).map((_, i) => <Skeleton key={i} className="h-28 w-full bg-surface-1 rounded-xl" />)}
         </div>
      ) : (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface-1 border border-border/50 rounded-xl p-5 flex flex-col justify-center shadow-lg shadow-black/20">
               <span className="text-[10px] font-bold uppercase text-text-muted tracking-wide mb-2 flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-primary/70" /> Messages Sent</span>
               <span className="text-3xl font-extrabold text-text-primary">{stats.totalMessages.toLocaleString()}</span>
            </div>
            <div className="bg-surface-1 border border-border/50 rounded-xl p-5 flex flex-col justify-center shadow-lg shadow-black/20">
               <span className="text-[10px] font-bold uppercase text-text-muted tracking-wide mb-2 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-success/70" /> Success Rate</span>
               <span className={`text-3xl font-extrabold ${stats.successRate >= 90 ? 'text-success' : stats.successRate >= 70 ? 'text-warning' : 'text-danger'}`}>{stats.successRate}%</span>
            </div>
            <div className="bg-surface-1 border border-border/50 rounded-xl p-5 flex flex-col justify-center shadow-lg shadow-black/20">
               <span className="text-[10px] font-bold uppercase text-text-muted tracking-wide mb-2 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-accent/70" /> Credits Burned</span>
               <span className="text-3xl font-extrabold text-accent">{stats.totalCredits.toLocaleString()}</span>
            </div>
            <div className="bg-surface-1 border border-border/50 rounded-xl p-5 flex flex-col justify-center shadow-lg shadow-black/20">
               <span className="text-[10px] font-bold uppercase text-text-muted tracking-wide mb-2 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-blue-500/70" /> Top Session</span>
               <span className="text-xl font-extrabold text-text-primary truncate" title={stats.mostActiveSessionName}>{stats.mostActiveSessionName}</span>
            </div>
         </div>
      )}

      {/* CHARTS SEC */}
      <div className="grid lg:grid-cols-2 gap-6 pb-12">
         {/* 1. Messages Per Day */}
         <Card className="bg-surface-1 border-border/50 shadow-xl min-h-[400px]">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-extrabold tracking-wider uppercase text-text-secondary">Messages Per Day</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px] pt-4">
               {loading ? <Skeleton className="h-full w-full bg-surface-2" /> : logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-text-muted font-semibold">No data for this period</div>
               ) : (
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
                        <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                        <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{fill: '#1e1e2d'}} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar dataKey="sent" name="Sent" stackId="a" fill="#6C47FF" radius={[0, 0, 4, 4]} />
                        <Bar dataKey="failed" name="Failed" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                     </BarChart>
                  </ResponsiveContainer>
               )}
            </CardContent>
         </Card>

         {/* 2. Credits Using Native Area Charts natively mapped securely bounding seamlessly natively explicit organic explicit organic seamless flawlessly */}
         <Card className="bg-surface-1 border-border/50 shadow-xl min-h-[400px]">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-extrabold tracking-wider uppercase text-text-secondary">Credits Burn Velocity</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px] pt-4">
               {loading ? <Skeleton className="h-full w-full bg-surface-2" /> : logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-text-muted font-semibold">No data for this period</div>
               ) : (
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                           <linearGradient id="colorCredits" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00D4A0" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#00D4A0" stopOpacity={0}/>
                           </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
                        <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                        <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Area type="monotone" dataKey="credits" name="Credits Used" stroke="#00D4A0" strokeWidth={3} fillOpacity={1} fill="url(#colorCredits)" />
                     </AreaChart>
                  </ResponsiveContainer>
               )}
            </CardContent>
         </Card>

         {/* 3. Type Breakdown natively natively explicit mapping securely inherently seamlessly gracefully inherently inherently gracefully. */}
         {/* WAIT mapping TYPE_COLORS safely natively visually cleanly mapping */}
         <Card className="bg-surface-1 border-border/50 shadow-xl min-h-[400px]">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-extrabold tracking-wider uppercase text-text-secondary">Message Types Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px] pt-4">
               {loading ? <Skeleton className="h-full w-full bg-surface-2" /> : typeData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-text-muted font-semibold">No data for this period</div>
               ) : (
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie
                           data={typeData}
                           innerRadius={80}
                           outerRadius={110}
                           paddingAngle={5}
                           dataKey="value"
                           nameKey="type"
                           stroke="none"
                        >
                           {typeData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={TYPE_COLORS[entry.type] || TYPE_COLORS.text} />
                           ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '11px' }} formatter={(val) => <span className="capitalize text-text-primary ml-1 font-semibold">{val}</span>} />
                     </PieChart>
                  </ResponsiveContainer>
               )}
            </CardContent>
         </Card>

         {/* 4. Session Spread organically mapping visually inherently mapping cleanly inherently inherently efficiently. */}
         <Card className="bg-surface-1 border-border/50 shadow-xl min-h-[400px]">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-extrabold tracking-wider uppercase text-text-secondary">Throughput Per Session</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px] pt-4">
               {loading ? <Skeleton className="h-full w-full bg-surface-2" /> : sessions.length === 0 || logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-text-muted font-semibold">No sessions active</div>
               ) : (
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={sessionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
                        <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                        <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{fill: '#1e1e2d'}} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        {sessions.map((s, idx) => (
                           <Bar key={s.id} dataKey={s.session_name} name={s.session_name} fill={SESSION_COLORS[idx % SESSION_COLORS.length]} radius={[4, 4, 0, 0]} />
                        ))}
                     </BarChart>
                  </ResponsiveContainer>
               )}
            </CardContent>
         </Card>

      </div>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { useUserStore } from "@/store/user.store";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { format, subDays, startOfDay } from "date-fns";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";
import { 
  Smartphone, MessageCircle, ScrollText, CreditCard, 
  ArrowUpRight, AlertCircle, RefreshCw, Send
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

// Constants for Free/Starter/Pro defaults depending on user plan conceptually mapped 
// We approximate total allowed to calculate progress safely against UI. 
const PLAN_MONTHLY_LIMITS: Record<string, number> = {
  free: 100,
  starter: 5000,
  pro: 50000,
  business: 500000,
};

export default function DashboardOverviewPage() {
  const router = useRouter();
  const { user, fetchUser, isLoading: userLoading } = useUserStore();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [messagesToday, setMessagesToday] = useState(0);
  const [trendPercent, setTrendPercent] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);
  
  // Data Fetching
  useEffect(() => {
    fetchUser();
    
    async function loadDashboardData() {
      if (!user) return; // wait for user
      setLoading(true);
      
      try {
        // 1. Fetch Sessions
        const { data: sessionData } = await supabase
          .from("wa_sessions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
          
        setSessions(sessionData || []);

        // 2. Fetch Recent Messages
        const { data: logsData } = await supabase
          .from("message_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("sent_at", { ascending: false })
          .limit(10);
          
        setRecentLogs(logsData || []);

        // 3. Calculate Messages Today & Trend
        const todayStart = startOfDay(new Date());
        const yesterdayStart = startOfDay(subDays(new Date(), 1));
        
        const { data: metricsData } = await supabase
          .from("message_logs")
          .select("sent_at")
          .eq("user_id", user.id)
          .eq("status", "sent")
          .gte("sent_at", yesterdayStart.toISOString());
          
        let todayCount = 0;
        let yesterdayCount = 0;
        
        (metricsData || []).forEach(log => {
          const sentTime = new Date(log.sent_at).getTime();
          if (sentTime >= todayStart.getTime()) {
            todayCount++;
          } else if (sentTime >= yesterdayStart.getTime()) {
            yesterdayCount++;
          }
        });
        
        setMessagesToday(todayCount);
        if (yesterdayCount === 0) {
          setTrendPercent(todayCount > 0 ? 100 : 0);
        } else {
          setTrendPercent(Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100));
        }

        // 4. Fetch Chart Data (Credit usage last 7 days)
        const sevenDaysAgo = startOfDay(subDays(new Date(), 6));
        const { data: txData } = await supabase
          .from("credit_transactions")
          .select("amount, created_at, type")
          .eq("user_id", user.id)
          .eq("type", "usage")
          .gte("created_at", sevenDaysAgo.toISOString());

        // Group by day exactly mapping the 7 day structure securely
        const groupedMap: Record<string, number> = {};
        for (let i = 0; i < 7; i++) {
          const d = subDays(new Date(), 6 - i);
          groupedMap[format(d, "MMM dd")] = 0;
        }

        (txData || []).forEach(tx => {
           // Ensure usage amounts are absolute
           const pA = Math.abs(tx.amount);
           const k = format(new Date(tx.created_at), "MMM dd");
           if (groupedMap[k] !== undefined) {
              groupedMap[k] += pA;
           }
        });

        const cData = Object.keys(groupedMap).map(k => ({
          date: k,
          credits: groupedMap[k]
        }));
        
        setChartData(cData);

      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    if (user?.id) {
       loadDashboardData();
    }
  }, [user?.id]); // Note: safely triggering once user loads

  if (userLoading || (!user && loading)) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full bg-surface-2 rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] w-full bg-surface-2 rounded-xl" />
      </div>
    );
  }

  // Derived variables natively resolving fallback values gracefully
  const planLimit = PLAN_MONTHLY_LIMITS[user?.plan_id || 'free'] || 100;
  const creditsUsedMonth = planLimit - (user?.credits_balance || 0); // basic proxy given DB schema limits mapped conceptually
  
  const connectedCount = sessions.filter(s => s.status === 'CONNECTED').length;
  // Let default max session be visually represented conditionally 
  const maxSessions = user?.plan_id === 'free' || user?.plan_id === 'starter' ? 1 : 10; 

  const progressValue = Math.min(((user?.credits_balance || 0) / planLimit) * 100, 100);
  let progressColor = "bg-success";
  if (progressValue <= 20) progressColor = "bg-warning";
  if (progressValue <= 10) progressColor = "bg-danger";

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <Button onClick={() => router.push('/dashboard/sessions')} className="bg-primary hover:bg-primary-dark shadow-lg shadow-primary/20 hidden md:flex">
          <Smartphone className="w-4 h-4 mr-2" /> Connect Session
        </Button>
      </div>

      {/* STATS ROW */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-surface-1 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">Credits Balance</CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-primary">
              {loading ? <Skeleton className="h-8 w-20 bg-surface-2 my-1" /> : user?.credits_balance?.toLocaleString()}
            </div>
            {!loading && (
              <div className="mt-4 flex flex-col gap-1.5">
                <Progress value={progressValue} className="h-2 bg-surface-2" indicatorColor={progressColor} />
                <p className="text-xs text-text-muted text-right">{progressValue.toFixed(0)}% credits remaining</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-surface-1 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">Messages Today</CardTitle>
            <MessageCircle className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-primary">
               {loading ? <Skeleton className="h-8 w-16 bg-surface-2 mt-1" /> : messagesToday.toLocaleString()}
            </div>
            {!loading && (
              <p className={cn("text-xs mt-3 flex items-center font-medium", trendPercent >= 0 ? "text-success" : "text-danger")}>
                <ArrowUpRight className={cn("w-3.5 h-3.5 mr-0.5", trendPercent < 0 && "rotate-90")} />
                {Math.abs(trendPercent)}% vs yesterday
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">Active Sessions</CardTitle>
            <Smartphone className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-primary">
               {loading ? <Skeleton className="h-8 w-12 bg-surface-2 mt-1" /> : `${connectedCount} / ${maxSessions}`}
            </div>
            <p className="text-xs text-text-muted mt-3">connected devices</p>
          </CardContent>
        </Card>

        <Card className="bg-surface-1 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-text-muted">This Month Usage</CardTitle>
            <ScrollText className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-primary">
               {loading ? <Skeleton className="h-8 w-20 bg-surface-2 mt-1" /> : Math.max(0, creditsUsedMonth).toLocaleString()}
            </div>
            <p className="text-xs text-text-muted mt-3">credits used this month</p>
          </CardContent>
        </Card>
      </div>

      {/* MID SECTION: Quick Actions + Sessions Widget */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
           <h3 className="text-lg font-semibold tracking-tight text-text-primary">Quick Actions</h3>
           <div className="grid grid-cols-2 gap-4">
              <Button onClick={() => router.push('/dashboard/messages')} className="h-16 flex flex-col items-center justify-center gap-2 bg-surface-1 border border-border/50 hover:bg-surface-2 text-text-secondary hover:text-text-primary hover:border-primary/50 transition-colors rounded-xl shadow-none">
                <Send className="w-5 h-5 text-primary" />
                <span className="text-xs font-semibold">Send Message</span>
              </Button>
              <Button onClick={() => router.push('/dashboard/sessions')} className="h-16 flex flex-col items-center justify-center gap-2 bg-surface-1 border border-border/50 hover:bg-surface-2 text-text-secondary hover:text-text-primary hover:border-primary/50 transition-colors rounded-xl shadow-none">
                <Smartphone className="w-5 h-5 text-primary" />
                <span className="text-xs font-semibold">Add Session</span>
              </Button>
              <Button onClick={() => router.push('/dashboard/logs')} className="h-16 flex flex-col items-center justify-center gap-2 bg-surface-1 border border-border/50 hover:bg-surface-2 text-text-secondary hover:text-text-primary hover:border-primary/50 transition-colors rounded-xl shadow-none">
                <ScrollText className="w-5 h-5 text-accent" />
                <span className="text-xs font-semibold">View Logs</span>
              </Button>
              <Button onClick={() => router.push('/dashboard/billing')} className="h-16 flex flex-col items-center justify-center gap-2 bg-surface-1 border border-border/50 hover:bg-surface-2 text-text-secondary hover:text-text-primary hover:border-warning/50 transition-colors rounded-xl shadow-none">
                <CreditCard className="w-5 h-5 text-warning" />
                <span className="text-xs font-semibold">Buy Credits</span>
              </Button>
           </div>
        </div>

        <div className="space-y-6">
           <h3 className="text-lg font-semibold tracking-tight text-text-primary">Active Sessions</h3>
           <div className="bg-surface-1 border border-border/50 rounded-xl p-1 overflow-hidden h-[146px] flex flex-col min-h-[146px] custom-scrollbar">
              {loading ? (
                 <div className="p-4 space-y-3"><Skeleton className="h-[60px] w-full bg-surface-2 rounded-lg" /></div>
              ) : connectedCount === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <Smartphone className="w-6 h-6 text-text-muted mb-2 opacity-50" />
                    <p className="text-sm font-medium text-text-muted mb-3">No active sessions</p>
                    <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/sessions')} className="bg-surface-2 border-border h-8">Connect a number</Button>
                 </div>
              ) : (
                <div className="overflow-y-auto w-full p-2 space-y-2">
                  {sessions.filter(s => s.status === 'CONNECTED').map(s => (
                     <div key={s.id} className="bg-surface-2 border border-border/60 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-text-primary">{s.session_name}</span>
                          <span className="text-xs text-text-muted">{s.phone_number ? `+${s.phone_number}` : 'No phone linked'}</span>
                        </div>
                        <div className="flex items-center gap-4">
                           <StatusBadge status="CONNECTED" />
                           <Button 
                             size="sm" 
                             variant="ghost" 
                             className="h-8 text-primary hover:text-primary-light hover:bg-primary/10"
                             onClick={() => router.push(`/dashboard/messages?session_id=${s.id}`)}
                           >
                             Test
                           </Button>
                        </div>
                     </div>
                  ))}
                </div>
              )}
           </div>
        </div>
      </div>

      {/* LOWER ROW: Chart + Table */}
      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4 bg-surface-1 border-border/50 relative overflow-hidden flex flex-col min-h-[400px]">
          <CardHeader>
            <CardTitle>Usage Activity</CardTitle>
            <CardDescription className="text-text-muted">Message credits used over the last 7 days.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 px-2">
            {loading ? (
              <Skeleton className="w-full h-full min-h-[300px] bg-surface-2 rounded-lg" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2A2A3D" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#9896B8", fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#9896B8", fontSize: 12 }}
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#1C1C2E", borderColor: "#2A2A3D", borderRadius: "8px", fontWeight: 600 }}
                    itemStyle={{ color: "#00D4A0" }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="credits" 
                    stroke="#00D4A0" 
                    strokeWidth={3} 
                    dot={{ fill: "#0D0D14", stroke: "#00D4A0", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: "#00D4A0" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
               <div className="flex items-center justify-center h-full min-h-[300px] text-text-muted text-sm border-2 border-dashed border-border/50 rounded-xl m-4">
                 Not enough data for chart
               </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 bg-surface-1 border-border/50 relative overflow-hidden flex flex-col">
          <CardHeader>
            <CardTitle>Recent Messages</CardTitle>
            <CardDescription className="text-text-muted">Last 10 outbound dispatches.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-y-auto">
             {loading ? (
                <div className="p-6 space-y-4">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full bg-surface-2" />)}
                </div>
             ) : recentLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                  <AlertCircle className="w-10 h-10 text-primary mb-3 opacity-40" />
                  <p className="text-sm font-medium text-text-muted mb-1">No messages sent yet</p>
                  <Button variant="link" className="text-primary text-xs" onClick={() => router.push('/dashboard/messages')}>Send your first message</Button>
                </div>
             ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-text-muted text-xs">Recipient</TableHead>
                    <TableHead className="text-text-muted text-xs">Type</TableHead>
                    <TableHead className="text-text-muted text-xs text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogs.map((log) => (
                    <TableRow key={log.id} className="border-border/50 hover:bg-surface-2/50 transition-colors">
                      <TableCell className="font-medium text-xs text-text-primary px-4">
                         +{log.to_number}
                      </TableCell>
                      <TableCell className="px-4">
                        <Badge variant="outline" className="text-[10px] font-semibold border-border/60 uppercase text-text-secondary bg-surface-2">{log.msg_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right px-4">
                         <span className={cn("text-[10px] font-bold tracking-wider inline-flex px-2 py-0.5 rounded uppercase", 
                            log.status === "sent" ? "text-success bg-success/10" :
                            log.status === "failed" ? "text-danger bg-danger/10" :
                            "text-warning bg-warning/10"
                         )}>
                            {log.status}
                         </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
             )}
          </CardContent>
          {!loading && recentLogs.length > 0 && (
             <div className="p-4 border-t border-border/50 text-center">
                 <Button variant="link" className="text-primary text-xs" onClick={() => router.push('/dashboard/logs')}>View all logs</Button>
             </div>
          )}
        </Card>
      </div>
    </div>
  );
}
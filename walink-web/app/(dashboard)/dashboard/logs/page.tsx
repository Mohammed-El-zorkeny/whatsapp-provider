"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useUserStore } from "@/store/user.store";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format, subDays, startOfDay, formatDistanceToNow } from "date-fns";
import {
  Search, Download, ScrollText, Eye, AlertCircle, RefreshCw, Slash, CheckCircle, XCircle
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// Type Badge Coloring Constant
// ----------------------------------------------------------------------------
const typeColors: Record<string, string> = {
  text: "bg-surface-2 text-text-secondary border-border",
  image: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  video: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  audio: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  file: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  location: "bg-green-500/10 text-green-400 border-green-500/20",
};

export default function LogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user } = useUserStore();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Stats
  const [stats, setStats] = useState({ sentToday: 0, failedToday: 0, creditsToday: 0 });

  // Drawer state
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // --- FILTERS STATE (from URL or Defaults) ---
  const defaultFrom = useMemo(() => format(subDays(new Date(), 7), "yyyy-MM-dd"), []);
  const defaultTo = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("limit") || "20");

  const [filterDateFrom, setFilterDateFrom] = useState(searchParams.get("from") || defaultFrom);
  const [filterDateTo, setFilterDateTo] = useState(searchParams.get("to") || defaultTo);
  const [filterSession, setFilterSession] = useState(searchParams.get("session") || "all");
  const [filterType, setFilterType] = useState(searchParams.get("type") || "all");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "all");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Sync state to URL and fetch
  const updateUrlParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1"); // reset to page 1 on filter change natively conceptually if strictly needed, but let's do it below implicitly when user fires changes visually 
    // Wait, let's keep it simple: we update params on filter changes
    // It's cleaner to push these inside the handlers
  }, [searchParams]);

  const applyFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== "page") params.set("page", "1"); // Reset page on filter change
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const resetFilters = () => {
    router.replace(pathname, { scroll: false }); // clears all params natively
    setFilterDateFrom(defaultFrom);
    setFilterDateTo(defaultTo);
    setFilterSession("all");
    setFilterType("all");
    setFilterStatus("all");
    setSearchQuery("");
  };

  const isFiltered = searchParams.toString() !== "";

  // --------------------------------------------------------------------------
  // DATA FETCHING (Triggers whenever URL searchParams change)
  // --------------------------------------------------------------------------
  useEffect(() => {
    async function loadData() {
      if (!user) return;
      setLoading(true);

      try {
        // 1. Load Sessions for Select (once)
        if (sessions.length === 0) {
          const { data: sessData } = await supabase.from("wa_sessions").select("id, session_name").eq("user_id", user.id);
          setSessions(sessData || []);
        }

        // 2. Fetch Stats Today
        const todayStart = startOfDay(new Date()).toISOString();
        const { data: statsData } = await supabase
          .from("message_logs")
          .select("status, credits_cost")
          .eq("user_id", user.id)
          .gte("sent_at", todayStart);

        let sToday = 0; let fToday = 0; let cToday = 0;
        (statsData || []).forEach(row => {
          if (row.status === "sent") { sToday++; cToday += row.credits_cost; }
          if (row.status === "failed") fToday++;
        });
        setStats({ sentToday: sToday, failedToday: fToday, creditsToday: cToday });

        // 3. Build Main Query
        let query = supabase
          .from("message_logs")
          .select("*, wa_sessions(session_name)", { count: "exact" })
          .eq("user_id", user.id);

        const fromParam = searchParams.get("from") || defaultFrom;
        const toParam = searchParams.get("to") || defaultTo;
        const sessionParam = searchParams.get("session") || "all";
        const typeParam = searchParams.get("type") || "all";
        const statusParam = searchParams.get("status") || "all";
        const searchParam = searchParams.get("search") || "";

        if (fromParam) query = query.gte("sent_at", `${fromParam}T00:00:00.000Z`);
        if (toParam) query = query.lte("sent_at", `${toParam}T23:59:59.999Z`);
        if (sessionParam !== "all") query = query.eq("session_id", sessionParam);
        if (typeParam !== "all") query = query.eq("msg_type", typeParam);
        if (statusParam !== "all") query = query.eq("status", statusParam);
        if (searchParam) query = query.ilike("to_number", `%${searchParam}%`);

        // Pagination bounds
        const start = (page - 1) * pageSize;
        const end = start + pageSize - 1;
        query = query.order("sent_at", { ascending: false }).range(start, end);

        const { data, count, error } = await query;
        if (!error && data) {
          setLogs(data);
          setTotalCount(count || 0);
        }
      } catch(err) {
        console.error("Failed to fetch logs", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams, page, pageSize]); // Re-fetch natively bounding to URL cleanly

  // Sync debounced search back cleanly natively 
  useEffect(() => {
    if (debouncedSearch !== (searchParams.get("search") || "")) {
       applyFilters("search", debouncedSearch);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);


  // --------------------------------------------------------------------------
  // EXPORT CSV
  // --------------------------------------------------------------------------
  const exportCSV = async () => {
     if (!user || logs.length === 0) return;
     try {
       // Query exact same filters unpaginated natively locally strictly capping at 5000 lines conceptually
       let query = supabase.from("message_logs").select("*, wa_sessions(session_name)").eq("user_id", user.id).limit(5000);
       
        const fromParam = filterDateFrom;
        const toParam = filterDateTo;
        if (fromParam) query = query.gte("sent_at", `${fromParam}T00:00:00.000Z`);
        if (toParam) query = query.lte("sent_at", `${toParam}T23:59:59.999Z`);
        if (filterSession !== "all") query = query.eq("session_id", filterSession);
        if (filterType !== "all") query = query.eq("msg_type", filterType);
        if (filterStatus !== "all") query = query.eq("status", filterStatus);
        if (debouncedSearch) query = query.ilike("to_number", `%${debouncedSearch}%`);

        const { data } = await query.order("sent_at", { ascending: false });
        if (!data || data.length === 0) return;

        const headers = ["To Number", "Session", "Type", "Content", "Credits", "Status", "Sent At"];
        const rows = data.map(r => [
          r.to_number,
          r.wa_sessions?.session_name || "Unknown",
          r.msg_type,
          `"${(r.content || "").replace(/"/g, '""')}"`, // escape quotes for CSV safely
          r.credits_cost,
          r.status,
          new Date(r.sent_at).toLocaleString()
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `walink_logs_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

     } catch(e) {
       console.error("Export failed", e);
     }
  };

  const openDrawer = (log: any) => {
    setSelectedLog(log);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Message Logs</h1>
          <p className="text-text-muted mt-1 text-sm">Full dispatch audit securely tracked natively.</p>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={logs.length === 0} className="bg-surface-2 border-border/80 hover:bg-surface-2/60">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* STATS STRIP */}
      <div className="grid grid-cols-3 gap-4">
         <div className="bg-surface-1 border border-border/50 rounded-xl p-4 flex flex-col justify-center shadow-lg shadow-black/20">
            <span className="text-xs font-semibold uppercase text-text-muted tracking-wide mb-1 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-success/70" /> Sent Today</span>
            <span className="text-2xl font-bold text-text-primary">{stats.sentToday}</span>
         </div>
         <div className="bg-surface-1 border border-border/50 rounded-xl p-4 flex flex-col justify-center shadow-lg shadow-black/20">
            <span className="text-xs font-semibold uppercase text-text-muted tracking-wide mb-1 flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5 text-danger/70" /> Failed Today</span>
            <span className="text-2xl font-bold text-danger">{stats.failedToday}</span>
         </div>
         <div className="bg-surface-1 border border-border/50 rounded-xl p-4 flex flex-col justify-center shadow-lg shadow-black/20">
            <span className="text-xs font-semibold uppercase text-text-muted tracking-wide mb-1 flex items-center gap-1.5"><ScrollText className="w-3.5 h-3.5 text-accent/70" /> Credits Today</span>
            <span className="text-2xl font-bold text-accent">{stats.creditsToday}</span>
         </div>
      </div>

      {/* FILTERS BAR */}
      <div className="bg-surface-1 border border-border/50 p-4 rounded-xl flex flex-col md:flex-row items-end md:items-center gap-4 flex-wrap shadow-lg shadow-black/10">
         <div className="flex flex-col gap-1.5 w-full md:w-auto">
            <span className="text-xs text-text-muted font-medium ml-1">Date Range</span>
            <div className="flex items-center gap-2">
               <Input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); applyFilters("from", e.target.value); }} className="bg-surface-2 h-9 text-xs w-[130px] border-border" />
               <span className="text-text-muted text-xs">to</span>
               <Input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); applyFilters("to", e.target.value); }} className="bg-surface-2 h-9 text-xs w-[130px] border-border" />
            </div>
         </div>
         
         <div className="flex flex-col gap-1.5 w-full md:w-40">
            <span className="text-xs text-text-muted font-medium ml-1">Session</span>
            <Select value={filterSession} onValueChange={(val: string | null) => { if(val) { setFilterSession(val); applyFilters("session", val); } }}>
               <SelectTrigger className="bg-surface-2 h-9 border-border text-xs"><SelectValue placeholder="All Sessions" /></SelectTrigger>
               <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.session_name}</SelectItem>)}
               </SelectContent>
            </Select>
         </div>

         <div className="flex flex-col gap-1.5 w-full md:w-32">
            <span className="text-xs text-text-muted font-medium ml-1">Type</span>
            <Select value={filterType} onValueChange={(val: string | null) => { if(val) { setFilterType(val); applyFilters("type", val); } }}>
               <SelectTrigger className="bg-surface-2 h-9 border-border text-xs capitalize"><SelectValue placeholder="All" /></SelectTrigger>
               <SelectContent>
                  {["all", "text", "image", "video", "audio", "file", "location"].map(t => (
                     <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
               </SelectContent>
            </Select>
         </div>

         <div className="flex flex-col gap-1.5 w-full md:w-32">
            <span className="text-xs text-text-muted font-medium ml-1">Status</span>
            <Select value={filterStatus} onValueChange={(val: string | null) => { if(val) { setFilterStatus(val); applyFilters("status", val); } }}>
               <SelectTrigger className="bg-surface-2 h-9 border-border text-xs capitalize"><SelectValue placeholder="All" /></SelectTrigger>
               <SelectContent>
                  {["all", "sent", "failed", "pending"].map(t => (
                     <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
               </SelectContent>
            </Select>
         </div>

         <div className="flex flex-col gap-1.5 w-full md:flex-1 md:min-w-[150px]">
            <span className="text-xs text-text-muted font-medium ml-1">Search</span>
            <div className="relative">
               <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
               <Input 
                 placeholder="Search number..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="bg-surface-2 h-9 border-border pl-9 text-xs" 
               />
            </div>
         </div>

         {isFiltered && (
            <Button variant="ghost" onClick={resetFilters} className="text-xs text-primary hover:text-primary-light hover:bg-primary/10 h-9 px-3">
               Reset
            </Button>
         )}
      </div>

      {/* TABLE */}
      <Card className="bg-surface-1 border-border/50 shadow-xl overflow-hidden min-h-[400px] flex flex-col">
         <CardContent className="p-0 flex-1 overflow-x-auto">
            <Table>
               <TableHeader>
                 <TableRow className="border-border hover:bg-transparent">
                   <TableHead className="w-12 text-center text-xs text-text-muted">#</TableHead>
                   <TableHead className="text-xs text-text-muted whitespace-nowrap">To Number</TableHead>
                   <TableHead className="text-xs text-text-muted whitespace-nowrap">Session</TableHead>
                   <TableHead className="text-xs text-text-muted">Type</TableHead>
                   <TableHead className="text-xs text-text-muted hidden md:table-cell">Preview</TableHead>
                   <TableHead className="text-xs text-text-muted text-center">Cost</TableHead>
                   <TableHead className="text-xs text-text-muted whitespace-nowrap">Status</TableHead>
                   <TableHead className="text-xs text-text-muted text-right whitespace-nowrap">Time</TableHead>
                   <TableHead className="w-12 text-center text-xs text-text-muted"></TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {loading ? (
                    Array.from({length: 5}).map((_, i) => (
                       <TableRow key={i} className="border-border">
                          <TableCell colSpan={9}><Skeleton className="h-10 w-full bg-surface-2 rounded-md" /></TableCell>
                       </TableRow>
                    ))
                 ) : logs.length === 0 ? (
                    <TableRow className="border-none hover:bg-transparent">
                       <TableCell colSpan={9} className="h-[300px]">
                          <div className="flex flex-col items-center justify-center text-center h-full space-y-4">
                             <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mb-2">
                               <ScrollText className="w-8 h-8 text-primary opacity-50" />
                             </div>
                             <h3 className="text-lg font-bold">No messages found</h3>
                             <p className="text-sm text-text-muted max-w-sm">
                               {isFiltered ? "No messages match your current filters. Try adjusting them." : "You haven't sent any messages yet."}
                             </p>
                             {!isFiltered && (
                                <Button onClick={() => router.push('/dashboard/messages')} className="mt-2 bg-primary">Send your first message</Button>
                             )}
                          </div>
                       </TableCell>
                    </TableRow>
                 ) : (
                    logs.map((log, index) => {
                       const exactNumber = (page - 1) * pageSize + index + 1;
                       const typeStyle = typeColors[log.msg_type] || typeColors.text;
                       return (
                         <TableRow key={log.id} className="border-border/50 hover:bg-surface-2/40 cursor-default">
                           <TableCell className="text-xs text-text-muted text-center font-mono">{exactNumber}</TableCell>
                           <TableCell className="text-sm font-semibold text-text-primary whitespace-nowrap">+{log.to_number}</TableCell>
                           <TableCell className="text-xs text-text-muted whitespace-nowrap">{log.wa_sessions?.session_name || "Deleted"}</TableCell>
                           <TableCell>
                             <Badge variant="outline" className={cn("text-[10px] uppercase font-bold tracking-wider px-2 py-0 border", typeStyle)}>
                                {log.msg_type}
                             </Badge>
                           </TableCell>
                           <TableCell className="text-xs text-text-secondary hidden md:table-cell max-w-[200px] lg:max-w-[400px] truncate" title={log.content}>
                             {log.content || "<No content>"}
                           </TableCell>
                           <TableCell className="text-center font-mono text-xs text-text-muted">{log.credits_cost}</TableCell>
                           <TableCell className="whitespace-nowrap">
                              <span className={cn("text-[11px] font-bold tracking-widest inline-flex px-2 py-0.5 rounded shadow-sm uppercase", 
                                log.status === "sent" ? "text-success bg-success/15 border border-success/30" :
                                log.status === "failed" ? "text-danger bg-danger/15 border border-danger/30" :
                                "text-warning bg-warning/15 border border-warning/30"
                              )}>
                                {log.status}
                              </span>
                           </TableCell>
                           <TableCell className="text-right text-xs text-text-muted whitespace-nowrap" title={new Date(log.sent_at).toLocaleString()}>
                              {formatDistanceToNow(new Date(log.sent_at))} ago
                           </TableCell>
                           <TableCell className="text-center">
                              <Button variant="ghost" size="sm" onClick={() => openDrawer(log)} className="h-8 w-8 p-0 text-text-muted hover:text-primary hover:bg-primary/10">
                                <Eye className="w-4 h-4" />
                              </Button>
                           </TableCell>
                         </TableRow>
                       );
                    })
                 )}
               </TableBody>
            </Table>
         </CardContent>

         {/* PAGINATION FOOTER */}
         {!loading && totalCount > 0 && (
            <div className="p-4 border-t border-border/50 bg-surface-1/50 flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="text-xs text-text-muted flex items-center gap-4">
                  <span>Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)} of {totalCount} results</span>
                  
                  <Select value={pageSize.toString()} onValueChange={(v) => { if (v) applyFilters("limit", v); }}>
                     <SelectTrigger className="h-7 w-[70px] bg-surface-2 border-border/50 text-[10px]"><SelectValue /></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="20" className="text-xs">20</SelectItem>
                        <SelectItem value="50" className="text-xs">50</SelectItem>
                        <SelectItem value="100" className="text-xs">100</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
               
               <Pagination className="w-auto mx-0">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                         onClick={() => page > 1 && applyFilters("page", (page - 1).toString())}
                         className={cn("h-8 px-3 text-xs", page <= 1 && "pointer-events-none opacity-50 text-text-muted")} 
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext 
                         onClick={() => page * pageSize < totalCount && applyFilters("page", (page + 1).toString())}
                         className={cn("h-8 px-3 text-xs", page * pageSize >= totalCount && "pointer-events-none opacity-50 text-text-muted")} 
                      />
                    </PaginationItem>
                  </PaginationContent>
               </Pagination>
            </div>
         )}
      </Card>

      {/* DRAWER (SHEET) FOR LOG DETAILS */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
         <SheetContent className="bg-surface-1 border-l-border/50 w-full sm:max-w-md overflow-y-auto">
            <SheetHeader className="mb-6">
               <SheetTitle className="text-xl font-bold tracking-tight">Log Details</SheetTitle>
               <SheetDescription className="text-text-muted">Exact metrics returned natively from WAHA engines.</SheetDescription>
            </SheetHeader>

            {selectedLog && (
               <div className="space-y-6">
                  {/* Status Large */}
                  <div className={cn("p-4 rounded-xl border flex flex-col items-center justify-center relative overflow-hidden", 
                     selectedLog.status === "sent" ? "bg-success/5 border-success/20" :
                     selectedLog.status === "failed" ? "bg-danger/5 border-danger/20" :
                     "bg-warning/5 border-warning/20"
                  )}>
                     <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted absolute top-2 left-3">Status</div>
                     <span className={cn("text-2xl font-extrabold uppercase mt-4 mb-2", 
                        selectedLog.status === "sent" ? "text-success" :
                        selectedLog.status === "failed" ? "text-danger" :
                        "text-warning"
                     )}>
                        {selectedLog.status}
                     </span>
                  </div>

                  {selectedLog.status === "failed" && selectedLog.error_message && (
                     <div className="bg-danger/10 border border-danger/30 p-3 rounded-lg flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                        <div>
                           <div className="text-xs font-bold text-danger uppercase tracking-wider mb-1">Error Trace</div>
                           <div className="text-sm text-danger/90 break-words font-mono text-[11px] leading-relaxed">
                              {selectedLog.error_message}
                           </div>
                        </div>
                     </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-surface-2 p-3 rounded-lg border border-border/50">
                        <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1">To Target</div>
                        <div className="text-sm font-semibold text-text-primary truncate">+{selectedLog.to_number}</div>
                     </div>
                     <div className="bg-surface-2 p-3 rounded-lg border border-border/50">
                        <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1">Session Mapping</div>
                        <div className="text-sm font-semibold text-text-primary truncate">{selectedLog.wa_sessions?.session_name || "Unknown"}</div>
                     </div>
                  </div>

                  <div className="bg-surface-2 p-3 rounded-lg border border-border/50 space-y-3">
                     <div className="flex items-center justify-between">
                        <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Type Spec</div>
                        <Badge variant="outline" className={cn("text-[10px] uppercase border", typeColors[selectedLog.msg_type] || typeColors.text)}>{selectedLog.msg_type}</Badge>
                     </div>
                     <div className="border-t border-border/50 pt-3">
                        <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-2">Raw Payload Content</div>
                        <div className="text-sm text-text-secondary whitespace-pre-wrap break-words min-h-[60px] max-h-[200px] overflow-y-auto custom-scrollbar pr-2 leading-relaxed">
                           {selectedLog.content || "<Empty string payload passed>"}
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-surface-2 p-3 rounded-lg border border-border/50">
                        <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1">Credits Inked</div>
                        <div className="text-lg font-bold text-accent">{selectedLog.credits_cost}</div>
                     </div>
                     <div className="bg-surface-2 p-3 rounded-lg border border-border/50">
                        <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1">Timestamp Sent</div>
                        <div className="text-xs font-medium text-text-secondary mt-1">{new Date(selectedLog.sent_at).toLocaleString()}</div>
                     </div>
                  </div>
                  
                  {selectedLog.waha_message_id && (
                     <div className="bg-surface-2 p-3 rounded-lg border border-border/50 flex flex-col items-center justify-center text-center">
                        <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1">WAHA Message ID</div>
                        <div className="text-xs text-text-secondary font-mono bg-surface-1 p-1.5 rounded inline-block border border-border mt-1 truncate max-w-full">
                           {selectedLog.waha_message_id}
                        </div>
                     </div>
                  )}
               </div>
            )}
         </SheetContent>
      </Sheet>
    </div>
  );
}
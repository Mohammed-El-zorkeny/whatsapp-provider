"use client";

import { useEffect, useState, useRef } from "react";
import { useUserStore } from "@/store/user.store";
import { createClient } from "@/lib/supabase/client";
import api from "@/lib/api";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import {
  Smartphone, Plus, Loader2, RefreshCw, Trash2, StopCircle, PlayCircle, QrCode
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

// ----------------------------------------------------------------------------
// ZOD SCHEMAS
// ----------------------------------------------------------------------------
const addSessionSchema = z.object({
  session_name: z
    .string()
    .min(3, "Must be at least 3 characters")
    .max(30, "Must be at most 30 characters")
    .regex(/^[a-zA-Z0-9-]+$/, "Only letters, numbers, and dashes allowed"),
});

// ----------------------------------------------------------------------------
// MAIN SESSIONS PAGE
// ----------------------------------------------------------------------------
export default function SessionsPage() {
  const { user, fetchUser, isLoading: userLoading } = useUserStore();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addingSession, setAddingSession] = useState(false);

  const [qrModalSession, setQrModalSession] = useState<any>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);

  const [deleteSession, setDeleteSession] = useState<any>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Restart loading state
  const [restartingIds, setRestartingIds] = useState<Record<string, boolean>>({});

  // --------------------------------------------------------------------------
  // INIT & POLL DATA
  // --------------------------------------------------------------------------
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const fetchSessions = async () => {
    if (!user) return;
    try {
      const { data } = await api.get("/api/sessions");
      setSessions(data.sessions || []);
    } catch (err) {
      console.error("Failed to fetch sessions", err);
      // If API fails, try one last time from DB directly for read-only view
      const { data: dbData } = await supabase
        .from("wa_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (dbData) setSessions(dbData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) fetchSessions();
  }, [user?.id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const pollStatuses = async () => {
      // Find sessions that need polling
      const activePolls = sessions.filter(s => 
        s.status === "STARTING" || s.status === "SCAN_QR_CODE"
      );

      if (activePolls.length === 0) return;

      let changed = false;
      const updatedSessions = [...sessions];

      for (const s of activePolls) {
        try {
          const { data } = await api.get(`/api/sessions/${s.id}/status`);
          if (data.status && data.status !== s.status) {
            const idx = updatedSessions.findIndex(x => x.id === s.id);
            if (idx > -1) {
              updatedSessions[idx] = { ...updatedSessions[idx], status: data.status };
              changed = true;
            }
          }
        } catch (err) {
           // Silently fail individual polls
        }
      }

      if (changed) {
        setSessions(updatedSessions);
      }
    };

    // Only set interval if there's actively something to poll
    const needsPolling = sessions.some(s => s.status === "STARTING" || s.status === "SCAN_QR_CODE");
    if (needsPolling) {
      interval = setInterval(pollStatuses, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessions]);

  // --------------------------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------------------------
  const addForm = useForm<z.infer<typeof addSessionSchema>>({
    resolver: zodResolver(addSessionSchema),
    defaultValues: { session_name: "" }
  });

  const onAddSubmit = async (values: z.infer<typeof addSessionSchema>) => {
    setAddingSession(true);
    try {
      await api.post("/api/sessions", { session_name: values.session_name.toLowerCase() });
      toast.success("Session configured successfully");
      setIsAddOpen(false);
      addForm.reset();
      fetchSessions();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create session");
    } finally {
      setAddingSession(false);
    }
  };

  const handleRestart = async (id: string) => {
    setRestartingIds(prev => ({ ...prev, [id]: true }));
    try {
      await api.post(`/api/sessions/${id}/restart`);
      toast.success("Restarting session...");
      fetchSessions();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to restart session");
    } finally {
      setRestartingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleStop = async (id: string) => {
    setRestartingIds(prev => ({ ...prev, [id]: true }));
    try {
      await api.delete(`/api/sessions/${id}`);
      toast.success("Session disconnected successfully");
      fetchSessions();
    } catch (err: any) {
      toast.error("Failed to disconnect session");
    } finally {
      setRestartingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  const confirmDelete = async () => {
    if (!deleteSession) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/sessions/${deleteSession.id}`);
      toast.success("Session completely wiped from servers");
      setIsDeleteOpen(false);
      setDeleteSession(null);
      fetchSessions();
    } catch (err: any) {
      toast.error("Failed to delete session explicitly");
    } finally {
      setIsDeleting(false);
    }
  };

  // --------------------------------------------------------------------------
  // QR MODAL HELPER
  // --------------------------------------------------------------------------
  const openQRModal = (session: any) => {
    setQrModalSession(session);
    setIsQrOpen(true);
  };

  if (userLoading && !user) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
           <Skeleton className="h-10 w-48 bg-surface-2" />
           <Skeleton className="h-10 w-32 bg-surface-2" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Skeleton key={i} className="h-48 w-full bg-surface-2 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 md:pb-0 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp Sessions</h1>
          <p className="text-text-muted mt-1 text-sm">Manage hardware links and device auth.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-primary hover:bg-primary-dark shadow-[0_0_20px_rgba(108,71,255,0.2)] hover:shadow-[0_0_30px_rgba(108,71,255,0.4)]">
          <Plus className="w-4 h-4 mr-2" />
          Add Session
        </Button>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Skeleton key={i} className="h-48 w-full bg-surface-2 rounded-2xl" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border/50 rounded-3xl bg-surface-1/30 min-h-[400px]">
          <div className="w-16 h-16 bg-surface-2 rounded-2xl flex items-center justify-center mb-6 border border-border/50">
            <Smartphone className="w-8 h-8 text-primary opacity-80" />
          </div>
          <h3 className="text-xl font-bold mb-2 text-text-primary">No sessions yet</h3>
          <p className="text-text-muted mb-6 max-w-sm">Connect your first WhatsApp number to map your API to hardware securely instantly.</p>
          <Button onClick={() => setIsAddOpen(true)} className="bg-primary hover:bg-primary-dark">
            <Plus className="w-4 h-4 mr-2" /> Connect First Number
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map(s => (
             <Card key={s.id} className="bg-surface-1 border-border/50 overflow-hidden group hover:border-primary/30 transition-colors flex flex-col h-full ring-1 ring-white/5 shadow-xl">
               <CardContent className="p-0 flex-1 flex flex-col">
                 <div className="p-5 flex-1 relative">
                    {/* Badge NOWEB Pill relative mock design */}
                    <div className="absolute top-5 right-5 text-[9px] font-bold bg-surface-2 px-2 py-0.5 rounded border border-border text-text-secondary tracking-widest uppercase">
                      NOWEB
                    </div>
                    
                    <h4 className="text-xl font-bold tracking-tight mb-1 text-text-primary group-hover:text-primary transition-colors">{s.session_name}</h4>
                    <p className="text-sm font-medium text-text-muted mb-5">
                      {s.phone_number ? `+${s.phone_number}` : "Not connected yet"}
                    </p>
                    
                    <div className="flex items-center justify-between mt-auto pt-2">
                       <StatusBadge status={s.status} />
                       {s.updated_at && (
                         <span className="text-[10px] text-text-muted">
                           {formatDistanceToNow(new Date(s.updated_at))} ago
                         </span>
                       )}
                    </div>
                 </div>
                 
                 {/* Action Bar */}
                 <div className="bg-surface-2/40 border-t border-border/50 p-3 flex gap-2 justify-between">
                    <div className="flex gap-2">
                      {["STARTING", "SCAN_QR_CODE"].includes(s.status) && (
                         <Button size="sm" onClick={() => openQRModal(s)} className="bg-primary hover:bg-primary-dark h-8 text-xs px-3 shadow-md shadow-primary/20">
                            View QR
                         </Button>
                      )}
                      {s.status === "CONNECTED" && (
                         <Button size="sm" variant="outline" onClick={() => handleStop(s.id)} disabled={restartingIds[s.id]} className="h-8 text-xs px-3 border-danger/50 text-danger hover:bg-danger/10">
                            {restartingIds[s.id] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <StopCircle className="w-3.5 h-3.5 mr-1" />}
                            Disconnect
                         </Button>
                      )}
                      {["STOPPED", "FAILED", "DISCONNECTED"].includes(s.status) && (
                         <Button size="sm" variant="outline" onClick={() => handleRestart(s.id)} disabled={restartingIds[s.id]} className="h-8 text-xs px-3 border-warning/50 text-warning hover:bg-warning/10">
                            {restartingIds[s.id] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <PlayCircle className="w-3.5 h-3.5 mr-1" />}
                            Restart
                         </Button>
                      )}
                    </div>
                    
                    {/* Always allow delete for hard wipes */}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => { setDeleteSession(s); setIsDeleteOpen(true); }}
                      className="h-8 w-8 p-0 text-text-muted hover:text-danger hover:bg-danger/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                 </div>
               </CardContent>
             </Card>
          ))}
        </div>
      )}

      {/* --------------------------------------------------------------------------
          ADD SESSION MODAL 
          -------------------------------------------------------------------------- */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md bg-surface-1 border-border/60">
          <DialogHeader>
            <DialogTitle>Add New Session</DialogTitle>
            <DialogDescription className="text-text-muted">
              Create a unique identifier bound strictly to a target WhatsApp device.
            </DialogDescription>
          </DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
               <FormField
                  control={addForm.control}
                  name="session_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-text-primary">Session Name</FormLabel>
                      <FormControl>
                        <Input placeholder="support-phone" {...field} className="bg-surface-2 focus-visible:ring-primary h-11" />
                      </FormControl>
                      <p className="text-[10px] text-text-muted pt-1">Letters, numbers, and dashes only.</p>
                      <FormMessage />
                    </FormItem>
                  )}
               />
               <Button type="submit" className="w-full bg-primary hover:bg-primary-dark" disabled={addingSession}>
                 {addingSession ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting Engine...</> : "Create"}
               </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------------------------------------
          QR MODAL 
          -------------------------------------------------------------------------- */}
      <QRModal 
         isOpen={isQrOpen} 
         setIsOpen={setIsQrOpen} 
         session={qrModalSession} 
         onConnected={() => {
           fetchSessions();
           setTimeout(() => setIsQrOpen(false), 2000); // graceful close
         }}
      />

      {/* --------------------------------------------------------------------------
          DELETE CONFIRM
          -------------------------------------------------------------------------- */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-surface-1 border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
            <AlertDialogDescription className="text-text-muted">
              This will permanently disconnect <strong className="text-danger">{deleteSession?.session_name}</strong> and delete all session histories mapped uniquely to it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-surface-2 text-text-primary border-border hover:bg-surface-2/80">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-danger hover:bg-danger/80 text-white font-semibold flex items-center">
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />} Delete explicitly
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

// ----------------------------------------------------------------------------
// QR MODAL COMPONENT (Abstracted internal helper handling polling inherently)
// ----------------------------------------------------------------------------
function QRModal({ isOpen, setIsOpen, session, onConnected }: any) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("STARTING");
  const [loadingQr, setLoadingQr] = useState(false);
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);

  // Sync prop session status initially
  useEffect(() => {
    if (session) setStatus(session.status);
  }, [session]);

  const fetchQr = async () => {
    if (!session?.id) return;
    setLoadingQr(true);
    try {
      const { data, status: code } = await api.get(`/api/sessions/${session.id}/qr`, {
        validateStatus: (s) => s < 500
      });
      if (code === 200 && data.qr_code) {
        setQrCode(data.qr_code);
        setStatus("SCAN_QR_CODE");
      } else if (code === 400 && data.status === "CONNECTED") {
        setStatus("CONNECTED");
        onConnected();
      }
    } catch (e) {
       // Ignore transient fails natively
    } finally {
      setLoadingQr(false);
    }
  };

  const checkStatus = async () => {
    if (!session?.id) return;
    try {
      const { data } = await api.get(`/api/sessions/${session.id}/status`);
      setStatus(data.status);
      if (data.status === "CONNECTED") {
        toast.success("WhatsApp Connected Successfully!");
        onConnected();
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (isOpen && session) {
      // 1. Fetch initially immediately
      if (status !== "CONNECTED") {
         fetchQr();
      }

      // 2. Setup combined polling architecture mapping against NextJS lifecycle robustly
      refreshInterval.current = setInterval(() => {
        if (status === "STARTING" || !qrCode) {
           fetchQr();
        } else if (status === "SCAN_QR_CODE" && qrCode) {
           checkStatus();
        }
      }, 3000);
    }

    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
    };
  }, [isOpen, session, status, qrCode]);

  // Clean wipe on modal close preventing cache bleeds
  useEffect(() => {
    if (!isOpen) {
      setQrCode(null);
      setStatus("STARTING");
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-surface-1 border-border/80 p-0 overflow-hidden outline-none">
        
        <div className="bg-surface-2 border-b border-border/50 px-6 py-5 flex items-center justify-between">
           <div>
             <DialogTitle className="text-xl">Scan with WhatsApp</DialogTitle>
             <DialogDescription className="text-xs text-text-muted mt-1">
               {session?.session_name}
             </DialogDescription>
           </div>
           <StatusBadge status={status} />
        </div>

        <div className="p-6 flex flex-col items-center">
            <div className="bg-white p-3 rounded-2xl shadow-xl shadow-black/40 ring-4 ring-white/10 relative my-4">
              {status === "CONNECTED" ? (
                 <div className="w-[200px] h-[200px] flex flex-col items-center justify-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
                       <PlayCircle className="w-8 h-8 text-success" />
                    </div>
                    <span className="text-success font-bold text-lg">Connected!</span>
                 </div>
              ) : !qrCode ? (
                 <div className="w-[200px] h-[200px] flex flex-col items-center justify-center space-y-3">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    <span className="text-background font-medium bg-foreground/10 px-3 py-1 rounded text-xs">
                      Generating... 
                    </span>
                 </div>
              ) : (
                <div className="w-[200px] h-[200px] relative">
                   <Image src={qrCode} alt="QR Code" fill className="object-cover rounded-xl" />
                </div>
              )}
            </div>
            
            <div className="w-full mt-4 space-y-4">
               <Button 
                  variant="outline" 
                  className="w-full h-10 bg-surface-2 border-border text-text-primary hover:bg-surface-2/80"
                  onClick={fetchQr}
                  disabled={loadingQr || status === "CONNECTED"}
               >
                  {loadingQr ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Refresh QR Code
               </Button>
               
               <ol className="text-xs text-text-secondary space-y-2 bg-surface-2/40 p-4 rounded-xl border border-border/50">
                  <li className="flex gap-2 items-start"><QrCode className="w-3.5 h-3.5 mt-0.5 text-primary" /> Open WhatsApp</li>
                  <li className="flex gap-2 items-start"><Smartphone className="w-3.5 h-3.5 mt-0.5 text-primary" /> Tap Menu or Settings and select <strong>Linked Devices</strong></li>
                  <li className="flex gap-2 items-start"><Plus className="w-3.5 h-3.5 mt-0.5 text-primary" /> Point your phone to this screen</li>
               </ol>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
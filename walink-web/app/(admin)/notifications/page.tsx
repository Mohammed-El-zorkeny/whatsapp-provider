"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlanBadge } from "@/components/shared/PlanBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Search, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface UserResult {
  id: string;
  full_name: string;
  email: string;
}

interface NotificationRow {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  created_at: string;
  is_read: boolean;
  user_name?: string;
  user_email?: string;
}

export default function NotificationsPage() {
  const supabase = createClient();
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  // Form State
  const [targetType, setTargetType] = useState("all"); // "all", "user", "plan_free", etc.
  
  // Specific user search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);

  // Notification content
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [sendInApp, setSendInApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Recent notifications
  const [recentNotifications, setRecentNotifications] = useState<NotificationRow[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Search function for specific user target
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "user")
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(6);

    setSearchResults(data || []);
    setSearching(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (targetType === "user") {
      searchTimer.current = setTimeout(() => searchUsers(searchQuery), 400);
    }
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery, searchUsers, targetType]);

  const loadRecent = async () => {
    setLoadingRecent(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      const userIds = [...new Set(data.map(n => n.user_id).filter(Boolean))];
      let profileMap = new Map();
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        profileMap = new Map(profiles?.map(p => [p.id, p]));
      }

      setRecentNotifications(data.map(n => ({
        ...n,
        user_name: n.user_id ? profileMap.get(n.user_id)?.full_name || "—" : "All Users",
        user_email: n.user_id ? profileMap.get(n.user_id)?.email || "" : "",
      })));
    }
    setLoadingRecent(false);
  };

  useEffect(() => {
    loadRecent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }

    if (!sendInApp && !sendEmail) {
      toast.error("Select at least one delivery method");
      return;
    }

    if (targetType === "user" && !selectedUser) {
      toast.error("Select a specific user");
      return;
    }

    setSubmitting(true);

    try {
      let targetUserIds: string[] | null = null; // null means broadcast

      if (targetType === "user") {
        targetUserIds = [selectedUser!.id];
      } else if (targetType.startsWith("plan_")) {
        const planId = targetType.replace("plan_", "");
        const { data } = await supabase.from("profiles").select("id").eq("role", "user").eq("plan_id", planId);
        targetUserIds = data?.map(d => d.id) || [];
        if (targetUserIds.length === 0) {
          toast.info(`No users found on ${planId} plan`);
          setSubmitting(false);
          return;
        }
      }

      // 1. In-App Notifications
      if (sendInApp) {
        if (targetUserIds === null) {
          // Broadcast wrapper row (user_id = null means it's a broadcast)
          await supabase.from("notifications").insert({
            user_id: null,
            title,
            message,
            type
          });
          // Note: In a real app, a broadcast might generate rows per user 
          // or the frontend queries notifications where user_id IS NULL OR user_id = my_id
          // Our implementation in walink-web checks NULL.
        } else {
          // Bulk insert for specific users
          const inserts = targetUserIds.map((id) => ({
             user_id: id,
             title,
             message,
             type
          }));
          const { error } = await supabase.from("notifications").insert(inserts);
          if (error) throw error;
        }
      }

      // 2. Email fallback (Simulated)
      if (sendEmail) {
        console.log(`[Email Service Mock] Sending ${title} to ${targetUserIds === null ? "all users" : targetUserIds.length + " users"}`);
        // This will be implemented fully when integrating Resend/SendGrid later.
      }

      toast.success("Notification sent!");
      setTitle("");
      setMessage("");
      if (targetType === "user") {
        setSearchQuery("");
        setSelectedUser(null);
      }
      loadRecent();
    } catch (err) {
      console.error(err);
      toast.error("Failed to send notification");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      
      {/* Send Notification Form */}
      <div className="lg:col-span-3">
        <div className="rounded-xl border border-border-color/50 bg-surface-1 overflow-hidden">
          <div className="px-6 py-4 border-b border-border-color/50 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-text-primary">Send Notification</h2>
          </div>
          
          <form onSubmit={handleSend} className="p-6 space-y-6">
            
            {/* Target Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 relative">
                <Label>Recipient</Label>
                <Select value={targetType} onValueChange={(val) => { setTargetType(val); setSelectedUser(null); }}>
                  <SelectTrigger className="bg-surface-2 border-border-color">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users (Broadcast)</SelectItem>
                    <SelectItem value="user">Specific User</SelectItem>
                    <SelectItem value="plan_free">Users on Free Plan</SelectItem>
                    <SelectItem value="plan_starter">Users on Starter Plan</SelectItem>
                    <SelectItem value="plan_pro">Users on Pro Plan</SelectItem>
                    <SelectItem value="plan_business">Users on Business Plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {targetType === "user" && (
                <div className="space-y-2 relative">
                  <Label>Search User</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <Input
                      placeholder="Type name or email…"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSelectedUser(null);
                      }}
                      className="pl-10 bg-surface-2 border-border-color"
                    />
                    {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-text-muted" />}
                  </div>

                  {/* Search Results Dropdown */}
                  {searchResults.length > 0 && !selectedUser && (
                    <div className="absolute top-[70px] z-10 w-full rounded-lg border border-border-color bg-surface-2 shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.map((u) => (
                        <button
                          type="button"
                          key={u.id}
                          onClick={() => {
                            setSelectedUser(u);
                            setSearchQuery(u.full_name || u.email);
                            setSearchResults([]);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-surface-1 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <p className="text-sm font-medium text-text-primary">{u.full_name || "—"}</p>
                            <p className="text-xs text-text-muted">{u.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedUser && (
                    <div className="text-xs text-success flex items-center gap-1 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      Selected: {selectedUser.email}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Type & Title */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="bg-surface-2 border-border-color">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>Subject / Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="E.g. Server Maintenance Notice"
                  required
                  className="bg-surface-2 border-border-color"
                />
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your notification message here…"
                className="bg-surface-2 border-border-color min-h-[120px]"
                required
              />
            </div>

            {/* Delivery Methods */}
            <div className="space-y-3">
              <Label>Delivery Methods</Label>
              <div className="flex items-center gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="inapp" 
                    checked={sendInApp} 
                    onCheckedChange={(checked) => setSendInApp(checked as boolean)} 
                  />
                  <label htmlFor="inapp" className="text-sm cursor-pointer select-none">
                    In-App Notification
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="email" 
                    checked={sendEmail} 
                    onCheckedChange={(checked) => setSendEmail(checked as boolean)} 
                  />
                  <label htmlFor="email" className="text-sm cursor-pointer select-none">
                    Email Notification
                    <span className="text-xs text-text-muted ml-2">(Simulated)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={submitting || (targetType === "user" && !selectedUser)}
              className="bg-primary hover:bg-primary-dark text-primary-foreground cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send Notification
            </Button>
          </form>
        </div>
      </div>

      {/* Recent Notifications Sidebar */}
      <div className="lg:col-span-2">
        <div className="rounded-xl border border-border-color/50 bg-surface-1 overflow-hidden h-full flex flex-col">
          <div className="px-5 py-4 border-b border-border-color/50 shrink-0">
            <h2 className="font-semibold text-text-primary">Recent Notifications</h2>
            <p className="text-xs text-text-muted mt-0.5">Last 20 messages sent</p>
          </div>
          
          <div className="flex-1 overflow-y-auto divide-y divide-border-color/20">
            {loadingRecent ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="py-12 text-center text-text-muted text-sm">
                No notifications sent yet.
              </div>
            ) : (
              recentNotifications.map((noti) => (
                <div key={noti.id} className="p-4 hover:bg-surface-2/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary mb-0.5 break-words">
                        {noti.title}
                      </h4>
                      <p className="text-xs text-text-secondary truncate max-w-xs">{noti.message}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5 ${
                      noti.type === "success" ? "bg-success/10 text-success" :
                      noti.type === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                    }`}>
                      {noti.type}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 text-xs text-text-muted">
                    <span className="font-medium text-text-secondary">
                      To: {noti.user_id ? noti.user_name : "All Users (Broadcast)"}
                    </span>
                    <span>{format(new Date(noti.created_at), "MMM dd, HH:mm")}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

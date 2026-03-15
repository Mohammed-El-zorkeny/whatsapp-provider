"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlanBadge } from "@/components/shared/PlanBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Eye, PlusCircle, ShieldBan, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  plan_id: string;
  credits_balance: number;
  is_active: boolean;
  created_at: string;
}

export default function UsersPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Suspend dialog
  const [suspendTarget, setSuspendTarget] = useState<Profile | null>(null);
  const [suspendLoading, setSuspendLoading] = useState(false);

  // Quick add credits dialog
  const [creditsTarget, setCreditsTarget] = useState<Profile | null>(null);
  const [creditsAmount, setCreditsAmount] = useState("");
  const [creditsLoading, setCreditsLoading] = useState(false);

  // Sessions count per user
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [messageCounts, setMessageCounts] = useState<Record<string, number>>({});

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("profiles")
      .select("id, full_name, email, plan_id, credits_balance, is_active, created_at")
      .eq("role", "user")
      .order("created_at", { ascending: false });

    if (planFilter !== "all") query = query.eq("plan_id", planFilter);
    if (statusFilter === "active") query = query.eq("is_active", true);
    if (statusFilter === "suspended") query = query.eq("is_active", false);

    const { data } = await query;

    let filtered = data || [];
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }

    setUsers(filtered);

    // Fetch session counts for these users
    if (filtered.length > 0) {
      const userIds = filtered.map((u) => u.id);
      const { data: sessions } = await supabase
        .from("wa_sessions")
        .select("user_id")
        .in("user_id", userIds);

      const sCounts: Record<string, number> = {};
      sessions?.forEach((s) => {
        sCounts[s.user_id] = (sCounts[s.user_id] || 0) + 1;
      });
      setSessionCounts(sCounts);

      const { data: messages } = await supabase
        .from("message_logs")
        .select("user_id")
        .in("user_id", userIds);

      const mCounts: Record<string, number> = {};
      messages?.forEach((m) => {
        mCounts[m.user_id] = (mCounts[m.user_id] || 0) + 1;
      });
      setMessageCounts(mCounts);
    }

    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, planFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleActive = async () => {
    if (!suspendTarget) return;
    setSuspendLoading(true);

    const newStatus = !suspendTarget.is_active;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: newStatus })
      .eq("id", suspendTarget.id);

    if (error) {
      toast.error("Failed to update user status");
    } else {
      toast.success(newStatus ? "User activated" : "User suspended");
      fetchUsers();
    }

    setSuspendLoading(false);
    setSuspendTarget(null);
  };

  const handleQuickAddCredits = async () => {
    if (!creditsTarget || !creditsAmount) return;
    setCreditsLoading(true);

    const amount = parseInt(creditsAmount);
    if (isNaN(amount) || amount < 1) {
      toast.error("Invalid amount");
      setCreditsLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc("add_credits", {
      p_user_id: creditsTarget.id,
      p_amount: amount,
      p_type: "bonus",
      p_description: `Admin quick-add: ${amount} credits`,
    });

    if (error) {
      toast.error("Failed to add credits");
    } else {
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      if (result?.success) {
        toast.success(`Added ${amount} credits to ${creditsTarget.full_name || creditsTarget.email}`);
        fetchUsers();
      } else {
        toast.error(result?.error || "Failed to add credits");
      }
    }

    setCreditsLoading(false);
    setCreditsTarget(null);
    setCreditsAmount("");
  };

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Users</h2>
          <p className="text-sm text-text-muted mt-0.5">{users.length} users</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-surface-2 border-border-color"
          />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-36 bg-surface-2 border-border-color">
            <SelectValue placeholder="All Plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="business">Business</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-surface-2 border-border-color">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border-color/50 bg-surface-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color/30">
                <th className="text-left px-5 py-3 text-text-muted font-medium">User</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Plan</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Credits</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Sessions</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Messages</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Status</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Joined</th>
                <th className="text-right px-5 py-3 text-text-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-text-muted">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const initials = u.full_name
                    ? u.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                    : u.email[0].toUpperCase();
                  return (
                    <tr key={u.id} className="border-b border-border-color/20 hover:bg-surface-2/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-text-primary truncate">{u.full_name || "—"}</p>
                            <p className="text-xs text-text-muted truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3"><PlanBadge planId={u.plan_id} /></td>
                      <td className="px-5 py-3">
                        <span className={`font-mono font-semibold ${u.credits_balance === 0 ? "text-danger" : u.credits_balance < 10 ? "text-warning" : "text-text-secondary"}`}>
                          {u.credits_balance}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-text-secondary">{sessionCounts[u.id] || 0}</td>
                      <td className="px-5 py-3 text-text-secondary">{(messageCounts[u.id] || 0).toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={u.is_active ? "active" : "suspended"} />
                      </td>
                      <td className="px-5 py-3 text-text-muted whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/admin/users/${u.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-success cursor-pointer"
                            onClick={() => setCreditsTarget(u)}
                          >
                            <PlusCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 w-8 p-0 cursor-pointer ${u.is_active ? "text-danger" : "text-success"}`}
                            onClick={() => setSuspendTarget(u)}
                          >
                            {u.is_active ? <ShieldBan className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suspend/Activate Confirmation */}
      <AlertDialog open={!!suspendTarget} onOpenChange={() => setSuspendTarget(null)}>
        <AlertDialogContent className="bg-surface-1 border-border-color">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspendTarget?.is_active ? "Suspend User?" : "Activate User?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendTarget?.is_active
                ? `This will suspend ${suspendTarget?.full_name || suspendTarget?.email}. They will lose access to all API features and active sessions will be stopped.`
                : `This will re-activate ${suspendTarget?.full_name || suspendTarget?.email}. They will regain access to all features.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleActive}
              disabled={suspendLoading}
              className={`cursor-pointer ${suspendTarget?.is_active ? "bg-danger hover:bg-danger/90" : "bg-success hover:bg-success/90"}`}
            >
              {suspendLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {suspendTarget?.is_active ? "Suspend" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Add Credits Dialog */}
      <Dialog open={!!creditsTarget} onOpenChange={() => { setCreditsTarget(null); setCreditsAmount(""); }}>
        <DialogContent className="bg-surface-1 border-border-color">
          <DialogHeader>
            <DialogTitle>Add Credits</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-2 border border-border-color p-3">
              <p className="text-sm font-medium text-text-primary">{creditsTarget?.full_name || creditsTarget?.email}</p>
              <p className="text-xs text-text-muted">Current balance: {creditsTarget?.credits_balance} credits</p>
            </div>
            <div className="space-y-2">
              <Label>Credits Amount</Label>
              <Input
                type="number"
                min={1}
                max={100000}
                value={creditsAmount}
                onChange={(e) => setCreditsAmount(e.target.value)}
                placeholder="Enter amount"
                className="bg-surface-2 border-border-color"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreditsTarget(null); setCreditsAmount(""); }} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              onClick={handleQuickAddCredits}
              disabled={creditsLoading || !creditsAmount}
              className="bg-primary hover:bg-primary-dark text-primary-foreground cursor-pointer"
            >
              {creditsLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Add Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

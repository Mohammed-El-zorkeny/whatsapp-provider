"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlanBadge } from "@/components/shared/PlanBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, Clock, PlusCircle, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, format } from "date-fns";

const PLAN_CREDITS: Record<string, number> = {
  free: 50, starter: 1000, pro: 5000, business: 20000,
};

interface LowCreditsUser {
  id: string;
  full_name: string;
  email: string;
  plan_id: string;
  credits_balance: number;
  pct: number;
}

interface ExpiringUser {
  id: string;
  full_name: string;
  email: string;
  plan_id: string;
  plan_expires_at: string;
  daysLeft: number;
}

export default function SubscriptionsPage() {
  const supabase = createClient();
  const [lowCredits, setLowCredits] = useState<LowCreditsUser[]>([]);
  const [expiringSoon, setExpiringSoon] = useState<ExpiringUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Renew dialog
  const [renewTarget, setRenewTarget] = useState<ExpiringUser | null>(null);
  const [renewCredits, setRenewCredits] = useState("");
  const [renewLoading, setRenewLoading] = useState(false);

  // Quick add credits
  const [creditsTarget, setCreditsTarget] = useState<LowCreditsUser | null>(null);
  const [creditsAmount, setCreditsAmount] = useState("");
  const [creditsLoading, setCreditsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, plan_id, credits_balance, plan_expires_at")
        .eq("role", "user")
        .eq("is_active", true);

      if (!profiles) { setLoading(false); return; }

      // Low credits
      const lowCreditUsers: LowCreditsUser[] = [];
      profiles.forEach((p) => {
        const monthly = PLAN_CREDITS[p.plan_id] || 50;
        const pct = monthly > 0 ? (p.credits_balance / monthly) * 100 : 0;
        if (p.credits_balance < 100 || pct < 15) {
          lowCreditUsers.push({ ...p, pct: Math.round(pct) });
        }
      });
      lowCreditUsers.sort((a, b) => a.credits_balance - b.credits_balance);
      setLowCredits(lowCreditUsers);

      // Expiring
      const now = new Date();
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const expiringUsers: ExpiringUser[] = [];
      profiles.forEach((p) => {
        if (p.plan_expires_at) {
          const expDate = new Date(p.plan_expires_at);
          if (expDate <= sevenDays && expDate >= now) {
            expiringUsers.push({
              ...p,
              plan_expires_at: p.plan_expires_at,
              daysLeft: differenceInDays(expDate, now),
            });
          }
        }
      });
      expiringUsers.sort((a, b) => a.daysLeft - b.daysLeft);
      setExpiringSoon(expiringUsers);

      setLoading(false);
    };
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddCredits = async () => {
    if (!creditsTarget) return;
    const amt = parseInt(creditsAmount);
    if (isNaN(amt) || amt < 1) { toast.error("Invalid amount"); return; }
    setCreditsLoading(true);

    const { data, error } = await supabase.rpc("add_credits", {
      p_user_id: creditsTarget.id,
      p_amount: amt,
      p_type: "bonus",
      p_description: `Admin quick-add: ${amt} credits`,
    });

    if (error) { toast.error("Failed"); }
    else {
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      if (result?.success) toast.success(`Added ${amt} credits`);
      else toast.error(result?.error || "Failed");
    }
    setCreditsLoading(false);
    setCreditsTarget(null);
    setCreditsAmount("");
  };

  const handleRenew = async () => {
    if (!renewTarget) return;
    const amt = parseInt(renewCredits) || 0;
    setRenewLoading(true);

    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 30);

    await supabase
      .from("profiles")
      .update({ plan_expires_at: newExpiry.toISOString() })
      .eq("id", renewTarget.id);

    if (amt > 0) {
      await supabase.rpc("add_credits", {
        p_user_id: renewTarget.id,
        p_amount: amt,
        p_type: "plan_renewal",
        p_description: `Plan renewed + ${amt} credits`,
      });
    }

    toast.success("Plan renewed for 30 days" + (amt > 0 ? ` with ${amt} credits` : ""));
    setRenewLoading(false);
    setRenewTarget(null);
    setRenewCredits("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section A — Low Credits */}
      <div className="rounded-xl border border-border-color/50 bg-surface-1 overflow-hidden">
        <div className="px-5 py-4 border-b border-border-color/50 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <div>
            <h2 className="font-semibold text-text-primary">Low Credits Alert</h2>
            <p className="text-xs text-text-muted">Users below 15% or 100 credits</p>
          </div>
          <span className="ml-auto text-xs font-semibold bg-warning/10 text-warning border border-warning/20 rounded-full px-2.5 py-0.5">
            {lowCredits.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color/30">
                <th className="text-left px-5 py-3 text-text-muted font-medium">User</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Plan</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Balance</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">% Remaining</th>
                <th className="text-right px-5 py-3 text-text-muted font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {lowCredits.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-text-muted">All users have sufficient credits 🎉</td></tr>
              ) : (
                lowCredits.map((u) => (
                  <tr key={u.id} className="border-b border-border-color/20 hover:bg-surface-2/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-text-primary">{u.full_name || "—"}</p>
                      <p className="text-xs text-text-muted">{u.email}</p>
                    </td>
                    <td className="px-5 py-3"><PlanBadge planId={u.plan_id} /></td>
                    <td className="px-5 py-3">
                      <span className={`font-mono font-semibold ${u.credits_balance === 0 ? "text-danger" : "text-warning"}`}>
                        {u.credits_balance}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${u.pct < 10 ? "bg-danger" : "bg-warning"}`}
                            style={{ width: `${Math.min(u.pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-muted">{u.pct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 cursor-pointer"
                        onClick={() => setCreditsTarget(u)}
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Add
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section B — Expiring Soon */}
      <div className="rounded-xl border border-border-color/50 bg-surface-1 overflow-hidden">
        <div className="px-5 py-4 border-b border-border-color/50 flex items-center gap-2">
          <Clock className="w-5 h-5 text-danger" />
          <div>
            <h2 className="font-semibold text-text-primary">Expiring Soon</h2>
            <p className="text-xs text-text-muted">Plans expiring within 7 days</p>
          </div>
          <span className="ml-auto text-xs font-semibold bg-danger/10 text-danger border border-danger/20 rounded-full px-2.5 py-0.5">
            {expiringSoon.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color/30">
                <th className="text-left px-5 py-3 text-text-muted font-medium">User</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Plan</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Expires</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Days Left</th>
                <th className="text-right px-5 py-3 text-text-muted font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {expiringSoon.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-text-muted">No plans expiring this week 🎉</td></tr>
              ) : (
                expiringSoon.map((u) => (
                  <tr key={u.id} className="border-b border-border-color/20 hover:bg-surface-2/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-text-primary">{u.full_name || "—"}</p>
                      <p className="text-xs text-text-muted">{u.email}</p>
                    </td>
                    <td className="px-5 py-3"><PlanBadge planId={u.plan_id} /></td>
                    <td className="px-5 py-3 text-text-muted">{format(new Date(u.plan_expires_at), "MMM dd, yyyy")}</td>
                    <td className="px-5 py-3">
                      <span className={`font-semibold ${u.daysLeft <= 2 ? "text-danger" : "text-warning"}`}>
                        {u.daysLeft} day{u.daysLeft !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 cursor-pointer"
                        onClick={() => setRenewTarget(u)}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Renew
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Add Credits Dialog */}
      <Dialog open={!!creditsTarget} onOpenChange={() => { setCreditsTarget(null); setCreditsAmount(""); }}>
        <DialogContent className="bg-surface-1 border-border-color">
          <DialogHeader>
            <DialogTitle>Add Credits</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-2 border border-border-color p-3">
              <p className="text-sm font-medium text-text-primary">{creditsTarget?.full_name || creditsTarget?.email}</p>
              <p className="text-xs text-text-muted">Current: {creditsTarget?.credits_balance} credits</p>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" min={1} value={creditsAmount} onChange={(e) => setCreditsAmount(e.target.value)} placeholder="Enter amount" className="bg-surface-2 border-border-color" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreditsTarget(null); setCreditsAmount(""); }} className="cursor-pointer">Cancel</Button>
            <Button onClick={handleAddCredits} disabled={creditsLoading || !creditsAmount} className="bg-primary hover:bg-primary-dark text-primary-foreground cursor-pointer">
              {creditsLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renew Dialog */}
      <Dialog open={!!renewTarget} onOpenChange={() => { setRenewTarget(null); setRenewCredits(""); }}>
        <DialogContent className="bg-surface-1 border-border-color">
          <DialogHeader>
            <DialogTitle>Renew Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-2 border border-border-color p-3">
              <p className="text-sm font-medium text-text-primary">{renewTarget?.full_name || renewTarget?.email}</p>
              <p className="text-xs text-text-muted">
                Plan: {renewTarget?.plan_id} • Expires: {renewTarget?.plan_expires_at ? format(new Date(renewTarget.plan_expires_at), "MMM dd") : "—"}
              </p>
            </div>
            <p className="text-sm text-text-secondary">This will extend the plan by 30 days from today.</p>
            <div className="space-y-2">
              <Label>Add Credits (Optional)</Label>
              <Input type="number" min={0} value={renewCredits} onChange={(e) => setRenewCredits(e.target.value)} placeholder="0" className="bg-surface-2 border-border-color" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenewTarget(null); setRenewCredits(""); }} className="cursor-pointer">Cancel</Button>
            <Button onClick={handleRenew} disabled={renewLoading} className="bg-primary hover:bg-primary-dark text-primary-foreground cursor-pointer">
              {renewLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Renew
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

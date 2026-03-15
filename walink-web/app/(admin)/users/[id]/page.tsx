import { createAdminClient } from "@/lib/supabase/admin";
import { PlanBadge } from "@/components/shared/PlanBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { UserActions } from "./UserActions";
import {
  User,
  Mail,
  Calendar,
  CreditCard,
  Smartphone,
  MessageSquare,
  FileText,
  Activity,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!profile) notFound();

  const [
    { data: sessions },
    { data: messages },
    { data: invoices },
    { data: transactions },
  ] = await Promise.all([
    supabase
      .from("wa_sessions")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("message_logs")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("invoices")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("credit_transactions")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      {/* User Header */}
      <div className="rounded-xl border border-border-color/50 bg-surface-1 p-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-lg font-bold text-primary">
              {profile.full_name
                ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                : profile.email[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">{profile.full_name || "—"}</h2>
              <p className="text-sm text-text-muted">{profile.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <PlanBadge planId={profile.plan_id} />
                <StatusBadge status={profile.is_active ? "active" : "suspended"} />
              </div>
            </div>
          </div>
          <UserActions userId={id} isActive={profile.is_active} userName={profile.full_name || profile.email} />
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: <CreditCard className="w-4 h-4" />, label: "Balance", value: profile.credits_balance },
          { icon: <Activity className="w-4 h-4" />, label: "Used (Month)", value: profile.credits_used_month },
          { icon: <Smartphone className="w-4 h-4" />, label: "Sessions", value: sessions?.length || 0 },
          { icon: <Calendar className="w-4 h-4" />, label: "Joined", value: format(new Date(profile.created_at), "MMM dd, yyyy") },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border-color/50 bg-surface-1 p-4">
            <div className="flex items-center gap-2 text-text-muted text-xs mb-1">
              {card.icon} {card.label}
            </div>
            <p className="text-lg font-bold text-text-primary">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions */}
        <div className="rounded-xl border border-border-color/50 bg-surface-1 overflow-hidden">
          <div className="px-5 py-4 border-b border-border-color/50 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-text-primary">WhatsApp Sessions</h3>
          </div>
          <div className="divide-y divide-border-color/20">
            {sessions?.length ? sessions.map((s) => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">{s.session_name || s.id}</p>
                  <p className="text-xs text-text-muted">{format(new Date(s.created_at), "MMM dd, yyyy HH:mm")}</p>
                </div>
                <StatusBadge status={s.status === "WORKING" ? "active" : "pending"} />
              </div>
            )) : (
              <p className="px-5 py-6 text-center text-text-muted text-sm">No sessions</p>
            )}
          </div>
        </div>

        {/* Credit Transactions */}
        <div className="rounded-xl border border-border-color/50 bg-surface-1 overflow-hidden">
          <div className="px-5 py-4 border-b border-border-color/50 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-text-primary">Credit Transactions</h3>
          </div>
          <div className="divide-y divide-border-color/20 max-h-80 overflow-y-auto">
            {transactions?.length ? transactions.map((t) => (
              <div key={t.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-primary">{t.description || t.type}</p>
                  <p className="text-xs text-text-muted">{format(new Date(t.created_at), "MMM dd, yyyy HH:mm")}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold font-mono ${t.amount >= 0 ? "text-success" : "text-danger"}`}>
                    {t.amount >= 0 ? "+" : ""}{t.amount}
                  </p>
                  <p className="text-xs text-text-muted">→ {t.balance_after}</p>
                </div>
              </div>
            )) : (
              <p className="px-5 py-6 text-center text-text-muted text-sm">No transactions</p>
            )}
          </div>
        </div>

        {/* Recent Messages */}
        <div className="rounded-xl border border-border-color/50 bg-surface-1 overflow-hidden">
          <div className="px-5 py-4 border-b border-border-color/50 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-text-primary">Recent Messages</h3>
          </div>
          <div className="divide-y divide-border-color/20 max-h-80 overflow-y-auto">
            {messages?.length ? messages.map((m) => (
              <div key={m.id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-text-primary font-mono">{m.recipient}</p>
                  <StatusBadge status={m.status === "sent" ? "active" : "pending"} />
                </div>
                <p className="text-xs text-text-muted mt-0.5">{format(new Date(m.created_at), "MMM dd, yyyy HH:mm")}</p>
              </div>
            )) : (
              <p className="px-5 py-6 text-center text-text-muted text-sm">No messages</p>
            )}
          </div>
        </div>

        {/* Invoices */}
        <div className="rounded-xl border border-border-color/50 bg-surface-1 overflow-hidden">
          <div className="px-5 py-4 border-b border-border-color/50 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-text-primary">Invoices</h3>
          </div>
          <div className="divide-y divide-border-color/20 max-h-80 overflow-y-auto">
            {invoices?.length ? invoices.map((inv) => (
              <div key={inv.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">{inv.invoice_number}</p>
                  <p className="text-xs text-text-muted">{inv.credits_added} credits • {format(new Date(inv.created_at), "MMM dd, yyyy")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-text-primary">${(inv.amount_cents / 100).toFixed(2)}</p>
                  <StatusBadge status={inv.status} />
                </div>
              </div>
            )) : (
              <p className="px-5 py-6 text-center text-text-muted text-sm">No invoices</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

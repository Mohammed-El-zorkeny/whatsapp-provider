"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PlanBadge } from "@/components/shared/PlanBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileText, Download, Eye, Loader2 } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  amount_cents: number;
  credits_added: number;
  plan_id: string;
  status: string;
  notes: string | null;
  issued_at: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export default function InvoicesPage() {
  const supabase = createClient();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });

      if (!data) { setLoading(false); return; }

      const userIds = [...new Set(data.map((i) => i.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const enriched: Invoice[] = data.map((inv) => ({
        ...inv,
        user_name: profileMap.get(inv.user_id)?.full_name || "—",
        user_email: profileMap.get(inv.user_id)?.email || "",
      }));

      setInvoices(enriched);
      setLoading(false);
    };
    fetchInvoices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = search.trim()
    ? invoices.filter(
        (inv) =>
          inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
          inv.user_name?.toLowerCase().includes(search.toLowerCase()) ||
          inv.user_email?.toLowerCase().includes(search.toLowerCase())
      )
    : invoices;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Invoices</h2>
          <p className="text-sm text-text-muted mt-0.5">{filtered.length} invoices</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <Input
          placeholder="Search by invoice #, name, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-surface-2 border-border-color"
        />
      </div>

      <div className="rounded-xl border border-border-color/50 bg-surface-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color/30">
                <th className="text-left px-5 py-3 text-text-muted font-medium">Invoice #</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Client</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Plan</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Credits</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Amount</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Status</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Date</th>
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
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-text-muted">No invoices found.</td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} className="border-b border-border-color/20 hover:bg-surface-2/50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-mono text-sm font-medium text-primary">{inv.invoice_number}</span>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-text-primary">{inv.user_name}</p>
                      <p className="text-xs text-text-muted">{inv.user_email}</p>
                    </td>
                    <td className="px-5 py-3"><PlanBadge planId={inv.plan_id || "free"} /></td>
                    <td className="px-5 py-3 font-mono text-text-secondary">{inv.credits_added.toLocaleString()}</td>
                    <td className="px-5 py-3 font-semibold text-text-primary">${(inv.amount_cents / 100).toFixed(2)}</td>
                    <td className="px-5 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-5 py-3 text-text-muted whitespace-nowrap">
                      {format(new Date(inv.issued_at), "MMM dd, yyyy")}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/invoices/${inv.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

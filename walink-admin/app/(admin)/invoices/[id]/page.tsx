import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { InvoiceActions } from "./InvoiceActions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();

  if (!invoice) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", invoice.user_id)
    .single();

  const planNames: Record<string, string> = {
    free: "Free", starter: "Starter", pro: "Pro", business: "Business",
  };

  const invoiceData = {
    invoiceNumber: invoice.invoice_number,
    date: format(new Date(invoice.issued_at), "MMMM dd, yyyy"),
    clientName: profile?.full_name || "—",
    clientEmail: profile?.email || "—",
    planName: planNames[invoice.plan_id] || invoice.plan_id || "—",
    creditsAdded: invoice.credits_added,
    amountUsd: (invoice.amount_cents / 100).toFixed(2),
    status: invoice.status,
    notes: invoice.notes || "",
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Invoice Preview */}
      <div className="rounded-xl border border-border-color/50 bg-surface-1 overflow-hidden">
        <div className="p-8 space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary">WALINK</h1>
              <p className="text-sm text-text-muted">Platform for WhatsApp API</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-text-primary">INVOICE</p>
              <p className="text-sm text-text-muted mt-1">{invoiceData.invoiceNumber}</p>
              <p className="text-sm text-text-muted">{invoiceData.date}</p>
              <p className="text-sm text-success font-semibold mt-1 uppercase">{invoiceData.status}</p>
            </div>
          </div>

          <hr className="border-border-color/30" />

          {/* Bill To */}
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Bill To</p>
            <p className="font-semibold text-text-primary">{invoiceData.clientName}</p>
            <p className="text-sm text-text-muted">{invoiceData.clientEmail}</p>
          </div>

          <hr className="border-border-color/30" />

          {/* Line Items */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color/30">
                <th className="text-left py-2 text-text-muted font-medium">Description</th>
                <th className="text-right py-2 text-text-muted font-medium">Qty</th>
                <th className="text-right py-2 text-text-muted font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-3 text-text-primary">
                  {invoiceData.planName} Plan — Credits
                </td>
                <td className="py-3 text-right text-text-secondary">{invoiceData.creditsAdded.toLocaleString()}</td>
                <td className="py-3 text-right font-semibold text-text-primary">${invoiceData.amountUsd}</td>
              </tr>
            </tbody>
          </table>

          <hr className="border-border-color/30" />

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-60 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Subtotal</span>
                <span className="text-text-primary">${invoiceData.amountUsd}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Tax (0%)</span>
                <span className="text-text-primary">$0.00</span>
              </div>
              <hr className="border-border-color/30" />
              <div className="flex justify-between text-base font-bold">
                <span className="text-text-primary">Total</span>
                <span className="text-primary">${invoiceData.amountUsd}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoiceData.notes && (
            <>
              <hr className="border-border-color/30" />
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-text-secondary">{invoiceData.notes}</p>
              </div>
            </>
          )}

          <div className="pt-4 text-center">
            <p className="text-sm text-text-muted">Thank you for using WaLink!</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <InvoiceActions invoiceData={invoiceData} />
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import dynamic from "next/dynamic";

const InvoicePDFDownload = dynamic(
  () => import("@/components/invoices/InvoicePDFDownload"),
  { ssr: false }
);

interface InvoiceActionsProps {
  invoiceData: {
    invoiceNumber: string;
    date: string;
    clientName: string;
    clientEmail: string;
    planName: string;
    creditsAdded: number;
    amountUsd: string;
    status: string;
    notes: string;
  };
}

export function InvoiceActions({ invoiceData }: InvoiceActionsProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex items-center justify-center gap-3">
      <InvoicePDFDownload invoiceData={invoiceData} />
      <Button variant="outline" onClick={handlePrint} className="gap-1.5 cursor-pointer">
        <Printer className="w-4 h-4" />
        Print
      </Button>
    </div>
  );
}

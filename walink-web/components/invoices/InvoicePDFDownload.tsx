"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
} from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 12,
    color: "#333",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#F5A623", 
  },
  subtitle: {
    fontSize: 10,
    color: "#666",
    marginTop: 4,
  },
  invoiceInfo: {
    textAlign: "right",
  },
  invoiceText: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    marginVertical: 20,
  },
  billToLabel: {
    fontSize: 10,
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  billToName: {
    fontWeight: "bold",
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 8,
    marginBottom: 8,
  },
  colDesc: { flex: 1 },
  colQty: { width: 80, textAlign: "right" },
  colAmt: { width: 80, textAlign: "right" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
  },
  totalsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
  },
  totalsBox: {
    width: 200,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  totalText: {
    color: "#666",
  },
  totalValue: {
    fontWeight: "bold",
  },
  grandTotalText: {
    fontWeight: "bold",
    fontSize: 14,
  },
  grandTotalValue: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#F5A623",
  },
  notesLabel: {
    fontSize: 10,
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: "center",
    color: "#999",
    fontSize: 10,
  },
});

interface InvoiceDocProps {
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

const InvoiceDocument = ({ invoiceData }: InvoiceDocProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>WALINK</Text>
          <Text style={styles.subtitle}>Platform for WhatsApp API</Text>
        </View>
        <View style={styles.invoiceInfo}>
          <Text style={styles.invoiceText}>INVOICE</Text>
          <Text>{invoiceData.invoiceNumber}</Text>
          <Text>{invoiceData.date}</Text>
          <Text style={{ marginTop: 4, color: "#00C97A", fontWeight: "bold" }}>
            {invoiceData.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View>
        <Text style={styles.billToLabel}>Bill To</Text>
        <Text style={styles.billToName}>{invoiceData.clientName}</Text>
        <Text>{invoiceData.clientEmail}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.tableHeader}>
        <Text style={[styles.colDesc, { color: "#666" }]}>Description</Text>
        <Text style={[styles.colQty, { color: "#666" }]}>Qty (Credits)</Text>
        <Text style={[styles.colAmt, { color: "#666" }]}>Amount</Text>
      </View>

      <View style={styles.tableRow}>
        <Text style={styles.colDesc}>
          {invoiceData.planName} Plan — Credits
        </Text>
        <Text style={styles.colQty}>
          {invoiceData.creditsAdded.toLocaleString()}
        </Text>
        <Text style={styles.colAmt}>${invoiceData.amountUsd}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.totalsContainer}>
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalText}>Subtotal</Text>
            <Text style={styles.totalValue}>${invoiceData.amountUsd}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalText}>Tax (0%)</Text>
            <Text style={styles.totalValue}>$0.00</Text>
          </View>
          <View style={[styles.divider, { marginVertical: 8 }]} />
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalText}>Total</Text>
            <Text style={styles.grandTotalValue}>${invoiceData.amountUsd}</Text>
          </View>
        </View>
      </View>

      {invoiceData.notes && (
        <View style={{ marginTop: 40 }}>
          <Text style={styles.notesLabel}>Notes</Text>
          <Text>{invoiceData.notes}</Text>
        </View>
      )}

      <Text style={styles.footer}>Thank you for using WaLink!</Text>
    </Page>
  </Document>
);

export default function InvoicePDFDownload({ invoiceData }: InvoiceDocProps) {
  return (
    <PDFDownloadLink
      document={<InvoiceDocument invoiceData={invoiceData} />}
      fileName={`${invoiceData.invoiceNumber}.pdf`}
      className="inline-block"
    >
      {/* @ts-ignore - react-pdf types return a child function but Next.js sees it as incompatible sometimes */}
      {({ loading }) => (
        <Button
          disabled={loading}
          className="bg-primary hover:bg-primary-dark text-primary-foreground gap-1.5 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          {loading ? "Preparing PDF..." : "Download PDF"}
        </Button>
      )}
    </PDFDownloadLink>
  );
}

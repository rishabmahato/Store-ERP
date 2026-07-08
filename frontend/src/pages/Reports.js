import React from "react";
import useSWR from "swr";
import { api, formatINR } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const fetcher = (url) => api.get(url).then((r) => r.data);

function toCSV(rows, headers) {
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(",")];
  rows.forEach((r) => lines.push(headers.map((h) => escape(r[h])).join(",")));
  return lines.join("\n");
}
function download(name, content) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

export default function Reports() {
  const { data: sales = [] } = useSWR("/sales", fetcher);
  const { data: products = [] } = useSWR("/products", fetcher);
  const { data: customers = [] } = useSWR("/customers", fetcher);
  const { data: summary } = useSWR("/dashboard/summary", fetcher);

  const exportSales = () => {
    const rows = sales.map((s) => ({
      invoice: s.invoice_number, date: s.created_at, customer: s.customer_name,
      cashier: s.cashier_name, method: s.payment_method,
      subtotal: s.subtotal, gst: s.total_gst, total: s.grand_total, status: s.status,
    }));
    download("sales_report.csv", toCSV(rows, ["invoice","date","customer","cashier","method","subtotal","gst","total","status"]));
  };
  const exportProducts = () => {
    const rows = products.map((p) => ({
      sku: p.sku, name: p.name, quantity: p.quantity,
      purchase_price: p.purchase_price, selling_price: p.selling_price,
      gst_rate: p.gst_rate, stock_value: p.quantity * p.purchase_price,
    }));
    download("inventory_report.csv", toCSV(rows, ["sku","name","quantity","purchase_price","selling_price","gst_rate","stock_value"]));
  };
  const exportCustomers = () => {
    const rows = customers.map((c) => ({
      name: c.name, phone: c.phone, email: c.email,
      total_spent: c.total_spent, loyalty_points: c.loyalty_points,
    }));
    download("customers_report.csv", toCSV(rows, ["name","phone","email","total_spent","loyalty_points"]));
  };

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Analytics</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "Outfit" }}>Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Export CSV for accounting and audit.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ReportCard testid="report-sales" title="Sales Report" desc={`${sales.length} transactions`} onDl={exportSales} />
        <ReportCard testid="report-inventory" title="Inventory Report" desc={`${products.length} products`} onDl={exportProducts} />
        <ReportCard testid="report-customers" title="Customer Report" desc={`${customers.length} customers`} onDl={exportCustomers} />
      </div>

      {summary && (
        <Card className="glass rounded-2xl">
          <CardHeader>
            <CardTitle style={{ fontFamily: "Outfit" }}>Revenue trend</CardTitle>
            <CardDescription>7-day rolling window</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.sales_trend}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Bar dataKey="total" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReportCard({ title, desc, onDl, testid }) {
  return (
    <Card className="glass rounded-2xl" data-testid={testid}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="font-semibold text-lg" style={{ fontFamily: "Outfit" }}>{title}</div>
          <div className="text-sm text-muted-foreground">{desc}</div>
        </div>
        <Button className="w-full mt-4" variant="outline" onClick={onDl}>
          <Download className="h-4 w-4 mr-2" />Download CSV
        </Button>
      </CardContent>
    </Card>
  );
}

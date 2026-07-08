import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { api, formatINR } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Printer, FileText } from "lucide-react";

const fetcher = (url) => api.get(url).then((r) => r.data);

export default function Sales() {
  const nav = useNavigate();
  const { data: sales = [] } = useSWR("/sales", fetcher);
  const [selected, setSelected] = useState(null);

  return (
    <div className="space-y-6" data-testid="sales-page">
      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Transactions</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "Outfit" }}>Sales Ledger</h1>
        <p className="text-sm text-muted-foreground mt-1">Every invoice, in order.</p>
      </div>

      <Card className="glass rounded-2xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Cashier</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id} data-testid={`sale-row-${s.invoice_number}`}>
                  <TableCell className="font-mono text-xs">{s.invoice_number}</TableCell>
                  <TableCell className="text-xs">{new Date(s.created_at).toLocaleString("en-IN")}</TableCell>
                  <TableCell>{s.customer_name}</TableCell>
                  <TableCell>{s.cashier_name}</TableCell>
                  <TableCell><Badge variant="outline" className="uppercase">{s.payment_method}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{formatINR(s.grand_total)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={s.status === "completed" ? "secondary" : "destructive"}>{s.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => setSelected(s)}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => nav(`/invoice/${s.id}`)} data-testid={`view-invoice-${s.invoice_number}`}><FileText className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {sales.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No sales yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Outfit" }}>
              Invoice {selected?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Customer</span><div className="font-medium">{selected.customer_name}</div></div>
                <div><span className="text-muted-foreground">Cashier</span><div className="font-medium">{selected.cashier_name}</div></div>
                <div><span className="text-muted-foreground">Date</span><div className="font-medium">{new Date(selected.created_at).toLocaleString("en-IN")}</div></div>
                <div><span className="text-muted-foreground">Payment</span><div className="font-medium uppercase">{selected.payment_method}</div></div>
              </div>
              <div className="border-t border-border pt-3">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">GST</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {selected.items.map((it, i) => (
                      <TableRow key={i}>
                        <TableCell>{it.product_name}</TableCell>
                        <TableCell className="text-right">{it.quantity}</TableCell>
                        <TableCell className="text-right">{formatINR(it.unit_price)}</TableCell>
                        <TableCell className="text-right">{formatINR(it.gst_amount)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatINR(it.line_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between text-lg pt-2 border-t border-border">
                <span className="font-semibold">Grand Total</span>
                <span className="font-bold" style={{ fontFamily: "Outfit" }}>{formatINR(selected.grand_total)}</span>
              </div>
              <Button variant="outline" className="w-full" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />Print
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

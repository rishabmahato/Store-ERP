import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, formatINR } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

// Convert number to Indian words
function numToWords(num) {
  if (num === 0) return "Zero";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + inWords(n % 100) : "");
    if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + inWords(n % 1000) : "");
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + inWords(n % 100000) : "");
    return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + inWords(n % 10000000) : "");
  };
  return inWords(Math.round(num));
}

export default function Invoice() {
  const { id } = useParams();
  const nav = useNavigate();
  const [sale, setSale] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await api.get(`/sales/${id}`);
      setSale(s);
      const { data: st } = await api.get("/settings");
      setSettings(st);
      if (s.customer_id) {
        try {
          const { data: cs } = await api.get("/customers");
          setCustomer(cs.find((c) => c.id === s.customer_id) || null);
        } catch (_e) {}
      }
    })();
  }, [id]);

  if (!sale || !settings) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const gstOn = sale.gst_enabled !== false; // default true for legacy sales

  // Group tax by rate (only meaningful when GST on)
  const rateGroups = {};
  sale.items.forEach((it) => {
    const r = it.gst_rate;
    if (!rateGroups[r]) rateGroups[r] = { qty: 0, taxable: 0, cgst: 0, sgst: 0, amount: 0 };
    const taxable = it.unit_price * it.quantity - it.discount;
    rateGroups[r].qty += it.quantity;
    rateGroups[r].taxable += taxable;
    rateGroups[r].cgst += it.gst_amount / 2;
    rateGroups[r].sgst += it.gst_amount / 2;
    rateGroups[r].amount += it.line_total;
  });

  const totalCGST = sale.total_gst / 2;
  const totalSGST = sale.total_gst / 2;
  const grand = Math.round(sale.grand_total);
  const rounded = grand - sale.grand_total;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 print:p-0">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <Button variant="outline" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          <Button onClick={() => window.print()} data-testid="print-invoice-btn">
            <Printer className="h-4 w-4 mr-2" />Print / Save PDF
          </Button>
        </div>

        <div className="bg-white text-black rounded-xl shadow-lg print:shadow-none print:rounded-none" id="invoice-body">
          <div className="p-8 print:p-6" style={{ fontFamily: "Inter, sans-serif", fontSize: "12px" }}>
            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b-2 border-slate-900">
              <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "Outfit" }}>
                  {settings.business_name}
                </h1>
                <div className="text-xs text-slate-600 mt-1">{settings.address_line1}</div>
                <div className="text-xs text-slate-600">{settings.address_line2}</div>
                <div className="text-xs text-slate-600 mt-1">Phone: {settings.phone}</div>
                <div className="text-xs text-slate-600">Email: {settings.email}</div>
                {gstOn && <div className="text-xs font-semibold mt-1">GSTIN: {settings.gstin}</div>}
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">{gstOn ? "Original for Recipient" : "Cash Memo"}</div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: "Outfit" }}>
                  {gstOn ? "INVOICE" : "BILL"} #{sale.invoice_number}
                </h2>
                <div className="text-xs mt-2"><b>Date:</b> {new Date(sale.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
                <div className="text-xs"><b>Due Date:</b> {new Date(sale.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
                <div className="text-xs"><b>Payment:</b> {sale.payment_method.toUpperCase()}</div>
              </div>
            </div>

            {/* Bill to / Ship to */}
            <div className="grid grid-cols-2 gap-6 py-4 border-b border-slate-300">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Bill to</div>
                <div className="font-bold">{sale.customer_name}</div>
                {customer && (
                  <>
                    <div className="text-xs text-slate-600">{customer.address}</div>
                    <div className="text-xs text-slate-600">Phone: {customer.phone}</div>
                    {gstOn && customer.gst_number && <div className="text-xs mt-1"><b>GSTIN:</b> {customer.gst_number}</div>}
                  </>
                )}
                {gstOn && <div className="text-xs mt-1"><b>Place of Supply:</b> {settings.state_name} ({settings.state_code})</div>}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Ship to</div>
                <div className="font-bold">{sale.customer_name}</div>
                {customer && (
                  <>
                    <div className="text-xs text-slate-600">{customer.address}</div>
                    <div className="text-xs text-slate-600">Phone: {customer.phone}</div>
                  </>
                )}
              </div>
            </div>

            {/* Items */}
            <table className="w-full mt-4 text-xs">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-2 text-left">NO</th>
                  <th className="p-2 text-left">PRODUCT / SERVICE</th>
                  {gstOn && <th className="p-2 text-left">HSN/SAC</th>}
                  <th className="p-2 text-right">QTY</th>
                  <th className="p-2 text-right">UNIT PRICE</th>
                  {gstOn && <th className="p-2 text-right">CGST</th>}
                  {gstOn && <th className="p-2 text-right">SGST</th>}
                  <th className="p-2 text-right">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((it, i) => (
                  <tr key={i} className="border-b border-slate-200 align-top">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">
                      <div>{it.product_name}</div>
                      {it.model && <div className="text-[10px] text-slate-500">Model: {it.model}</div>}
                      {it.serial_numbers && it.serial_numbers.length > 0 && (
                        <div className="text-[10px] text-slate-500">SN: {it.serial_numbers.join(", ")}</div>
                      )}
                    </td>
                    {gstOn && <td className="p-2 font-mono">{it.hsn_code || "-"}</td>}
                    <td className="p-2 text-right">{it.quantity}.00</td>
                    <td className="p-2 text-right">{formatINR(it.unit_price)}</td>
                    {gstOn && <td className="p-2 text-right">{formatINR(it.gst_amount / 2)}</td>}
                    {gstOn && <td className="p-2 text-right">{formatINR(it.gst_amount / 2)}</td>}
                    <td className="p-2 text-right font-semibold">{formatINR(it.line_total)}</td>
                  </tr>
                ))}
                {/* Rate subtotals (only when GST is on) */}
                {gstOn && Object.entries(rateGroups).map(([r, g]) => (
                  <tr key={r} className="bg-slate-100 text-xs">
                    <td colSpan={2} className="p-2 font-semibold">@ {r}%</td>
                    <td className="p-2"></td>
                    <td className="p-2 text-right">{g.qty}.00</td>
                    <td className="p-2 text-right">{formatINR(g.taxable)}</td>
                    <td className="p-2 text-right">{formatINR(g.cgst)}</td>
                    <td className="p-2 text-right">{formatINR(g.sgst)}</td>
                    <td className="p-2 text-right">{formatINR(g.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-900 text-white font-bold">
                  <td colSpan={2} className="p-2">TOTAL</td>
                  {gstOn && <td className="p-2"></td>}
                  <td className="p-2 text-right">{sale.items.reduce((a, i) => a + i.quantity, 0)}.00</td>
                  <td className="p-2 text-right">{formatINR(sale.subtotal)}</td>
                  {gstOn && <td className="p-2 text-right">{formatINR(totalCGST)}</td>}
                  {gstOn && <td className="p-2 text-right">{formatINR(totalSGST)}</td>}
                  <td className="p-2 text-right">{formatINR(sale.grand_total)}</td>
                </tr>
              </tbody>
            </table>

            {/* Totals + Amount in words */}
            <div className="grid grid-cols-2 gap-6 mt-4">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Total in words</div>
                <div className="text-xs font-medium mt-1">{numToWords(grand)} Rupees Only</div>
                {settings.bank_name && (
                  <div className="mt-4 text-xs">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Bank details</div>
                    <div>{settings.bank_name}</div>
                    <div>A/c: {settings.bank_account}</div>
                    <div>IFSC: {settings.bank_ifsc}</div>
                  </div>
                )}
              </div>
              <div className="text-xs">
                <Row label="Total before tax" value={formatINR(sale.subtotal)} />
                {gstOn && <Row label="CGST" value={formatINR(totalCGST)} />}
                {gstOn && <Row label="SGST" value={formatINR(totalSGST)} />}
                {gstOn && <Row label="Total tax" value={formatINR(sale.total_gst)} />}
                {sale.bill_discount > 0 && <Row label="Bill discount" value={`(-) ${formatINR(sale.bill_discount)}`} />}
                <Row label="Rounded off" value={formatINR(rounded)} />
                <div className="flex justify-between py-2 border-t-2 border-b-2 border-slate-900 font-bold text-base mt-1">
                  <span>TOTAL AMOUNT</span><span>{formatINR(grand)}</span>
                </div>
                <Row label="Amount received" value={`(-) ${formatINR(sale.payment_received)}`} />
                <div className="flex justify-between py-1 font-bold">
                  <span>Amount due</span><span>{formatINR(sale.balance)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="grid grid-cols-2 gap-6 mt-8 pt-4 border-t border-slate-300 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Note</div>
                <div className="whitespace-pre-line text-slate-600">{settings.invoice_note}</div>
              </div>
              <div className="text-right">
                <div className="h-16" />
                <div className="border-t border-slate-400 pt-1 inline-block px-6 text-[10px] uppercase tracking-widest text-slate-600">
                  Authorized Signatory
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          #invoice-body { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between py-1"><span className="text-slate-600">{label}</span><span className="font-medium">{value}</span></div>;
}

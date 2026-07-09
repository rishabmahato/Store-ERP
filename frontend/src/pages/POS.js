import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useSWR, { mutate } from "swr";
import { api, formatINR } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, Minus, Trash2, ShoppingCart, ScanLine, X, UserPlus, PackagePlus, Tag, FileText, Pencil, Eye, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import BarcodeScanner from "@/components/BarcodeScanner";
import { Switch } from "@/components/ui/switch";

const fetcher = (url) => api.get(url).then((r) => r.data);

export default function POS() {
  const nav = useNavigate();
  const { data: products = [] } = useSWR("/products", fetcher);
  const { data: customers = [] } = useSWR("/customers", fetcher);
  const { data: categories = [] } = useSWR("/categories", fetcher);
  const { data: brands = [] } = useSWR("/brands", fetcher);

  const [q, setQ] = useState("");
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState("walkin");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [payment, setPayment] = useState("cash");
  const [received, setReceived] = useState(0);
  const [scanOpen, setScanOpen] = useState(false);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [editingIdx, setEditingIdx] = useState(null);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [addBrandOpen, setAddBrandOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "", gst_number: "", address: "" });
  const [newProduct, setNewProduct] = useState({ name: "", brand_id: "", category_id: "", selling_price: 0, gst_rate: 18, quantity: 1, hsn_code: "" });
  const [newBrand, setNewBrand] = useState({ name: "", country: "" });
  const [billDiscount, setBillDiscount] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [serialInputs, setSerialInputs] = useState({});

  // Reopen a cancelled sale as a new draft
  useEffect(() => {
    const raw = localStorage.getItem("le_reopen_sale");
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      const items = (s.items || []).map((it) => {
        const gross = it.gst_rate > 0 ? it.unit_price * (1 + it.gst_rate / 100) : it.unit_price;
        return {
          product_id: it.product_id, product_name: it.product_name, sku: it.sku,
          hsn_code: it.hsn_code || "", model: it.model || "",
          quantity: it.quantity, gross_price: Number(gross.toFixed(2)), unit_price: it.unit_price,
          discount: it.discount || 0, gst_rate: it.gst_rate,
          gst_amount: 0, line_total: 0, stock: 9999,
        };
      });
      setCart(items);
      if (s.customer_id) setCustomerId(s.customer_id);
      setGstEnabled(s.gst_enabled !== false);
      setBillDiscount(s.bill_discount || 0);
      toast.info(`Reopened ${s.invoice_number} as new draft. Adjust and re-issue.`);
    } catch (_e) {}
    localStorage.removeItem("le_reopen_sale");
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      [p.name, p.sku, p.model, p.barcode, p.hsn_code].some((v) => (v || "").toLowerCase().includes(term))
    );
  }, [products, q]);

  const addToCart = (p) => {
    if (p.quantity <= 0) return toast.error("Out of stock");
    setCart((c) => {
      const idx = c.findIndex((i) => i.product_id === p.id);
      if (idx >= 0) {
        if (c[idx].quantity + 1 > p.quantity) { toast.error("Not enough stock"); return c; }
        const copy = [...c]; copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 }; return copy;
      }
      // gross_price is what user sees — GST-inclusive. unit_price is derived for the backend.
      return [...c, {
        product_id: p.id, product_name: p.name, sku: p.sku, hsn_code: p.hsn_code || "",
        quantity: 1, gross_price: p.selling_price, unit_price: p.selling_price,
        discount: 0, gst_rate: p.gst_rate,
        gst_amount: 0, line_total: 0, stock: p.quantity,
      }];
    });
  };

  const editGrossPrice = (idx, value) => {
    setCart((c) => {
      const copy = [...c];
      copy[idx] = { ...copy[idx], gross_price: Number(value) || 0 };
      return copy;
    });
  };

  const handleScan = (code) => {
    const p = products.find((x) => (x.barcode || x.sku).toLowerCase() === code.toLowerCase());
    if (p) { addToCart(p); toast.success(`Added ${p.name}`); }
    else { setQ(code); toast.error("No product for this barcode"); }
  };

  const updateQty = (idx, delta) => {
    setCart((c) => {
      const item = c[idx];
      const newQty = item.quantity + delta;
      if (newQty <= 0) return c.filter((_, i) => i !== idx);
      if (newQty > item.stock) { toast.error("Not enough stock"); return c; }
      const copy = [...c]; copy[idx] = { ...item, quantity: newQty }; return copy;
    });
  };

  const totals = useMemo(() => {
    let subtotal = 0, gst = 0, discount = 0;
    cart.forEach((i) => {
      const effectiveGst = gstEnabled ? i.gst_rate : 0;
      const netUnit = effectiveGst > 0 ? i.gross_price / (1 + effectiveGst / 100) : i.gross_price;
      const base = netUnit * i.quantity - (i.discount || 0);
      subtotal += base; gst += (base * effectiveGst) / 100; discount += (i.discount || 0);
    });
    const beforeBillDisc = subtotal + gst;
    const bd = Number(billDiscount || 0);
    return { subtotal, gst, discount: discount + bd, grand: Math.max(0, beforeBillDisc - bd) };
  }, [cart, gstEnabled, billDiscount]);

  const checkout = async () => {
    if (cart.length === 0) return toast.error("Cart is empty");
    try {
      const cust = customers.find((c) => c.id === customerId);
      // Compute net unit_price (excl. GST) for backend since backend adds GST on top.
      const items = cart.map(({ stock, gross_price, ...rest }) => {
        const effectiveGst = gstEnabled ? rest.gst_rate : 0;
        const netUnit = effectiveGst > 0 ? gross_price / (1 + effectiveGst / 100) : gross_price;
        const raw = (serialInputs[rest.product_id] || "").split(",").map((s) => s.trim()).filter(Boolean);
        return {
          ...rest,
          model: rest.model || "",
          serial_numbers: raw,
          unit_price: Number(netUnit.toFixed(4)),
          discount: Number(rest.discount || 0),
        };
      });
      const payload = {
        customer_id: customerId === "walkin" ? null : customerId,
        customer_name: cust ? cust.name : "Walk-in Customer",
        items,
        payment_method: payment,
        payment_received: payment === "credit" ? Number(received || 0) : totals.grand,
        gst_enabled: gstEnabled,
        bill_discount: Number(billDiscount || 0),
      };
      const { data } = await api.post("/sales", payload);
      toast.success(`${gstEnabled ? "Invoice" : "Bill"} ${data.invoice_number} generated`);
      setCart([]); setReceived(0); setBillDiscount(0); setSerialInputs({}); setPreviewOpen(false);
      mutate("/products"); mutate("/sales"); mutate("/dashboard/summary");
      nav(`/invoice/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Checkout failed");
    }
  };

  const saveCustomer = async () => {
    if (!newCustomer.name) return toast.error("Name required");
    const { data } = await api.post("/customers", newCustomer);
    mutate("/customers"); setCustomerId(data.id); setAddCustomerOpen(false);
    setNewCustomer({ name: "", phone: "", email: "", gst_number: "", address: "" });
    toast.success("Customer added & selected");
  };

  const saveProduct = async () => {
    if (!newProduct.name) return toast.error("Name required");
    // Selling price is GST-inclusive; derive net for storage
    const gst = Number(newProduct.gst_rate) || 0;
    const gross = Number(newProduct.selling_price) || 0;
    const net = gst > 0 ? gross / (1 + gst / 100) : gross;
    const { data } = await api.post("/products", {
      ...newProduct,
      selling_price: Number(net.toFixed(2)),
      purchase_price: 0,
      gst_rate: gst,
      quantity: Number(newProduct.quantity),
    });
    // For cart display, show the gross price the user entered
    mutate("/products"); setAddProductOpen(false);
    addToCart({ ...data, selling_price: gross });
    setNewProduct({ name: "", brand_id: "", category_id: "", selling_price: 0, gst_rate: 18, quantity: 1, hsn_code: "" });
    toast.success("Product added to cart");
  };

  const saveBrand = async () => {
    if (!newBrand.name) return toast.error("Name required");
    await api.post("/brands", newBrand);
    mutate("/brands"); setAddBrandOpen(false); setNewBrand({ name: "", country: "" });
    toast.success("Brand added");
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" data-testid="pos-page">
      <div className="xl:col-span-2 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">POS Billing</div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "Outfit" }}>Fast Checkout</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setAddProductOpen(true)} data-testid="quick-add-product"><PackagePlus className="h-4 w-4 mr-1" />Item</Button>
            <Button variant="outline" onClick={() => setAddBrandOpen(true)} data-testid="quick-add-brand"><Tag className="h-4 w-4 mr-1" />Brand</Button>
            <Button variant="outline" onClick={() => setAddCustomerOpen(true)} data-testid="quick-add-customer"><UserPlus className="h-4 w-4 mr-1" />Customer</Button>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="pos-search"
              placeholder="Search or scan barcode…"
              value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && q) {
                  const hit = products.find((p) => (p.barcode || p.sku).toLowerCase() === q.toLowerCase());
                  if (hit) { addToCart(hit); setQ(""); }
                }
              }}
              className="pl-9 h-11 rounded-xl"
              autoFocus
            />
          </div>
          <Button variant="outline" onClick={() => setScanOpen(true)} className="h-11" data-testid="scan-btn">
            <ScanLine className="h-4 w-4 mr-2" />Scan
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              data-testid={`pos-product-${p.sku}`}
              onClick={() => addToCart(p)}
              disabled={p.quantity <= 0}
              className="text-left rounded-xl border border-border bg-card p-3 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="aspect-square w-full rounded-lg overflow-hidden bg-secondary mb-2">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                ) : <div className="grid place-items-center h-full text-muted-foreground text-xs">No image</div>}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{p.sku}</div>
              <div className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{p.name}</div>
              <div className="mt-1 flex items-center justify-between">
                <div className="font-semibold text-sm">{formatINR(p.selling_price)}</div>
                <Badge variant={p.quantity > 5 ? "secondary" : "destructive"} className="text-[10px]">{p.quantity} left</Badge>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart panel */}
      <div className="space-y-4">
        <Card className="glass rounded-2xl sticky top-4">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <h2 className="font-semibold text-lg" style={{ fontFamily: "Outfit" }}>Current Bill</h2>
              </div>
              <Badge variant="secondary">{cart.length} items</Badge>
            </div>

            <div className="mb-3">
              <label className="text-xs text-muted-foreground">Customer</label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerOpen}
                    className="w-full justify-between font-normal"
                    data-testid="pos-customer-select"
                  >
                    <span className="truncate">
                      {customerId === "walkin"
                        ? "Walk-in Customer"
                        : (() => {
                            const c = customers.find((c) => c.id === customerId);
                            return c ? `${c.name} · ${c.phone}` : "Select customer";
                          })()}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Search name or phone..." data-testid="pos-customer-search" />
                    <CommandList>
                      <CommandEmpty>No customer found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="Walk-in Customer"
                          onSelect={() => { setCustomerId("walkin"); setCustomerOpen(false); }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${customerId === "walkin" ? "opacity-100" : "opacity-0"}`} />
                          Walk-in Customer
                        </CommandItem>
                        {customers.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.name} ${c.phone}`}
                            onSelect={() => { setCustomerId(c.id); setCustomerOpen(false); }}
                            data-testid={`customer-option-${c.id}`}
                          >
                            <Check className={`mr-2 h-4 w-4 ${customerId === c.id ? "opacity-100" : "opacity-0"}`} />
                            {c.name} · {c.phone}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {cart.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">Add products to start billing</div>}
              {cart.map((item, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-secondary/40 space-y-1.5" data-testid={`cart-item-${item.sku}`}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.product_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {gstEnabled && item.gst_rate > 0 ? `Incl. ${item.gst_rate}% GST` : "No GST"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(idx, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(idx, +1)}><Plus className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setCart((c) => c.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-1">
                    <span className="text-xs text-muted-foreground">Price:</span>
                    {editingIdx === idx ? (
                      <Input
                        type="number"
                        value={item.gross_price}
                        onChange={(e) => editGrossPrice(idx, e.target.value)}
                        onBlur={() => setEditingIdx(null)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingIdx(null)}
                        className="h-7 text-xs w-24"
                        autoFocus
                        data-testid={`price-edit-${item.sku}`}
                      />
                    ) : (
                      <button
                        className="text-sm font-semibold hover:underline flex items-center gap-1"
                        onClick={() => setEditingIdx(idx)}
                        data-testid={`price-btn-${item.sku}`}
                      >
                        {formatINR(item.gross_price)}
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      = {formatINR(item.gross_price * item.quantity - (item.discount || 0))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-1">
                    <span className="text-xs text-muted-foreground w-10">GST</span>
                    <Select
                      value={String(item.gst_rate)}
                      onValueChange={(v) => setCart((c) => { const cp = [...c]; cp[idx] = { ...cp[idx], gst_rate: Number(v) }; return cp; })}
                    >
                      <SelectTrigger className="h-7 text-xs w-20" data-testid={`gst-slab-${item.sku}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[0, 5, 12, 18, 28].map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground ml-2">Disc</span>
                    <Input
                      type="number"
                      className="h-7 text-xs w-20"
                      value={item.discount || 0}
                      onChange={(e) => setCart((c) => { const cp = [...c]; cp[idx] = { ...cp[idx], discount: Number(e.target.value) || 0 }; return cp; })}
                      data-testid={`line-discount-${item.sku}`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border mt-4 pt-4 space-y-1.5 text-sm">
              <div className="flex items-center justify-between px-1 py-2 rounded-lg bg-secondary/50">
                <div>
                  <div className="text-sm font-medium">GST Invoice</div>
                  <div className="text-[10px] text-muted-foreground">Toggle off for non-GST bill</div>
                </div>
                <Switch checked={gstEnabled} onCheckedChange={setGstEnabled} data-testid="gst-toggle" />
              </div>
              <div className="flex justify-between text-muted-foreground"><span>Subtotal (excl. tax)</span><span>{formatINR(totals.subtotal)}</span></div>
              {gstEnabled && <div className="flex justify-between text-muted-foreground"><span>GST</span><span>{formatINR(totals.gst)}</span></div>}
              <div className="flex items-center justify-between gap-2 text-muted-foreground">
                <span className="shrink-0">Bill discount</span>
                <Input
                  type="number"
                  value={billDiscount}
                  onChange={(e) => setBillDiscount(e.target.value)}
                  className="h-7 w-24 text-xs text-right"
                  data-testid="bill-discount-input"
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between text-xl font-bold pt-1">
                <span style={{ fontFamily: "Outfit" }}>Total</span>
                <span data-testid="cart-total">{formatINR(totals.grand)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Select value={payment} onValueChange={setPayment}>
                <SelectTrigger data-testid="pos-payment-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="emi">EMI / Finance</SelectItem>
                  <SelectItem value="credit">Credit (partial)</SelectItem>
                </SelectContent>
              </Select>
              {payment === "credit" && (
                <Input type="number" placeholder="Amount received" value={received} onChange={(e) => setReceived(e.target.value)} data-testid="pos-received-input" />
              )}
              <Button className="w-full h-11 text-base font-semibold" onClick={() => setPreviewOpen(true)} disabled={cart.length === 0} data-testid="pos-preview-btn">
                <Eye className="h-4 w-4 mr-2" />Preview Bill
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scanner */}
      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onDetect={handleScan} />

      {/* Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle style={{ fontFamily: "Outfit" }}>Review before finalising</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><b>{customers.find((c) => c.id === customerId)?.name || "Walk-in Customer"}</b></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><b className="uppercase">{payment}</b></div>
            <div className="flex justify-between"><span className="text-muted-foreground">GST</span><b>{gstEnabled ? "Enabled" : "Disabled"}</b></div>
            <div className="border-t border-border pt-2 space-y-2 max-h-64 overflow-y-auto">
              {cart.map((it, i) => (
                <div key={i} className="p-2 rounded bg-secondary/40">
                  <div className="flex justify-between text-sm"><span>{it.product_name} × {it.quantity}</span><b>{formatINR(it.gross_price * it.quantity - (it.discount || 0))}</b></div>
                  <div className="mt-1">
                    <Label className="text-[10px] text-muted-foreground">Serial numbers (comma-separated, optional)</Label>
                    <Input
                      value={serialInputs[it.product_id] || ""}
                      onChange={(e) => setSerialInputs({ ...serialInputs, [it.product_id]: e.target.value })}
                      placeholder="SN-1, SN-2"
                      className="h-8 text-xs mt-1"
                      data-testid={`serial-input-${it.sku}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-lg pt-2 border-t border-border"><b>Grand Total</b><b>{formatINR(totals.grand)}</b></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)} data-testid="preview-back-btn">Back to Edit</Button>
            <Button onClick={checkout} data-testid="pos-checkout"><FileText className="h-4 w-4 mr-2" />Confirm &amp; Generate Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick-add customer */}
      <Dialog open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Quick add customer</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name</Label><Input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} data-testid="quick-customer-name" /></div>
            <div><Label>Phone</Label><Input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} /></div>
            <div className="col-span-2"><Label>GSTIN</Label><Input value={newCustomer.gst_number} onChange={(e) => setNewCustomer({ ...newCustomer, gst_number: e.target.value })} /></div>
            <div className="col-span-2"><Label>Address</Label><Input value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddCustomerOpen(false)}>Cancel</Button><Button onClick={saveCustomer} data-testid="save-quick-customer">Add & Select</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick-add product */}
      <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Quick add product</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name</Label><Input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} data-testid="quick-product-name" /></div>
            <div><Label>Brand</Label>
              <Select value={newProduct.brand_id || ""} onValueChange={(v) => setNewProduct({ ...newProduct, brand_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Category</Label>
              <Select value={newProduct.category_id || ""} onValueChange={(v) => setNewProduct({ ...newProduct, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Selling Price (incl. GST)</Label><Input type="number" value={newProduct.selling_price} onChange={(e) => setNewProduct({ ...newProduct, selling_price: e.target.value })} data-testid="quick-product-price" /></div>
            <div><Label>GST %</Label>
              <Select value={String(newProduct.gst_rate)} onValueChange={(v) => setNewProduct({ ...newProduct, gst_rate: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[0,5,12,18,28].map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Quantity</Label><Input type="number" value={newProduct.quantity} onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })} /></div>
            <div className="col-span-2"><Label>HSN / SAC code</Label><Input value={newProduct.hsn_code} onChange={(e) => setNewProduct({ ...newProduct, hsn_code: e.target.value })} placeholder="e.g. 84182100" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddProductOpen(false)}>Cancel</Button><Button onClick={saveProduct} data-testid="save-quick-product">Add to Cart</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick-add brand */}
      <Dialog open={addBrandOpen} onOpenChange={setAddBrandOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Quick add brand</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={newBrand.name} onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })} data-testid="quick-brand-name" /></div>
            <div><Label>Country</Label><Input value={newBrand.country} onChange={(e) => setNewBrand({ ...newBrand, country: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddBrandOpen(false)}>Cancel</Button><Button onClick={saveBrand} data-testid="save-quick-brand">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
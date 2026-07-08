import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useSWR, { mutate } from "swr";
import { api, formatINR } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, Minus, Trash2, ShoppingCart, ScanLine, X, UserPlus, PackagePlus, Tag, FileText } from "lucide-react";
import { toast } from "sonner";
import BarcodeScanner from "@/components/BarcodeScanner";

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
  const [payment, setPayment] = useState("cash");
  const [received, setReceived] = useState(0);
  const [scanOpen, setScanOpen] = useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [addBrandOpen, setAddBrandOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "", gst_number: "", address: "" });
  const [newProduct, setNewProduct] = useState({ name: "", brand_id: "", category_id: "", selling_price: 0, purchase_price: 0, gst_rate: 18, quantity: 1, hsn_code: "" });
  const [newBrand, setNewBrand] = useState({ name: "", country: "" });

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
      return [...c, {
        product_id: p.id, product_name: p.name, sku: p.sku, hsn_code: p.hsn_code || "",
        quantity: 1, unit_price: p.selling_price, discount: 0, gst_rate: p.gst_rate,
        gst_amount: 0, line_total: 0, stock: p.quantity,
      }];
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
      const base = i.unit_price * i.quantity - i.discount;
      subtotal += base; gst += (base * i.gst_rate) / 100; discount += i.discount;
    });
    return { subtotal, gst, discount, grand: subtotal + gst };
  }, [cart]);

  const checkout = async () => {
    if (cart.length === 0) return toast.error("Cart is empty");
    try {
      const cust = customers.find((c) => c.id === customerId);
      const payload = {
        customer_id: customerId === "walkin" ? null : customerId,
        customer_name: cust ? cust.name : "Walk-in Customer",
        items: cart.map(({ stock, ...rest }) => rest),
        payment_method: payment,
        payment_received: payment === "credit" ? Number(received || 0) : totals.grand,
      };
      const { data } = await api.post("/sales", payload);
      toast.success(`Invoice ${data.invoice_number} generated`);
      setCart([]); setReceived(0);
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
    const { data } = await api.post("/products", {
      ...newProduct,
      selling_price: Number(newProduct.selling_price),
      purchase_price: Number(newProduct.purchase_price),
      gst_rate: Number(newProduct.gst_rate),
      quantity: Number(newProduct.quantity),
    });
    mutate("/products"); setAddProductOpen(false); addToCart(data);
    setNewProduct({ name: "", brand_id: "", category_id: "", selling_price: 0, purchase_price: 0, gst_rate: 18, quantity: 1, hsn_code: "" });
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
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger data-testid="pos-customer-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="walkin">Walk-in Customer</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.phone}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {cart.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">Add products to start billing</div>}
              {cart.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40" data-testid={`cart-item-${item.sku}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.product_name}</div>
                    <div className="text-xs text-muted-foreground">{formatINR(item.unit_price)} × {item.quantity}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(idx, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(idx, +1)}><Plus className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setCart((c) => c.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border mt-4 pt-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatINR(totals.subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>GST</span><span>{formatINR(totals.gst)}</span></div>
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
              <Button className="w-full h-11 text-base font-semibold" onClick={checkout} disabled={cart.length === 0} data-testid="pos-checkout">
                <FileText className="h-4 w-4 mr-2" />Complete Sale &amp; Print Invoice
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scanner */}
      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onDetect={handleScan} />

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
            <div><Label>Selling Price</Label><Input type="number" value={newProduct.selling_price} onChange={(e) => setNewProduct({ ...newProduct, selling_price: e.target.value })} data-testid="quick-product-price" /></div>
            <div><Label>Purchase Price</Label><Input type="number" value={newProduct.purchase_price} onChange={(e) => setNewProduct({ ...newProduct, purchase_price: e.target.value })} /></div>
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

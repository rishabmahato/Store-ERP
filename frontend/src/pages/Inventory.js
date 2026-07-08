import React, { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { api, formatINR } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, PackagePlus, Pencil, Trash2, Upload, Layers } from "lucide-react";
import { toast } from "sonner";

const fetcher = (url) => api.get(url).then((r) => r.data);

const emptyProduct = {
  name: "", model: "", color: "", capacity: "",
  category_id: "", brand_id: "",
  purchase_price: 0, selling_price: 0, gst_rate: 18,
  quantity: 0, reorder_level: 5, image_url: "", warranty_months: 12, hsn_code: "",
  serial_number: "", purchase_bill_number: "", source_of_procurement: "",
};

export default function Inventory() {
  const { data: products = [] } = useSWR("/products", fetcher);
  const { data: categories = [] } = useSWR("/categories", fetcher);
  const { data: brands = [] } = useSWR("/brands", fetcher);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [adjustOpen, setAdjustOpen] = useState(null);
  const [adjustDelta, setAdjustDelta] = useState(0);
  const [unitsOpen, setUnitsOpen] = useState(null);
  const [units, setUnits] = useState([]);
  const [newUnit, setNewUnit] = useState({ serial_number: "", purchase_price: 0, selling_price: 0, purchase_bill_number: "", source_of_procurement: "", purchase_bill_url: "" });

  const loadUnits = async (p) => {
    setUnitsOpen(p);
    const { data } = await api.get(`/products/${p.id}/units`);
    setUnits(data);
  };
  const addUnit = async () => {
    if (!newUnit.serial_number) return toast.error("Serial number required");
    await api.post(`/products/${unitsOpen.id}/units`, {
      ...newUnit,
      purchase_price: Number(newUnit.purchase_price),
      selling_price: Number(newUnit.selling_price) || unitsOpen.selling_price,
    });
    const { data } = await api.get(`/products/${unitsOpen.id}/units`);
    setUnits(data);
    setNewUnit({ serial_number: "", purchase_price: 0, selling_price: 0, purchase_bill_number: "", source_of_procurement: "", purchase_bill_url: "" });
    mutate("/products");
    toast.success("Unit added, stock incremented");
  };
  const removeUnit = async (uid) => {
    if (!window.confirm("Delete this unit?")) return;
    await api.delete(`/units/${uid}`);
    setUnits((u) => u.filter((x) => x.id !== uid));
    mutate("/products");
  };

  const filtered = useMemo(() => {
    if (!q) return products;
    const t = q.toLowerCase();
    return products.filter((p) => [p.name, p.sku, p.model].some((v) => (v || "").toLowerCase().includes(t)));
  }, [products, q]);

  const openNew = () => { setEditing(null); setForm(emptyProduct); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...emptyProduct, ...p }); setOpen(true); };

  // Auto-fill from existing product when model matches
  const lookupByModel = async (modelVal) => {
    if (!modelVal || editing) return;
    try {
      const { data } = await api.get(`/products/find-by-model`, { params: { model: modelVal } });
      if (data) {
        // Copy shared fields, keep unit-specific fields empty
        setForm((f) => ({
          ...f,
          name: data.name, category_id: data.category_id, brand_id: data.brand_id,
          color: data.color, capacity: data.capacity, hsn_code: data.hsn_code || "",
          purchase_price: data.purchase_price, selling_price: data.selling_price,
          gst_rate: data.gst_rate, warranty_months: data.warranty_months,
          image_url: data.image_url, reorder_level: data.reorder_level,
          // Keep unit-specific empty: serial_number, purchase_bill_number, source_of_procurement, quantity
        }));
        toast.success(`Copied details from existing ${data.name}. Fill Serial/Source for new stock.`);
      }
    } catch (_e) {}
  };

  const bulkImport = async (file) => {
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return toast.error("CSV needs header + data rows");
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((ln) => {
      const parts = ln.split(",").map((v) => v.trim());
      const obj = {}; headers.forEach((h, i) => { obj[h] = parts[i]; });
      return obj;
    });
    try {
      const { data } = await api.post("/products/bulk", { rows });
      toast.success(`Imported ${data.created} products` + (data.errors.length ? ` (${data.errors.length} errors)` : ""));
      mutate("/products");
    } catch (err) { toast.error(err.response?.data?.detail || "Import failed"); }
  };

  const save = async () => {
    try {
      const payload = { ...form,
        purchase_price: Number(form.purchase_price),
        selling_price: Number(form.selling_price),
        gst_rate: Number(form.gst_rate),
        quantity: Number(form.quantity),
        reorder_level: Number(form.reorder_level),
        warranty_months: Number(form.warranty_months),
      };
      if (!payload.name) return toast.error("Name required");
      if (editing) {
        await api.put(`/products/${editing.id}`, payload);
        toast.success("Product updated");
      } else {
        await api.post("/products", payload);
        toast.success("Product added");
      }
      setOpen(false);
      mutate("/products"); mutate("/dashboard/summary");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed");
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete ${p.name}?`)) return;
    await api.delete(`/products/${p.id}`);
    toast.success("Deleted");
    mutate("/products");
  };

  const adjust = async () => {
    if (!adjustOpen) return;
    await api.post(`/products/${adjustOpen.id}/adjust-stock`, { delta: Number(adjustDelta), reason: "manual adjustment" });
    toast.success("Stock updated");
    setAdjustOpen(null); setAdjustDelta(0);
    mutate("/products"); mutate("/dashboard/summary");
  };

  const catName = (id) => categories.find((c) => c.id === id)?.name || "-";
  const brandName = (id) => brands.find((b) => b.id === id)?.name || "-";

  return (
    <div className="space-y-6" data-testid="inventory-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Stock</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "Outfit" }}>Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage products, prices, and stock levels.</p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".csv" className="hidden" onChange={(e) => bulkImport(e.target.files?.[0])} data-testid="bulk-import-input" />
            <span className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-input bg-background hover:bg-secondary text-sm font-medium">
              <Upload className="h-4 w-4" />Bulk import CSV
            </span>
          </label>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} data-testid="add-product-btn">
                <PackagePlus className="h-4 w-4 mr-2" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" col="col-span-2">
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="product-name-input" />
                </Field>
                <Field label="Category">
                  <Select value={form.category_id || ""} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Brand">
                  <Select value={form.brand_id || ""} onValueChange={(v) => setForm({ ...form, brand_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Model"><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} onBlur={(e) => lookupByModel(e.target.value)} data-testid="product-model-input" /></Field>
                <Field label="Color"><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field>
                <Field label="Purchase Price (₹)"><Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} /></Field>
                <Field label="Selling Price (₹)"><Input type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} data-testid="product-price-input" /></Field>
                <Field label="GST %">
                  <Select value={String(form.gst_rate)} onValueChange={(v) => setForm({ ...form, gst_rate: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 5, 12, 18, 28].map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Quantity"><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} data-testid="product-qty-input" /></Field>
                <Field label="Reorder level"><Input type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} /></Field>
                <Field label="Warranty (months)"><Input type="number" value={form.warranty_months} onChange={(e) => setForm({ ...form, warranty_months: e.target.value })} /></Field>
                <Field label="HSN / SAC code"><Input value={form.hsn_code} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} placeholder="e.g. 84182100" /></Field>
                <Field label="Serial Number"><Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} placeholder="e.g. SN-A1B2C3" data-testid="product-serial-input" /></Field>
                <Field label="Purchase Bill No."><Input value={form.purchase_bill_number} onChange={(e) => setForm({ ...form, purchase_bill_number: e.target.value })} placeholder="Vendor invoice #" data-testid="product-purchase-bill-input" /></Field>
                <Field label="Source of Procurement"><Input value={form.source_of_procurement} onChange={(e) => setForm({ ...form, source_of_procurement: e.target.value })} placeholder="e.g. Samsung India Ltd." data-testid="product-source-input" /></Field>
                <Field label="Image URL" col="col-span-2"><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></Field>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} data-testid="save-product-btn">{editing ? "Save changes" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="inventory-search" />
      </div>

      <Card className="glass rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} data-testid={`inventory-row-${p.sku}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {p.image_url && <img src={p.image_url} className="h-10 w-10 rounded-lg object-cover" alt="" />}
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.model || p.color}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell>{catName(p.category_id)}</TableCell>
                  <TableCell>{brandName(p.brand_id)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatINR(p.selling_price)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={p.quantity > p.reorder_level ? "secondary" : "destructive"}>
                      {p.quantity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => loadUnits(p)} data-testid={`units-btn-${p.sku}`}><Layers className="h-3 w-3" /></Button>
                      <Button size="sm" variant="outline" onClick={() => { setAdjustOpen(p); setAdjustDelta(0); }}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(p)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No products</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!adjustOpen} onOpenChange={(o) => !o && setAdjustOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust stock — {adjustOpen?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Change (use negative for removal)</Label>
            <Input type="number" value={adjustDelta} onChange={(e) => setAdjustDelta(e.target.value)} data-testid="stock-adjust-input" />
            <div className="text-xs text-muted-foreground">Current: {adjustOpen?.quantity} → New: {(adjustOpen?.quantity || 0) + Number(adjustDelta || 0)}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(null)}>Cancel</Button>
            <Button onClick={adjust} data-testid="stock-adjust-save">Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!unitsOpen} onOpenChange={(o) => !o && setUnitsOpen(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle style={{ fontFamily: "Outfit" }}>Units — {unitsOpen?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-6 gap-2 items-end p-3 rounded-lg bg-secondary/50">
              <div className="col-span-2"><Label className="text-xs">Serial No.</Label><Input value={newUnit.serial_number} onChange={(e) => setNewUnit({ ...newUnit, serial_number: e.target.value })} data-testid="new-unit-serial" /></div>
              <div><Label className="text-xs">Cost ₹</Label><Input type="number" value={newUnit.purchase_price} onChange={(e) => setNewUnit({ ...newUnit, purchase_price: e.target.value })} data-testid="new-unit-cost" /></div>
              <div><Label className="text-xs">Sell ₹</Label><Input type="number" value={newUnit.selling_price} onChange={(e) => setNewUnit({ ...newUnit, selling_price: e.target.value })} /></div>
              <div><Label className="text-xs">Bill No.</Label><Input value={newUnit.purchase_bill_number} onChange={(e) => setNewUnit({ ...newUnit, purchase_bill_number: e.target.value })} /></div>
              <div><Button onClick={addUnit} className="w-full" data-testid="add-unit-btn"><Plus className="h-3 w-3" /></Button></div>
              <div className="col-span-6"><Label className="text-xs">Source of Procurement</Label><Input value={newUnit.source_of_procurement} onChange={(e) => setNewUnit({ ...newUnit, source_of_procurement: e.target.value })} placeholder="e.g. Samsung India Ltd" /></div>
              <div className="col-span-6"><Label className="text-xs">Purchase bill URL (upload to Drive/S3 and paste link)</Label><Input value={newUnit.purchase_bill_url} onChange={(e) => setNewUnit({ ...newUnit, purchase_bill_url: e.target.value })} placeholder="https://drive.google.com/file/..." data-testid="new-unit-billurl" /></div>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Serial</TableHead><TableHead>Cost</TableHead><TableHead>Sell</TableHead><TableHead>Bill</TableHead><TableHead>Source</TableHead><TableHead>Bill Doc</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {units.map((u) => (
                  <TableRow key={u.id} data-testid={`unit-row-${u.serial_number}`}>
                    <TableCell className="font-mono text-xs">{u.serial_number}</TableCell>
                    <TableCell>{formatINR(u.purchase_price)}</TableCell>
                    <TableCell>{formatINR(u.selling_price)}</TableCell>
                    <TableCell className="text-xs">{u.purchase_bill_number || "—"}</TableCell>
                    <TableCell className="text-xs">{u.source_of_procurement || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {u.purchase_bill_url ? <a href={u.purchase_bill_url} target="_blank" rel="noreferrer" className="underline">View bill</a> : "—"}
                    </TableCell>
                    <TableCell><Badge variant={u.status === "sold" ? "outline" : "secondary"}>{u.status}</Badge></TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => removeUnit(u.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {units.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No units yet. Add each purchased piece above with its serial + cost.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={false}>
        <DialogContent />
      </Dialog>
    </div>
  );
}

function Field({ label, col = "", children }) {
  return (
    <div className={col}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

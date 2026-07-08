import React, { useState } from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { TruckIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const fetcher = (url) => api.get(url).then((r) => r.data);
const empty = { name: "", contact_person: "", phone: "", email: "", gst_number: "", address: "" };

export default function Suppliers() {
  const { data: suppliers = [] } = useSWR("/suppliers", fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const save = async () => {
    if (!form.name) return toast.error("Name required");
    try {
      if (editing) await api.put(`/suppliers/${editing.id}`, form);
      else await api.post("/suppliers", form);
      toast.success("Saved"); setOpen(false); mutate("/suppliers");
    } catch (err) { toast.error(err.response?.data?.detail || "Save failed"); }
  };

  const remove = async (s) => {
    if (!window.confirm(`Delete ${s.name}?`)) return;
    await api.delete(`/suppliers/${s.id}`); mutate("/suppliers");
  };

  return (
    <div className="space-y-6" data-testid="suppliers-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Vendors</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "Outfit" }}>Suppliers</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setForm(empty); }} data-testid="add-supplier-btn">
              <TruckIcon className="h-4 w-4 mr-2" />Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit supplier" : "New supplier"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <F label="Name" col="col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="supplier-name-input" /></F>
              <F label="Contact person"><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></F>
              <F label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></F>
              <F label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
              <F label="GST No."><Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} /></F>
              <F label="Address" col="col-span-2"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></F>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} data-testid="save-supplier-btn">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass rounded-2xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead><TableHead>GST</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id} data-testid={`supplier-row-${s.id}`}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.address || "—"}</div>
                  </TableCell>
                  <TableCell>{s.contact_person || "—"}</TableCell>
                  <TableCell>{s.phone || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{s.gst_number || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setForm({ ...empty, ...s }); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(s)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {suppliers.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No suppliers</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
function F({ label, col = "", children }) {
  return <div className={col}><Label className="text-xs text-muted-foreground">{label}</Label><div className="mt-1">{children}</div></div>;
}

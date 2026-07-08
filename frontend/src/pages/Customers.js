import React, { useState } from "react";
import useSWR, { mutate } from "swr";
import { api, formatINR } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const fetcher = (url) => api.get(url).then((r) => r.data);
const empty = { name: "", phone: "", email: "", gst_number: "", address: "", birthday: "" };

export default function Customers() {
  const { data: customers = [] } = useSWR("/customers", fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const save = async () => {
    if (!form.name) return toast.error("Name required");
    try {
      if (editing) {
        await api.put(`/customers/${editing.id}`, form);
        toast.success("Customer updated");
      } else {
        await api.post("/customers", form);
        toast.success("Customer added");
      }
      setOpen(false); mutate("/customers");
    } catch (err) { toast.error(err.response?.data?.detail || "Save failed"); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    await api.delete(`/customers/${c.id}`);
    mutate("/customers");
  };

  return (
    <div className="space-y-6" data-testid="customers-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">CRM</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "Outfit" }}>Customers</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setForm(empty); }} data-testid="add-customer-btn">
              <UserPlus className="h-4 w-4 mr-2" />Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit customer" : "New customer"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <F label="Name" col="col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="customer-name-input" /></F>
              <F label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="customer-phone-input" /></F>
              <F label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
              <F label="GST No."><Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} /></F>
              <F label="Birthday"><Input type="date" value={form.birthday || ""} onChange={(e) => setForm({ ...form, birthday: e.target.value })} /></F>
              <F label="Address" col="col-span-2"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></F>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} data-testid="save-customer-btn">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass rounded-2xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Loyalty</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id} data-testid={`customer-row-${c.id}`}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.address || "—"}</div>
                  </TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell>{c.email || "—"}</TableCell>
                  <TableCell className="text-right"><Badge variant="secondary">{c.loyalty_points} pts</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{formatINR(c.total_spent)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setForm({ ...empty, ...c }); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {customers.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No customers</TableCell></TableRow>}
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

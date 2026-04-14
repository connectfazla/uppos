"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { Invoice } from "@/types/database";

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_id: "",
    retainer_id: "",
    amount: "",
    due_date: "",
    invoice_link: "",
    notes: "",
  });
  const [pay, setPay] = useState({ amount_paid: "", payment_date: "", method: "bank_transfer", reference_note: "" });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error();
      return res.json() as Promise<{ clients: { id: string; company_name: string }[] }>;
    },
  });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await fetch("/api/invoices");
      if (!res.ok) throw new Error();
      return res.json() as Promise<{ invoices: Invoice[] }>;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: form.client_id,
          retainer_id: form.retainer_id || null,
          amount: Number(form.amount),
          due_date: form.due_date,
          invoice_link: form.invoice_link,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success("Invoice record saved");
      setOpen(false);
      setForm({ client_id: "", retainer_id: "", amount: "", due_date: "", invoice_link: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
    onError: () => toast.error("Could not save invoice"),
  });

  const payMut = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: invoiceId,
          amount_paid: Number(pay.amount_paid),
          payment_date: pay.payment_date,
          method: pay.method,
          reference_note: pay.reference_note || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setPayOpen(null);
      setPay({ amount_paid: "", payment_date: "", method: "bank_transfer", reference_note: "" });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
    onError: () => toast.error("Could not record payment"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoice tracking</h1>
          <p className="text-sm text-muted-foreground">External Google Docs only — no PDF generation here.</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add invoice
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Track invoice</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background"
                  value={form.client_id}
                  onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {(clients?.clients ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Google Doc link</Label>
                <Input
                  placeholder="https://docs.google.com/..."
                  value={form.invoice_link}
                  onChange={(e) => setForm((f) => ({ ...f, invoice_link: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <Button
                className="w-full"
                disabled={!form.client_id || !form.amount || !form.due_date || !form.invoice_link || create.isPending}
                onClick={() => create.mutate()}
              >
                Save
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Status colors: paid (green), unpaid (yellow), overdue (red). Partial payments supported.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4}>Loading…</TableCell>
                </TableRow>
              )}
              {(invoices?.invoices ?? []).map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{formatDate(inv.due_date)}</TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={inv.status} />
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(inv.amount))}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" className="gap-1" asChild>
                      <a href={inv.invoice_link} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </a>
                    </Button>
                    {inv.status !== "paid" && (
                      <Button variant="secondary" size="sm" onClick={() => setPayOpen(inv.id)}>
                        Pay
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Record payment</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Amount paid</Label>
              <Input type="number" value={pay.amount_paid} onChange={(e) => setPay((p) => ({ ...p, amount_paid: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Payment date</Label>
              <Input type="date" value={pay.payment_date} onChange={(e) => setPay((p) => ({ ...p, payment_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Input value={pay.method} onChange={(e) => setPay((p) => ({ ...p, method: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={pay.reference_note} onChange={(e) => setPay((p) => ({ ...p, reference_note: e.target.value }))} />
            </div>
            <Button
              className="w-full"
              disabled={!payOpen || !pay.amount_paid || !pay.payment_date || payMut.isPending}
              onClick={() => payOpen && payMut.mutate(payOpen)}
            >
              Record payment
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

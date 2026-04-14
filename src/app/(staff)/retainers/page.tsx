"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

type Deliverable = {
  id: string;
  platform: string;
  number_of_posts: number;
  campaigns: number;
  notes: string | null;
};

type Retainer = {
  id: string;
  client_id: string;
  name: string;
  monthly_fee: number;
  start_date: string;
  renewal_date: string;
  billing_cycle: string;
  status: string;
  retainer_deliverables: Deliverable[] | null;
};

export default function RetainersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    name: "",
    monthly_fee: "",
    start_date: "",
    renewal_date: "",
    billing_cycle: "monthly",
    platform: "Instagram",
    posts: "0",
    campaigns: "0",
    deliverable_notes: "",
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error();
      return res.json() as Promise<{ clients: { id: string; company_name: string }[] }>;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["retainers"],
    queryFn: async () => {
      const res = await fetch("/api/retainers");
      if (!res.ok) throw new Error();
      return res.json() as Promise<{ retainers: Retainer[] }>;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/retainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: form.client_id,
          name: form.name,
          monthly_fee: Number(form.monthly_fee),
          start_date: form.start_date,
          renewal_date: form.renewal_date,
          billing_cycle: form.billing_cycle,
          status: "active",
          deliverables: [
            {
              platform: form.platform,
              number_of_posts: Number(form.posts),
              campaigns: Number(form.campaigns),
              notes: form.deliverable_notes || null,
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success("Retainer created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["retainers"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
    onError: () => toast.error("Could not create retainer"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Retainers</h1>
          <p className="text-sm text-muted-foreground">Recurring scopes, fees, renewals, and deliverables.</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New retainer
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Create retainer</SheetTitle>
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
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Monthly fee</Label>
                <Input type="number" value={form.monthly_fee} onChange={(e) => setForm((f) => ({ ...f, monthly_fee: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Renewal</Label>
                  <Input type="date" value={form.renewal_date} onChange={(e) => setForm((f) => ({ ...f, renewal_date: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Billing cycle</Label>
                <Input value={form.billing_cycle} onChange={(e) => setForm((f) => ({ ...f, billing_cycle: e.target.value }))} />
              </div>
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-sm font-medium">Primary deliverable</p>
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Input value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Posts</Label>
                    <Input type="number" value={form.posts} onChange={(e) => setForm((f) => ({ ...f, posts: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Campaigns</Label>
                    <Input type="number" value={form.campaigns} onChange={(e) => setForm((f) => ({ ...f, campaigns: e.target.value }))} />
                  </div>
                </div>
                <div className="mt-2 space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={form.deliverable_notes} onChange={(e) => setForm((f) => ({ ...f, deliverable_notes: e.target.value }))} />
                </div>
              </div>
              <Button
                className="w-full"
                disabled={!form.client_id || !form.name || !form.monthly_fee || !form.start_date || !form.renewal_date || create.isPending}
                onClick={() => create.mutate()}
              >
                Create
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All retainers</CardTitle>
          <CardDescription>Deliverables are nested under each retainer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {(data?.retainers ?? []).map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">Client ID: {r.client_id}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">{formatCurrency(Number(r.monthly_fee))}</div>
                  <Badge variant="secondary" className="capitalize">
                    {r.status}
                  </Badge>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>Start {formatDate(r.start_date)}</span>
                <span>Renewal {formatDate(r.renewal_date)}</span>
                <span className="capitalize">{r.billing_cycle}</span>
              </div>
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Posts</TableHead>
                      <TableHead>Campaigns</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(r.retainer_deliverables ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground">
                          No deliverables
                        </TableCell>
                      </TableRow>
                    )}
                    {(r.retainer_deliverables ?? []).map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>{d.platform}</TableCell>
                        <TableCell>{d.number_of_posts}</TableCell>
                        <TableCell>{d.campaigns}</TableCell>
                        <TableCell className="max-w-xs truncate">{d.notes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

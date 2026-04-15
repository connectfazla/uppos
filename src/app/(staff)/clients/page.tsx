"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { ClientStatus } from "@/types/database";
import type { Invoice } from "@/types/database";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";

type ClientRow = {
  id: string;
  company_name: string;
  status: ClientStatus;
  created_at: string;
  monthly_value: number;
  manager_name: string | null;
  last_payment: string | null;
};

type ClientDetail = {
  client: {
    id: string;
    company_name: string;
    status: ClientStatus;
    assigned_manager: string | null;
    notes: string | null;
    created_at: string;
    archived_at: string | null;
  };
  contacts: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string | null;
    created_at: string;
  }>;
  retainers: Array<{
    id: string;
    name: string;
    monthly_fee: number;
    renewal_date: string;
    status: string;
  }>;
  invoices: Invoice[];
};

export default function ClientsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "all">("all");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<ClientStatus>("lead");
  const [createManagerId, setCreateManagerId] = useState<string>("");
  const [newManagerId, setNewManagerId] = useState<string>("");
  const [notesDraft, setNotesDraft] = useState("");
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", role: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error();
      return res.json() as Promise<{ clients: ClientRow[] }>;
    },
  });

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const res = await fetch("/api/staff");
      if (!res.ok) throw new Error();
      return res.json() as Promise<{ staff: { id: string; email: string; full_name: string | null }[] }>;
    },
  });

  const { data: detail } = useQuery({
    queryKey: ["client", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${selectedId}`);
      if (!res.ok) throw new Error();
      return res.json() as Promise<ClientDetail>;
    },
    enabled: !!selectedId && sheetOpen,
  });

  useEffect(() => {
    if (detail?.client) {
      setNotesDraft(detail.client.notes ?? "");
      setNewManagerId(detail.client.assigned_manager ?? "");
    }
  }, [detail?.client]);

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: company,
          status,
          assigned_manager: createManagerId || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success("Client created");
      setOpen(false);
      setCompany("");
      setStatus("lead");
      setCreateManagerId("");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => toast.error("Could not create client"),
  });

  const saveNotes = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clients/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft || null }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      toast.success("Notes saved");
      qc.invalidateQueries({ queryKey: ["client", selectedId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => toast.error("Could not save notes"),
  });

  const saveManager = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clients/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_manager: newManagerId || null }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      toast.success("Account manager updated");
      qc.invalidateQueries({ queryKey: ["client", selectedId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => toast.error("Could not update manager"),
  });

  const updateStatus = useMutation({
    mutationFn: async (next: ClientStatus) => {
      const res = await fetch(`/api/clients/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["client", selectedId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => toast.error("Could not update status"),
  });

  const archiveClient = useMutation({
    mutationFn: async (archived: boolean) => {
      const res = await fetch(`/api/clients/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["client", selectedId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      setSheetOpen(false);
    },
    onError: () => toast.error("Could not update"),
  });

  const addContact = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedId,
          name: contactForm.name,
          email: contactForm.email || null,
          phone: contactForm.phone || null,
          role: contactForm.role || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success("Contact added");
      setContactForm({ name: "", email: "", phone: "", role: "" });
      qc.invalidateQueries({ queryKey: ["client", selectedId] });
    },
    onError: () => toast.error("Could not add contact"),
  });

  function openClient(id: string) {
    setSelectedId(id);
    setSheetOpen(true);
  }

  const row = data?.clients.find((c) => c.id === selectedId);
  const filtered = (data?.clients ?? []).filter((c) => {
    const matchesQ = !q.trim() || c.company_name.toLowerCase().includes(q.trim().toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesQ && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">CRM — companies, retainers, invoices, and contacts.</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New client
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add client</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>Company name</Label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Co." />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ClientStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Account manager (optional)</Label>
                <Select value={createManagerId || "__none__"} onValueChange={(v) => setCreateManagerId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {(staffData?.staff ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name || s.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={!company.trim() || create.isPending} onClick={() => create.mutate()}>
                Save
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>Click a row for overview, retainers, invoices, contacts, and notes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="min-w-[220px] flex-1">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company…" />
            </div>
            <div className="min-w-[180px]">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ClientStatus | "all")}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Monthly value</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-right">Last payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5}>Loading…</TableCell>
                </TableRow>
              )}
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openClient(c.id)}>
                  <TableCell className="font-medium">{c.company_name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(c.monthly_value)}</TableCell>
                  <TableCell className="text-muted-foreground">{c.manager_name ?? "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {c.last_payment ? formatDate(c.last_payment) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setSelectedId(null);
        }}
      >
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{row?.company_name ?? detail?.client.company_name ?? "Client"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex-1">
            {!detail?.client && selectedId ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : detail?.client ? (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="mb-4 grid w-full grid-cols-5">
                  <TabsTrigger value="overview" className="text-xs sm:text-sm">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="retainers" className="text-xs sm:text-sm">
                    Retainers
                  </TabsTrigger>
                  <TabsTrigger value="invoices" className="text-xs sm:text-sm">
                    Invoices
                  </TabsTrigger>
                  <TabsTrigger value="contacts" className="text-xs sm:text-sm">
                    Contacts
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="text-xs sm:text-sm">
                    Notes
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {detail.client.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">Since {formatDate(detail.client.created_at)}</span>
                  </div>
                  <div className="grid gap-3 rounded-lg border border-border p-3">
                    <div className="text-sm font-medium">Quick actions</div>
                    <div className="flex flex-wrap gap-2">
                      <div className="min-w-[180px] flex-1">
                        <Select value={detail.client.status} onValueChange={(v) => updateStatus.mutate(v as ClientStatus)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lead">Lead</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={archiveClient.isPending}
                        onClick={() => archiveClient.mutate(!detail.client.archived_at)}
                      >
                        {detail.client.archived_at ? "Unarchive" : "Archive"}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly value</span>
                      <span className="font-medium">{formatCurrency(row?.monthly_value ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last payment</span>
                      <span>{row?.last_payment ? formatDate(row.last_payment) : "—"}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Account manager</Label>
                    <div className="flex gap-2">
                      <Select
                        value={newManagerId || "__none__"}
                        onValueChange={(v) => setNewManagerId(v === "__none__" ? "" : v)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {(staffData?.staff ?? []).map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.full_name || s.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" size="sm" disabled={saveManager.isPending} onClick={() => saveManager.mutate()}>
                        Save
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="retainers">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">MRR</TableHead>
                        <TableHead className="text-right">Renewal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detail.retainers ?? []).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.name}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.monthly_fee)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatDate(r.renewal_date)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {!detail.retainers?.length && <p className="text-sm text-muted-foreground">No retainers.</p>}
                </TabsContent>

                <TabsContent value="invoices">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Due</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detail.invoices ?? []).map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell>{formatDate(inv.due_date)}</TableCell>
                          <TableCell>
                            <InvoiceStatusBadge status={inv.status} />
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(inv.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {!detail.invoices?.length && <p className="text-sm text-muted-foreground">No invoices.</p>}
                </TabsContent>

                <TabsContent value="contacts" className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detail.contacts ?? []).map((co) => (
                        <TableRow key={co.id}>
                          <TableCell>{co.name}</TableCell>
                          <TableCell className="text-muted-foreground">{co.email ?? "—"}</TableCell>
                          <TableCell>{co.role ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    <div className="text-sm font-medium">Add contact</div>
                    <Input placeholder="Name" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
                    <Input
                      placeholder="Email"
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    />
                    <Input placeholder="Phone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
                    <Input placeholder="Role" value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!contactForm.name.trim() || addContact.isPending}
                      onClick={() => addContact.mutate()}
                    >
                      Add contact
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="space-y-3">
                  <Textarea rows={10} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Internal notes…" />
                  <Button type="button" disabled={saveNotes.isPending} onClick={() => saveNotes.mutate()}>
                    Save notes
                  </Button>
                </TabsContent>
              </Tabs>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

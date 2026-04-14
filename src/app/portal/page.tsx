"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";

type PortalPayload = {
  client: { company_name: string } | null;
  overview: {
    activeRetainers: Array<{
      id: string;
      name: string;
      monthly_fee: number;
      renewal_date: string;
      retainer_deliverables: Array<{
        platform: string;
        number_of_posts: number;
        campaigns: number;
        notes: string | null;
      }> | null;
    }>;
    monthlyTotal: number;
    nextRenewalDate: string | null;
  };
  contracts: Array<{
    id: string;
    contract_url: string | null;
    signed_status: string;
    created_at: string;
  }>;
  invoices: Array<{
    id: string;
    amount: number;
    due_date: string;
    status: "paid" | "unpaid" | "overdue";
    invoice_link: string;
  }>;
  payments: Array<{
    id: string;
    amount_paid: number;
    payment_date: string;
    method: string;
    reference_note: string | null;
  }>;
};

export default function PortalPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["client-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/client/dashboard");
      if (!res.ok) throw new Error();
      return res.json() as Promise<PortalPayload>;
    },
  });

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Unable to load portal. Ensure your profile has a linked client_id (set in Supabase).
      </div>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading your workspace…</p>;
  }

  const o = data?.overview;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{data?.client?.company_name ?? "Your account"}</h1>
        <p className="text-sm text-muted-foreground">Retainers, contracts, external invoices, and payments.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active retainers</CardDescription>
            <CardTitle className="text-3xl">{o?.activeRetainers.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monthly total</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(o?.monthlyTotal ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Next renewal</CardDescription>
            <CardTitle className="text-xl font-medium">
              {o?.nextRenewalDate ? formatDate(o.nextRenewalDate) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="retainers">
        <TabsList>
          <TabsTrigger value="retainers">Retainers</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="retainers">
          <Card>
            <CardHeader>
              <CardTitle>Deliverables</CardTitle>
              <CardDescription>What we ship each cycle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {(o?.activeRetainers ?? []).map((r) => (
                <div key={r.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(Number(r.monthly_fee))} · renews {formatDate(r.renewal_date)}
                    </div>
                  </div>
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead>Posts</TableHead>
                        <TableHead>Campaigns</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(r.retainer_deliverables ?? []).map((d) => (
                        <TableRow key={`${r.id}-${d.platform}-${d.number_of_posts}`}>
                          <TableCell>{d.platform}</TableCell>
                          <TableCell>{d.number_of_posts}</TableCell>
                          <TableCell>{d.campaigns}</TableCell>
                          <TableCell className="max-w-xs truncate">{d.notes ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
              {!o?.activeRetainers.length && <p className="text-sm text-muted-foreground">No active retainers.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts">
          <Card>
            <CardHeader>
              <CardTitle>Contracts</CardTitle>
              <CardDescription>Executed agreements on file.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="text-right">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.contracts ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="capitalize">{c.signed_status}</TableCell>
                      <TableCell>{formatDate(c.created_at)}</TableCell>
                      <TableCell className="text-right">
                        {c.contract_url && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={c.contract_url} target="_blank" rel="noreferrer">
                              Open PDF
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>Managed in Google Docs — open the source document anytime.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Due</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.invoices ?? []).map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{formatDate(inv.due_date)}</TableCell>
                      <TableCell>{formatCurrency(Number(inv.amount))}</TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={inv.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" className="gap-1" asChild>
                          <a href={inv.invoice_link} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3" />
                            Open invoice
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment history</CardTitle>
              <CardDescription>Recorded against your invoices.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.payments ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.payment_date)}</TableCell>
                      <TableCell className="capitalize">{p.method.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(p.amount_paid))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

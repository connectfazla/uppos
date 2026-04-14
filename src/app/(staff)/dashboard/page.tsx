"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import type { InvoiceStatus } from "@/types/database";

type MetricsResponse = {
  metrics: {
    activeRetainersCount: number;
    mrr: number;
    upcomingRenewalsCount: number;
    outstandingInvoiceAmount: number;
  };
  upcomingRenewals: Array<{
    id: string;
    name: string;
    monthly_fee: number;
    renewal_date: string;
    clients: { company_name: string } | null;
  }>;
  overdueInvoices: Array<{
    id: string;
    amount: number;
    due_date: string;
    status: InvoiceStatus;
    invoice_link: string;
    clients: { company_name: string } | null;
  }>;
  recentPayments: Array<{
    id: string;
    amount_paid: number;
    payment_date: string;
    method: string;
    invoices: { amount: number; clients: { company_name: string } | null } | null;
  }>;
};

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/metrics");
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json() as Promise<MetricsResponse>;
    },
  });

  const { data: retainerChart } = useQuery({
    queryKey: ["retainers-chart"],
    queryFn: async () => {
      const res = await fetch("/api/retainers");
      if (!res.ok) throw new Error("Failed to load retainers");
      const body = await res.json();
      const rows = (body.retainers as Array<{ name: string; monthly_fee: number; status: string }>)
        .filter((r) => r.status === "active")
        .sort((a, b) => b.monthly_fee - a.monthly_fee)
        .slice(0, 6)
        .map((r) => ({ name: r.name.length > 18 ? r.name.slice(0, 18) + "…" : r.name, mrr: Number(r.monthly_fee) }));
      return rows;
    },
  });

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Could not load dashboard. Confirm you are signed in as staff and that the database is reachable.
      </div>
    );
  }

  const m = data?.metrics;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Active retainers, MRR, renewals, and receivables at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Active retainers" value={isLoading ? "…" : String(m?.activeRetainersCount ?? 0)} subtitle="Currently billing" />
        <MetricCard title="MRR" value={isLoading ? "…" : formatCurrency(m?.mrr ?? 0)} subtitle="Sum of active retainers" />
        <MetricCard
          title="Renewals (30d)"
          value={isLoading ? "…" : String(m?.upcomingRenewalsCount ?? 0)}
          subtitle="Retainers renewing soon"
        />
        <MetricCard
          title="Outstanding"
          value={isLoading ? "…" : formatCurrency(m?.outstandingInvoiceAmount ?? 0)}
          subtitle="Unpaid invoice balances"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue overview</CardTitle>
            <CardDescription>Top active retainers by monthly recurring revenue.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {retainerChart?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={retainerChart} margin={{ left: 8, right: 8, top: 8 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={70} />
                  <YAxis tickFormatter={(v) => `$${v}`} width={56} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="mrr" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No retainer data yet.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming renewals</CardTitle>
            <CardDescription>Next 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Retainer</TableHead>
                  <TableHead className="text-right">Renewal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.upcomingRenewals ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.clients?.company_name ?? "—"}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">{formatDate(r.renewal_date)}</TableCell>
                  </TableRow>
                ))}
                {!isLoading && !(data?.upcomingRenewals ?? []).length && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No renewals in the next 30 days.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overdue & open invoices</CardTitle>
            <CardDescription>Track Google Docs invoices — click a row to open the document.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.overdueInvoices ?? []).map((inv) => (
                  <TableRow
                    key={inv.id}
                    className="cursor-pointer"
                    onClick={() => window.open(inv.invoice_link, "_blank", "noopener,noreferrer")}
                  >
                    <TableCell>{inv.clients?.company_name ?? "—"}</TableCell>
                    <TableCell>{formatDate(inv.due_date)}</TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(inv.amount))}</TableCell>
                  </TableRow>
                ))}
                {!isLoading && !(data?.overdueInvoices ?? []).length && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No overdue invoices. Great work.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
            <CardDescription>Latest recorded payments across clients.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.recentPayments ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.invoices?.clients?.company_name ?? "—"}</TableCell>
                    <TableCell>{formatDate(p.payment_date)}</TableCell>
                    <TableCell className="capitalize">{p.method.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(p.amount_paid))}</TableCell>
                  </TableRow>
                ))}
                {!isLoading && !(data?.recentPayments ?? []).length && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No payments recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl font-semibold">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

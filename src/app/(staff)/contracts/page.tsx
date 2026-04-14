"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

type ContractRow = {
  id: string;
  client_id: string;
  retainer_id: string | null;
  contract_url: string | null;
  signed_status: string;
  signed_date: string | null;
  created_at: string;
  clients: { company_name: string } | null;
  retainers: { name: string } | null;
};

export default function ContractsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState("");
  const [retainerId, setRetainerId] = useState("");
  const [signedStatus, setSignedStatus] = useState("unsigned");
  const [signedDate, setSignedDate] = useState("");

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error();
      return res.json() as Promise<{ clients: { id: string; company_name: string }[] }>;
    },
  });

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const res = await fetch("/api/contracts");
      if (!res.ok) throw new Error();
      return res.json() as Promise<{ contracts: ContractRow[] }>;
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !clientId) throw new Error("missing");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("client_id", clientId);
      if (retainerId) fd.append("retainer_id", retainerId);
      fd.append("signed_status", signedStatus);
      if (signedDate) fd.append("signed_date", signedDate);
      const res = await fetch("/api/contracts", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success("Contract uploaded");
      setOpen(false);
      setFile(null);
      setClientId("");
      setRetainerId("");
      setSignedStatus("unsigned");
      setSignedDate("");
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: () => toast.error("Upload failed — check server disk space and CONTRACTS_DIR permissions."),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contracts</h1>
          <p className="text-sm text-muted-foreground">PDFs stored on the server, linked to clients and retainers.</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Upload contract</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>PDF file</Label>
                <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="space-y-2">
                <Label>Client</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
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
                <Label>Retainer ID (optional)</Label>
                <Input placeholder="uuid" value={retainerId} onChange={(e) => setRetainerId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Signed status</Label>
                <Input value={signedStatus} onChange={(e) => setSignedStatus(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Signed date</Label>
                <Input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} />
              </div>
              <Button className="w-full" disabled={!file || !clientId || upload.isPending} onClick={() => upload.mutate()}>
                Upload
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Library</CardTitle>
          <CardDescription>Open files via secure links (staff and portal users).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Retainer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Uploaded</TableHead>
                <TableHead className="text-right">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5}>Loading…</TableCell>
                </TableRow>
              )}
              {(contracts?.contracts ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.clients?.company_name ?? "—"}</TableCell>
                  <TableCell>{c.retainers?.name ?? "—"}</TableCell>
                  <TableCell className="capitalize">{c.signed_status}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                  <TableCell className="text-right">
                    {c.contract_url && (
                      <Button variant="link" size="sm" asChild>
                        <a href={c.contract_url} target="_blank" rel="noreferrer">
                          Open
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
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/types/database";

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  if (status === "paid") return <Badge variant="success">Paid</Badge>;
  if (status === "overdue") return <Badge variant="danger">Overdue</Badge>;
  return <Badge variant="warning">Unpaid</Badge>;
}

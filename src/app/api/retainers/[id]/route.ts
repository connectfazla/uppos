import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { retainerStatusFromApi } from "@/lib/prisma-enums";
import { serializeRetainer } from "@/lib/serializers";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  monthly_fee: z.coerce.number().nonnegative().optional(),
  start_date: z.string().optional(),
  renewal_date: z.string().optional(),
  billing_cycle: z.string().optional(),
  status: z.enum(["active", "paused", "cancelled"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const { id } = params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.retainer.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.monthly_fee !== undefined ? { monthlyFee: parsed.data.monthly_fee } : {}),
      ...(parsed.data.start_date !== undefined ? { startDate: new Date(parsed.data.start_date) } : {}),
      ...(parsed.data.renewal_date !== undefined ? { renewalDate: new Date(parsed.data.renewal_date) } : {}),
      ...(parsed.data.billing_cycle !== undefined ? { billingCycle: parsed.data.billing_cycle } : {}),
      ...(parsed.data.status !== undefined ? { status: retainerStatusFromApi(parsed.data.status) } : {}),
    },
    include: { deliverables: true },
  });
  return NextResponse.json({ retainer: serializeRetainer(updated) });
}

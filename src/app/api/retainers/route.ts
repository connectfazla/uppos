import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { retainerStatusFromApi } from "@/lib/prisma-enums";
import { serializeRetainer } from "@/lib/serializers";

const deliverableSchema = z.object({
  platform: z.string().min(1),
  number_of_posts: z.coerce.number().int().min(0).default(0),
  campaigns: z.coerce.number().int().min(0).default(0),
  notes: z.string().nullable().optional(),
});

const createSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1),
  monthly_fee: z.coerce.number().nonnegative(),
  start_date: z.string(),
  renewal_date: z.string(),
  billing_cycle: z.string().default("monthly"),
  status: z.enum(["active", "paused", "cancelled"]).default("active"),
  deliverables: z.array(deliverableSchema).optional(),
});

export async function GET(request: Request) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const clientId = new URL(request.url).searchParams.get("client_id");
  const rows = await prisma.retainer.findMany({
    where: clientId ? { clientId } : {},
    include: { deliverables: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ retainers: rows.map(serializeRetainer) });
}

export async function POST(request: Request) {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { deliverables, ...r } = parsed.data;

  const full = await prisma.$transaction(async (tx) => {
    const created = await tx.retainer.create({
      data: {
        clientId: r.client_id,
        name: r.name,
        monthlyFee: r.monthly_fee,
        startDate: new Date(r.start_date),
        renewalDate: new Date(r.renewal_date),
        billingCycle: r.billing_cycle,
        status: retainerStatusFromApi(r.status),
      },
    });
    if (deliverables?.length) {
      await tx.retainerDeliverable.createMany({
        data: deliverables.map((d) => ({
          retainerId: created.id,
          platform: d.platform,
          numberOfPosts: d.number_of_posts,
          campaigns: d.campaigns,
          notes: d.notes ?? null,
        })),
      });
    }
    return tx.retainer.findUniqueOrThrow({
      where: { id: created.id },
      include: { deliverables: true },
    });
  });

  return NextResponse.json({ retainer: serializeRetainer(full) });
}

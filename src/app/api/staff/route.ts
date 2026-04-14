import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireStaff } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ctx = await requireStaff();
  if ("error" in ctx) return ctx.error;
  const users = await prisma.user.findMany({
    where: { role: { in: [UserRole.ADMIN, UserRole.TEAM] } },
    select: { id: true, email: true, fullName: true },
    orderBy: { email: "asc" },
  });
  return NextResponse.json({
    staff: users.map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.fullName,
    })),
  });
}

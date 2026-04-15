import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  company_name: z.string().min(1),
  full_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const created = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        companyName: parsed.data.company_name.trim(),
        status: "LEAD",
      },
    });
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        fullName: parsed.data.full_name.trim(),
        role: "CLIENT",
        clientId: client.id,
      },
    });
    return { client, user };
  });

  return NextResponse.json({
    user: { id: created.user.id, email: created.user.email },
    client: { id: created.client.id, company_name: created.client.companyName },
  });
}


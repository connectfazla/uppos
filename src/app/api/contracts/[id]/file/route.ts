import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { NextResponse } from "next/server";
import { getProfile, isStaffRole } from "@/lib/auth";
import { absoluteContractPath } from "@/lib/contracts-storage";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contract = await prisma.contract.findUnique({ where: { id: params.id } });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const staff = isStaffRole(profile.role);
  const clientOk = profile.role === "client" && profile.client_id === contract.clientId;
  if (!staff && !clientOk) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let abs: string;
  try {
    abs = absoluteContractPath(contract.storagePath);
  } catch {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }

  try {
    await stat(abs);
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const stream = createReadStream(abs);
  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": contract.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(contract.originalName)}"`,
    },
  });
}

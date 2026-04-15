import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const hash = await bcrypt.hash(password, 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      passwordHash: hash,
      fullName: "Admin",
      role: "ADMIN",
    },
  });

  // Demo staff user
  await prisma.user.upsert({
    where: { email: "team@example.com" },
    update: {},
    create: {
      email: "team@example.com",
      passwordHash: await bcrypt.hash("team1234", 10),
      fullName: "Ops Team",
      role: "TEAM",
    },
  });

  // Demo clients + contacts + retainers + invoices/payments
  const demoClients = [
    { companyName: "Acme Fitness", status: "ACTIVE" as const, notes: "Monthly content + performance reporting." },
    { companyName: "Nova Dental", status: "ACTIVE" as const, notes: "Focus on lead gen and local search." },
    { companyName: "Cedar & Co.", status: "LEAD" as const, notes: "Proposal sent. Follow up next week." },
    { companyName: "BluePeak Realty", status: "PAUSED" as const, notes: "Paused due to seasonality; resume in June." },
    { companyName: "Zenith SaaS", status: "INACTIVE" as const, notes: "Churned; keep warm for Q4." },
  ];

  for (const c of demoClients) {
    const existingClient = await prisma.client.findFirst({ where: { companyName: c.companyName } });
    const client = existingClient
      ? await prisma.client.update({
          where: { id: existingClient.id },
          data: { status: c.status, notes: c.notes, assignedManagerId: admin.id },
        })
      : await prisma.client.create({
          data: { companyName: c.companyName, status: c.status, notes: c.notes, assignedManagerId: admin.id },
        });

    await prisma.contact.createMany({
      data: [
        { clientId: client.id, name: `${c.companyName} Owner`, email: `owner@${client.companyName.replace(/[^a-z0-9]/gi, "").toLowerCase()}.com` },
        { clientId: client.id, name: `${c.companyName} Marketing`, email: `marketing@${client.companyName.replace(/[^a-z0-9]/gi, "").toLowerCase()}.com` },
      ],
      skipDuplicates: true,
    });

    // Portal user per client
    await prisma.user.upsert({
      where: { email: `${client.companyName.replace(/[^a-z0-9]/gi, "").toLowerCase()}@client.demo` },
      update: { clientId: client.id, role: "CLIENT" },
      create: {
        email: `${client.companyName.replace(/[^a-z0-9]/gi, "").toLowerCase()}@client.demo`,
        passwordHash: await bcrypt.hash("client1234", 10),
        fullName: `${client.companyName} Portal`,
        role: "CLIENT",
        clientId: client.id,
      },
    });

    // Only for active/paused: create retainer + invoices
    if (c.status === "ACTIVE" || c.status === "PAUSED") {
      const retainer = await prisma.retainer.create({
        data: {
          clientId: client.id,
          name: "Social Content Retainer",
          monthlyFee: 2500,
          startDate: new Date("2026-01-01"),
          renewalDate: new Date("2026-05-01"),
          billingCycle: "monthly",
          status: c.status === "ACTIVE" ? "ACTIVE" : "PAUSED",
          deliverables: {
            create: [
              { platform: "Instagram", numberOfPosts: 12, campaigns: 1, notes: "Reels + carousels mix." },
              { platform: "TikTok", numberOfPosts: 8, campaigns: 1, notes: "UGC style + hooks." },
            ],
          },
        },
      });

      const inv1 = await prisma.invoice.create({
        data: {
          clientId: client.id,
          retainerId: retainer.id,
          amount: 2500,
          dueDate: new Date("2026-03-01"),
          status: "PAID",
          invoiceLink: "https://docs.google.com/",
          notes: "March retainer",
        },
      });
      await prisma.payment.create({
        data: {
          invoiceId: inv1.id,
          amountPaid: 2500,
          paymentDate: new Date("2026-03-02"),
          method: "bank_transfer",
          referenceNote: "INV-MAR",
        },
      });

      await prisma.invoice.create({
        data: {
          clientId: client.id,
          retainerId: retainer.id,
          amount: 2500,
          dueDate: new Date("2026-04-01"),
          status: "UNPAID",
          invoiceLink: "https://docs.google.com/",
          notes: "April retainer",
        },
      });
    }
  }

  console.log("Seed complete:");
  console.log("  admin@example.com /", password);
  console.log("  team@example.com / team1234");
  console.log("  client portal users: <company>@client.demo / client1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

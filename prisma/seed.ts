import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme";
  const hash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      passwordHash: hash,
      fullName: "Admin",
      role: "ADMIN",
    },
  });
  console.log("Seed complete: admin@example.com /", password === "changeme" ? "changeme (set SEED_ADMIN_PASSWORD in production)" : "(custom)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import "../src/env.js";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@prompt2resume.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "changeme1234";

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "admin", approved: true, dailyDownloadLimit: 999 },
    create: { name: "Admin", email, passwordHash: bcrypt.hashSync(password, 10), role: "admin", approved: true, dailyDownloadLimit: 999, plan: "pro" },
  });
  console.log("Admin ready:", admin.email);

  const codes = [
    { code: "MUST@20", type: "daily_unlock", maxUses: 1000 },
    { code: "EXTRA1", type: "one_time", maxUses: 50 },
    { code: "FRIEND", type: "friend_access", maxUses: 6 },
  ];
  for (const c of codes) await prisma.promoCode.upsert({ where: { code: c.code }, update: {}, create: { ...c, status: "active" } });
  console.log("Promo codes seeded:", codes.map((c) => c.code).join(", "));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

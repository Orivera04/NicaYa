import { prisma } from "./db.js";
import { hashPassword } from "./lib/auth.js";

export async function bootstrapAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) return;
  await prisma.user.upsert({
    where: { email },
    update: { name: "Admin MotoYa", role: "ADMIN", passwordHash: await hashPassword(password), status: "ACTIVE" },
    create: { name: "Admin MotoYa", email, passwordHash: await hashPassword(password), role: "ADMIN" },
  });
  console.log("Bootstrap admin applied.");
}

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { SYSTEM_ROLES } from "../lib/auth/permissions";
import { hashPassword } from "../lib/auth/password.service";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from .env");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
        permissions: role.permissions,
        isSystem: true,
      },
      create: { ...role, isSystem: true },
    });
  }

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_NAME ?? "System Admin";

  if (!email || !password) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env");
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "ADMIN" },
  });

  // generating a proper password hash.
  const passwordHash = await hashPassword(password);

  // The password in .env is only written when the admin is first created, or when you
  // explicitly ask for a reset with SEED_RESET_ADMIN_PASSWORD="true".
  // Set SEED_ADMIN_MUST_CHANGE_PASSWORD="false" to go straight to the dashboard on first login.
  const resetPassword = process.env.SEED_RESET_ADMIN_PASSWORD === "true";
  const mustChangePassword =
    process.env.SEED_ADMIN_MUST_CHANGE_PASSWORD !== "false";

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        fullName,
        roleId: adminRole.id,
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...(resetPassword ? { passwordHash, mustChangePassword } : {}),
      },
    });

    console.log(
      resetPassword
        ? `Updated admin ${email}: password reset from .env, login lock cleared.`
        : `Updated admin ${email}: login lock cleared. Password NOT changed (set SEED_RESET_ADMIN_PASSWORD="true" to reset it).`,
    );
  } else {
    await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        roleId: adminRole.id,
        isActive: true,
        mustChangePassword,
      },
    });

    console.log(`Created admin ${email}.`);
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
 
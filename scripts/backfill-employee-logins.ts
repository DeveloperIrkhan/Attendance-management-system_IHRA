// Creates a login for every employee that has none yet (employees added before
// logins were created automatically).
//
//   npx tsx scripts/backfill-employee-logins.ts
//
// Prints each new email and one-time password and writes them to
// employee-logins.csv in the project folder. Hand the passwords over, then DELETE the file.
// Only password hashes are stored in the database. Every employee must change the
// password at first sign-in. Employees whose email already belongs to another account are skipped.
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { hashPassword } from "../lib/auth/password.service";
import { generateTemporaryPassword } from "../lib/auth/temporary-password";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing from .env");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const role = await prisma.role.findUnique({ where: { name: "EMPLOYEE" } });
  if (!role) throw new Error('Role "EMPLOYEE" not found. Run: npx prisma db seed');

  const employees = await prisma.employee.findMany({
    where: { user: { is: null } },
    orderBy: { name: "asc" },
  });

  const rows: string[] = ["employeeCode,name,email,temporaryPassword"];
  let created = 0;
  const skipped: string[] = [];

  for (const e of employees) {
    const clash = await prisma.user.findUnique({
      where: { email: e.email },
      select: { id: true },
    });
    if (clash) {
      skipped.push(`${e.employeeCode} ${e.name}: email ${e.email} already belongs to another account`);
      continue;
    }
    const password = generateTemporaryPassword();
    await prisma.user.create({
      data: {
        fullName: e.name,
        email: e.email,
        passwordHash: await hashPassword(password),
        roleId: role.id,
        employeeId: e.id,
        isActive: e.isActive,
        mustChangePassword: true,
      },
    });
    rows.push(`${e.employeeCode},"${e.name.replace(/"/g, '""')}",${e.email},${password}`);
    created++;
    console.log(`${e.employeeCode}  ${e.email}  ${password}`);
  }

  if (created > 0) writeFileSync("employee-logins.csv", rows.join("\n") + "\n", "utf8");
  console.log(`\nCreated ${created} login(s).${created ? " Saved to employee-logins.csv: delete it after handing the passwords over." : ""}`);
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length}:`);
    skipped.forEach((s) => console.log(" - " + s));
  }
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  if (!process.argv.includes("--yes")) {
    const [punches, rows] = await Promise.all([
      prisma.devicePunch.count(),
      prisma.attendance.count({
        where: { isManual: false, remarks: { contains: "Source: uFace800" } },
      }),
    ]);
    console.log(
      `Dry run. Would delete ${punches} device punch(es) and ${rows} device-built attendance row(s).`,
    );
    console.log("Run again with --yes to do it.");
    return;
  }

  const rows = await prisma.attendance.deleteMany({
    where: { isManual: false, remarks: { contains: "Source: uFace800" } },
  });
  const punches = await prisma.devicePunch.deleteMany({});
  console.log(
    `Deleted ${punches.count} device punch(es) and ${rows.count} device-built attendance row(s).`,
  );
  console.log("Now start the sync again: npx tsx scripts/sync-zkteco.ts");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

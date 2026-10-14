import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/action-state";

export function listDesignations() {
  return prisma.designation.findMany({
    orderBy: { title: "asc" },
    include: { _count: { select: { employees: true } } },
  });
}

export async function createDesignation(input: { title: string }) {
  const exists = await prisma.designation.findFirst({
    where: { title: { equals: input.title, mode: "insensitive" } },
    select: { id: true },
  });
  if (exists) throw new ServiceError("This designation already exists.");

  return prisma.designation.create({ data: { title: input.title } });
}

export async function updateDesignation(id: string, input: { title: string }) {
  const exists = await prisma.designation.findFirst({
    where: { title: { equals: input.title, mode: "insensitive" }, NOT: { id } },
    select: { id: true },
  });
  if (exists) throw new ServiceError("This designation already exists.");

  return prisma.designation.update({ where: { id }, data: { title: input.title } });
}

export async function deleteDesignation(id: string) {
  const count = await prisma.employee.count({ where: { designationId: id } });
  if (count > 0) {
    throw new ServiceError(
      `Cannot delete: ${count} employee(s) have this designation.`,
    );
  }
  await prisma.designation.delete({ where: { id } });
}
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/action-state";

type DepartmentInput = { name: string; description?: string };

export function listDepartments() {
  return prisma.department.findMany({
    orderBy: { name: "asc" }, //assending order
    include: { _count: { select: { employees: true } } },
  });
}

//insensitive :
//means compare department names without treating uppercase and lowercase letters as different.
export async function createDepartment(input: DepartmentInput) {
  const exists = await prisma.department.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (exists)
    throw new ServiceError("A department with this name already exists.");

  return prisma.department.create({
    data: { name: input.name, description: input.description ?? null },
  });
}

export async function updateDepartment(id: string, input: DepartmentInput) {
  const exists = await prisma.department.findFirst({
    where: {
      name: { equals: input.name, mode: "insensitive" },
      NOT: { id: id },
    },
    select: { id: true },
  });
  if (exists)
    throw new ServiceError("A department with this name already exists.");

  return prisma.department.update({
    where: { id },
    data: { name: input.name, description: input.description ?? null },
  });
}

export async function deleteDepartment(id: string) {
  const count = await prisma.employee.count({ where: { departmentId: id } });
  if (count > 0) {
    throw new ServiceError(
      `Cannot delete: ${count} employee(s) belong to this department.`,
    );
  }
  await prisma.department.delete({ where: { id } });
}

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

/** Departments with the DDs who look after them: their own, and additional-charge DDs. */
export function listDepartmentsWithApprovers() {
  return prisma.department.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { employees: true } },
      employees: {
        where: { isActive: true, designation: { approvalLevel: "DD" } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
      chargeHolders: {
        select: {
          id: true,
          employee: {
            select: {
              id: true,
              name: true,
              isActive: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/** Active employees whose designation is at DD level: the only ones who can hold additional charge. */
export function listDdEmployees() {
  return prisma.employee.findMany({
    where: { isActive: true, designation: { approvalLevel: "DD" } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      employeeCode: true,
      departmentId: true,
      department: { select: { name: true } },
    },
  });
}

export async function addDepartmentCharge(
  departmentId: string,
  employeeId: string,
) {
  const [department, employee] = await Promise.all([
    prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true },
    }),
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        isActive: true,
        departmentId: true,
        designation: { select: { approvalLevel: true } },
      },
    }),
  ]);
  if (!department) throw new ServiceError("Department not found.");
  if (!employee || !employee.isActive)
    throw new ServiceError("Employee not found or inactive.");
  if (employee.designation?.approvalLevel !== "DD") {
    throw new ServiceError(
      `${employee.name} is not a DD. Only an employee whose designation has approval level DD can hold additional charge.`,
    );
  }
  if (employee.departmentId === departmentId) {
    throw new ServiceError(
      `${employee.name} already belongs to ${department.name}.`,
    );
  }
  const exists = await prisma.departmentCharge.findUnique({
    where: { employeeId_departmentId: { employeeId, departmentId } },
    select: { id: true },
  });
  if (exists) {
    throw new ServiceError(
      `${employee.name} already has additional charge of ${department.name}.`,
    );
  }
  return prisma.departmentCharge.create({ data: { employeeId, departmentId } });
}

export async function removeDepartmentCharge(id: string) {
  const found = await prisma.departmentCharge.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!found) throw new ServiceError("This additional charge no longer exists.");
  await prisma.departmentCharge.delete({ where: { id } });
}

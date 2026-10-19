import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/action-state";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { EmployeeInput } from "@/validations/employee.validation";

export const PAGE_SIZE = 70;

export type EmployeeFilters = {
  textSearch?: string;
  departmentId?: string;
  status?: "active" | "inactive";
  page?: number;
};

export async function listEmployees(filters: EmployeeFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.EmployeeWhereInput = {};

  if (filters.textSearch) {
    const textSearch = filters.textSearch;
    //OR means employee can match if any one of these conditions is true.
    where.OR = [
      { name: { contains: textSearch, mode: "insensitive" } },
      { employeeCode: { contains: textSearch, mode: "insensitive" } },
      { email: { contains: textSearch, mode: "insensitive" } },
      { biometricId: { contains: textSearch } },
    ];
  }
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.status === "active") where.isActive = true;
  if (filters.status === "inactive") where.isActive = false;

  const [items, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        department: { select: { name: true } },
        designation: { select: { title: true } },
      },
    }),
    prisma.employee.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export function getEmployee(id: string) {
  return prisma.employee.findUnique({ where: { id } });
}

async function assertUnique(input: EmployeeInput, excludeId?: string) {
  const clash = await prisma.employee.findFirst({
    where: {
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      OR: [
        { employeeCode: input.employeeCode },
        { biometricId: input.biometricId },
        { email: input.email },
      ],
    },
    select: { employeeCode: true, biometricId: true, email: true },
  });
  if (!clash) return;

  if (clash.employeeCode === input.employeeCode)
    throw new ServiceError("This employee code is already in use.");
  if (clash.biometricId === input.biometricId)
    throw new ServiceError("This Biometric ID is already assigned to another employee.");
  throw new ServiceError("This email is already in use.");
}

async function assertReferences(input: EmployeeInput) {
  const dept = await prisma.department.findUnique({
    where: { id: input.departmentId },
    select: { id: true },
  });
  if (!dept) throw new ServiceError("Selected department no longer exists.");

  if (input.designationId) {
    const des = await prisma.designation.findUnique({
      where: { id: input.designationId },
      select: { id: true },
    });
    if (!des) throw new ServiceError("Selected designation no longer exists.");
  }
}

function toData(input: EmployeeInput) {
  return {
    employeeCode: input.employeeCode,
    biometricId: input.biometricId,
    name: input.name,
    email: input.email,
    phoneNumber: input.phoneNumber ?? null,
    // Stored as UTC midnight so the date never shifts with server timezone.
    joiningDate: input.joiningDate
      ? new Date(`${input.joiningDate}T00:00:00.000Z`)
      : null,
    departmentId: input.departmentId,
    designationId: input.designationId ?? null,
  };
}

export async function createEmployee(input: EmployeeInput) {
  await assertUnique(input);
  await assertReferences(input);
  return prisma.employee.create({ data: { ...toData(input), isActive: true } });
}

export async function updateEmployee(id: string, input: EmployeeInput) {
  await assertUnique(input, id);
  await assertReferences(input);
  return prisma.employee.update({
    where: { id },
    data: { ...toData(input), isActive: input.isActive },
  });
}

export function setEmployeeActive(id: string, isActive: boolean) {
  return prisma.employee.update({ where: { id }, data: { isActive } });
}
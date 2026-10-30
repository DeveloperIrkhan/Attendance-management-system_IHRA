import "server-only";
import { prisma } from "@/lib/prisma";
import { ServiceError, type IssuedLogin } from "@/lib/action-state";
import { hashPassword } from "@/lib/auth/password.service";
import { generateTemporaryPassword } from "@/lib/auth/temporary-password";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { EmployeeInput } from "@/validations/employee.validation";
import { employeeWhereFor, type DataScope } from "@/lib/auth/data-scope";

export const PAGE_SIZE = 70;

export type EmployeeFilters = {
  textSearch?: string;
  departmentId?: string;
  status?: "active" | "inactive";
  page?: number;
};

export async function listEmployees(
  filters: EmployeeFilters,
  scope: DataScope,
) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.EmployeeWhereInput = {
    ...employeeWhereFor(scope, filters.departmentId),
  };

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
  // The department filter is applied inside employeeWhereFor, which keeps a DD
  // within their own departments.
  if (filters.status === "active") where.isActive = true;
  if (filters.status === "inactive") where.isActive = false;

  const [items, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      orderBy: { employeeCode: "asc" },
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
  return prisma.employee.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          isActive: true,
          mustChangePassword: true,
          lastLoginAt: true,
          role: { select: { name: true } },
        },
      },
    },
  });
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
    throw new ServiceError(
      "This Biometric ID is already assigned to another employee.",
    );
  throw new ServiceError("This email is already in use.");
}

/** The login email is the employee's email, so it must not belong to another account. */
async function assertLoginEmailFree(email: string, exceptUserId?: string) {
  const clash = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (clash && clash.id !== exceptUserId) {
    throw new ServiceError(
      "A login with this email already exists (it belongs to another account).",
    );
  }
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

async function employeeRoleId() {
  const role = await prisma.role.findUnique({
    where: { name: "EMPLOYEE" },
    select: { id: true },
  });
  if (!role) {
    throw new ServiceError(
      'The "EMPLOYEE" role does not exist. Run the database seed first (npx prisma db seed).',
    );
  }
  return role.id;
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

/**
 * Creates the employee and, in the same transaction, their login:
 * email = employee email, role EMPLOYEE, a random one-time password,
 * and a forced password change at first sign-in.
 * The password is returned once so HR can hand it over; only its hash is stored.
 */
export async function createEmployee(
  input: EmployeeInput,
): Promise<{ employeeId: string; login: IssuedLogin }> {
  await assertUnique(input);
  await assertReferences(input);
  await assertLoginEmailFree(input.email);
  const roleId = await employeeRoleId();

  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);

  const employee = await prisma.$transaction(async (tx) => {
    const created = await tx.employee.create({
      data: { ...toData(input), isActive: true },
    });
    await tx.user.create({
      data: {
        fullName: input.name,
        email: input.email,
        passwordHash,
        roleId,
        employeeId: created.id,
        isActive: true,
        mustChangePassword: true,
      },
    });
    return created;
  });

  return {
    employeeId: employee.id,
    login: { name: input.name, email: input.email, password },
  };
}

/** Updates the employee and keeps their login (name, email, active status) in step. */
export async function updateEmployee(id: string, input: EmployeeInput) {
  await assertUnique(input, id);
  await assertReferences(input);

  const existingUser = await prisma.user.findUnique({
    where: { employeeId: id },
    select: { id: true },
  });
  if (existingUser) await assertLoginEmailFree(input.email, existingUser.id);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id },
      data: { ...toData(input), isActive: input.isActive },
    });
    if (existingUser) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          fullName: input.name,
          email: input.email,
          isActive: input.isActive,
        },
      });
    }
    return updated;
  });
}

export async function setEmployeeActive(id: string, isActive: boolean) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id },
      data: { isActive },
    });
    // A deactivated employee can no longer sign in; reactivating restores the login.
    await tx.user.updateMany({ where: { employeeId: id }, data: { isActive } });
    return updated;
  });
}

/**
 * Gives the employee a new random one-time password and forces a change at next sign-in.
 * Also creates the login if the employee has none yet (employees added before auto-login).
 * Use this for lost passwords, and later for "send login details by email".
 */
export async function resetEmployeeLogin(
  employeeId: string,
): Promise<IssuedLogin> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      user: { select: { id: true } },
    },
  });
  if (!employee) throw new ServiceError("Employee not found.");

  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);

  if (employee.user) {
    await assertLoginEmailFree(employee.email, employee.user.id);
    await prisma.user.update({
      where: { id: employee.user.id },
      data: {
        email: employee.email,
        fullName: employee.name,
        passwordHash,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  } else {
    await assertLoginEmailFree(employee.email);
    await prisma.user.create({
      data: {
        fullName: employee.name,
        email: employee.email,
        passwordHash,
        roleId: await employeeRoleId(),
        employeeId: employee.id,
        isActive: employee.isActive,
        mustChangePassword: true,
      },
    });
  }
  return { name: employee.name, email: employee.email, password };
}

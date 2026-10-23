import "server-only";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/action-state";
import { hashPassword } from "@/lib/auth/password.service";
import type {
  UserCreateInput,
  UserUpdateInput,
} from "@/validations/user.validation";

export function listUsers() {
  return prisma.user.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      isActive: true,
      lastLoginAt: true,
      roleId: true,
      employeeId: true,
      role: { select: { name: true } },
      employee: { select: { name: true, employeeCode: true } },
    },
  });
}

export function listRoleOptions() {
  return prisma.role.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** Active employees that no user account is linked to yet, plus the one linked to `keepEmployeeId`. */
export function listLinkableEmployees(keepEmployeeId?: string | null) {
  return prisma.employee.findMany({
    where: {
      isActive: true,
      OR: [
        { user: { is: null } },
        ...(keepEmployeeId ? [{ id: keepEmployeeId }] : []),
      ],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, employeeCode: true },
  });
}

async function assertEmployeeFree(
  employeeId: string | null,
  exceptUserId?: string,
) {
  if (!employeeId) return;
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, user: { select: { id: true } } },
  });
  if (!employee) throw new ServiceError("Selected employee no longer exists.");
  if (employee.user && employee.user.id !== exceptUserId) {
    throw new ServiceError("This employee is already linked to another user.");
  }
}

async function activeAdminCount(exceptUserId?: string) {
  return prisma.user.count({
    where: {
      isActive: true,
      role: { name: "ADMIN" },
      ...(exceptUserId ? { NOT: { id: exceptUserId } } : {}),
    },
  });
}

export async function createUser(input: UserCreateInput) {
  const clash = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (clash) throw new ServiceError("A user with this email already exists.");

  const role = await prisma.role.findUnique({
    where: { id: input.roleId },
    select: { id: true },
  });
  if (!role) throw new ServiceError("Selected role no longer exists.");
  await assertEmployeeFree(input.employeeId);

  return prisma.user.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      roleId: input.roleId,
      employeeId: input.employeeId,
      isActive: true,
      mustChangePassword: true, // the person chooses their own password at first login
    },
  });
}

export async function updateUser(input: UserUpdateInput, actorId: string) {
  const user = await prisma.user.findUnique({
    where: { id: input.id },
    select: { id: true, roleId: true, role: { select: { name: true } } },
  });
  if (!user) throw new ServiceError("User not found.");

  const clash = await prisma.user.findFirst({
    where: { email: input.email, NOT: { id: input.id } },
    select: { id: true },
  });
  if (clash) throw new ServiceError("A user with this email already exists.");

  const role = await prisma.role.findUnique({
    where: { id: input.roleId },
    select: { id: true, name: true },
  });
  if (!role) throw new ServiceError("Selected role no longer exists.");

  if (user.roleId !== role.id) {
    if (user.id === actorId) {
      throw new ServiceError("You cannot change your own role.");
    }
    if (user.role.name === "ADMIN" && (await activeAdminCount(user.id)) === 0) {
      throw new ServiceError(
        "This is the last active Admin. Make another user Admin first.",
      );
    }
  }
  await assertEmployeeFree(input.employeeId, input.id);

  return prisma.user.update({
    where: { id: input.id },
    data: {
      fullName: input.fullName,
      email: input.email,
      roleId: input.roleId,
      employeeId: input.employeeId,
    },
  });
}

export async function setUserActive(
  id: string,
  isActive: boolean,
  actorId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: { select: { name: true } } },
  });
  if (!user) throw new ServiceError("User not found.");

  if (!isActive) {
    if (id === actorId)
      throw new ServiceError("You cannot deactivate your own account.");
    if (user.role.name === "ADMIN" && (await activeAdminCount(id)) === 0) {
      throw new ServiceError(
        "This is the last active Admin and cannot be deactivated.",
      );
    }
  }
  return prisma.user.update({ where: { id }, data: { isActive } });
}

export async function resetUserPassword(id: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!user) throw new ServiceError("User not found.");
  return prisma.user.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
}

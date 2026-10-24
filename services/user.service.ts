import "server-only";
import { prisma } from "@/lib/prisma";
import { ServiceError, type IssuedLogin } from "@/lib/action-state";
import { hashPassword } from "@/lib/auth/password.service";
import { generateTemporaryPassword } from "@/lib/auth/temporary-password";

export function listUsers() {
  return prisma.user.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      roleId: true,
      role: { select: { name: true } },
      employee: { select: { employeeCode: true } },
    },
  });
}

export function listRoleOptions() {
  return prisma.role.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
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

export async function changeUserRole(
  id: string,
  roleId: string,
  actorId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, roleId: true, role: { select: { name: true } } },
  });
  if (!user) throw new ServiceError("User not found.");
  if (user.roleId === roleId) return user;

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true },
  });
  if (!role) throw new ServiceError("Selected role no longer exists.");

  if (user.id === actorId) {
    throw new ServiceError("You cannot change your own role.");
  }
  if (user.role.name === "ADMIN" && (await activeAdminCount(user.id)) === 0) {
    throw new ServiceError(
      "This is the last active Admin. Make another user Admin first.",
    );
  }
  return prisma.user.update({ where: { id }, data: { roleId } });
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

/** New random one-time password; the person must change it at next sign-in. Shown once. */
export async function resetUserPassword(id: string): Promise<IssuedLogin> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, fullName: true, email: true },
  });
  if (!user) throw new ServiceError("User not found.");

  const password = generateTemporaryPassword();
  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
  return { name: user.fullName, email: user.email, password };
}

import "server-only";
import { prisma } from "@/lib/prisma";
import { ServiceError, type IssuedLogin } from "@/lib/action-state";
import { hashPassword } from "@/lib/auth/password.service";
import { generateTemporaryPassword } from "@/lib/auth/temporary-password";
import type { AuthUser } from "@/lib/auth/authorization";
import { assertCanGrant } from "./role.service";
import type {
  UserCreateInput,
  UserDetailsInput,
} from "@/validations/user.validation";

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

/**
 * A user who manages users may only touch accounts whose rights are no stronger than their own.
 * Otherwise they could reset the Admin's password, or demote the Admin, and take over.
 */
async function assertCanManageAccount(actor: AuthUser, targetUserId: string) {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { role: { select: { permissions: true } } },
  });
  if (!target) throw new ServiceError("User not found.");
  const missing = target.role.permissions.filter(
    (p) => !actor.role.permissions.includes(p),
  );
  if (missing.length > 0 && targetUserId !== actor.id) {
    throw new ServiceError(
      "This account has more rights than you do, so you cannot change it.",
    );
  }
}

async function assertEmailFree(email: string, exceptUserId?: string) {
  const [user, employee] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.employee.findUnique({ where: { email }, select: { id: true } }),
  ]);
  if (user && user.id !== exceptUserId) {
    throw new ServiceError("A login with this email already exists.");
  }
  if (employee) {
    throw new ServiceError(
      "This email belongs to an employee. Their login is created on the Employees page; use Change role here to give it another role.",
    );
  }
}

/**
 * Creates a login that is NOT an employee (Admin, HR or IT staff): no employee record, so it
 * has no attendance or leave of its own and never appears in employee lists. A random one-time
 * password is returned once; the person must change it at first sign-in.
 */
export async function createUser(
  input: UserCreateInput,
  actor: AuthUser,
): Promise<IssuedLogin> {
  await assertEmailFree(input.email);

  const role = await prisma.role.findUnique({
    where: { id: input.roleId },
    select: { id: true, permissions: true },
  });
  if (!role) throw new ServiceError("Selected role no longer exists.");
  assertCanGrant(actor, role.permissions);

  const password = generateTemporaryPassword();
  await prisma.user.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      passwordHash: await hashPassword(password),
      roleId: role.id,
      employeeId: null,
      isActive: true,
      mustChangePassword: true,
    },
  });
  return { name: input.fullName, email: input.email, password };
}

/** Name and email of a login without an employee record (employees are edited on their own page). */
export async function updateUserDetails(
  input: UserDetailsInput,
  actor: AuthUser,
) {
  const user = await prisma.user.findUnique({
    where: { id: input.id },
    select: { id: true, employeeId: true },
  });
  if (!user) throw new ServiceError("User not found.");
  if (user.employeeId) {
    throw new ServiceError(
      "This login belongs to an employee. Change the name or email on the Employees page.",
    );
  }
  await assertCanManageAccount(actor, input.id);
  await assertEmailFree(input.email, input.id);
  return prisma.user.update({
    where: { id: input.id },
    data: { fullName: input.fullName, email: input.email },
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
  actor: AuthUser,
) {
  const actorId = actor.id;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, roleId: true, role: { select: { name: true } } },
  });
  if (!user) throw new ServiceError("User not found.");
  if (user.roleId === roleId) return user;

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, permissions: true },
  });
  if (!role) throw new ServiceError("Selected role no longer exists.");

  if (user.id === actorId) {
    throw new ServiceError("You cannot change your own role.");
  }
  assertCanGrant(actor, role.permissions);
  await assertCanManageAccount(actor, id);
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
  actor: AuthUser,
) {
  const actorId = actor.id;
  await assertCanManageAccount(actor, id);
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
export async function resetUserPassword(
  id: string,
  actor: AuthUser,
): Promise<IssuedLogin> {
  await assertCanManageAccount(actor, id);
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

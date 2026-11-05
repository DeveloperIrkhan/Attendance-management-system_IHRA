import "server-only";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/action-state";
import type { AuthUser } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { RoleInput } from "@/validations/role.validation";

/** The Admin role always holds every permission, so nobody can lock themselves out. */
export const ADMIN_ROLE = "ADMIN";

export function listRoles() {
  return prisma.role.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true } } },
  });
}

/**
 * Nobody can hand out a right they do not hold themselves. Without this, a person who may
 * manage users or roles could make a role stronger than their own and use it for themselves.
 */
export function assertCanGrant(actor: AuthUser, permissions: readonly string[]) {
  const missing = permissions.filter((p) => !actor.role.permissions.includes(p));
  if (missing.length > 0) {
    throw new ServiceError(
      `You cannot give rights you do not have yourself (${missing.join(", ")}).`,
    );
  }
}

async function assertNameFree(name: string, exceptId?: string) {
  const clash = await prisma.role.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new ServiceError("A role with this name already exists.");
}

export async function createRole(input: RoleInput, actor: AuthUser) {
  await assertNameFree(input.name);
  assertCanGrant(actor, input.permissions);
  return prisma.role.create({
    data: {
      name: input.name,
      description: input.description,
      permissions: input.permissions,
      isSystem: false,
    },
  });
}

export async function updateRole(
  id: string,
  input: RoleInput,
  actor: AuthUser,
) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new ServiceError("Role not found.");

  if (role.name === ADMIN_ROLE) {
    throw new ServiceError(
      "The Admin role always has every right and cannot be changed.",
    );
  }
  if (role.isSystem && input.name !== role.name) {
    throw new ServiceError("A built-in role cannot be renamed.");
  }
  await assertNameFree(input.name, id);

  // Only newly added rights are checked: removing rights is always allowed.
  assertCanGrant(
    actor,
    input.permissions.filter((p) => !role.permissions.includes(p)),
  );

  // Do not let an admin remove their own way back in.
  if (actor.role.id === id) {
    for (const keep of [PERMISSIONS.ROLES_MANAGE, PERMISSIONS.USERS_MANAGE]) {
      if (role.permissions.includes(keep) && !input.permissions.includes(keep)) {
        throw new ServiceError(
          "You cannot remove users / roles management from your own role.",
        );
      }
    }
  }

  return prisma.role.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      permissions: input.permissions,
    },
  });
}

export async function deleteRole(id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!role) throw new ServiceError("Role not found.");
  if (role.isSystem) throw new ServiceError("A built-in role cannot be deleted.");
  if (role._count.users > 0) {
    throw new ServiceError(
      `${role._count.users} user(s) still have this role. Move them to another role first.`,
    );
  }
  await prisma.role.delete({ where: { id } });
}


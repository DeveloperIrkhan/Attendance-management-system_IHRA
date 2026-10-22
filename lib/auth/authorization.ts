import { cache } from "react";
import { getSession } from "./session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Permission } from "./permissions";
import { NextResponse } from "next/server";
import { User } from "../generated/prisma/client";

// Loads the user fresh from the DB,
// so deactivation and role changes apply immediately.
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      isActive: true,
      mustChangePassword: true,
      employeeId: true,
      role: { select: { id: true, name: true, permissions: true } },
    },
  });

  if (!user || !user.isActive) return null;
  return user;
});

export type AuthUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export function hasPermission(user: AuthUser, ...permissions: Permission[]) {
  return permissions.some((p) => user.role.permissions.includes(p));
}

/** For pages / server components. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}

// For pages  User needs ANY of the listed permissions.
export async function requirePermission(...permissions: Permission[]) {
  const user = await requireUser();
  if (!hasPermission(user, ...permissions)) redirect("/unauthorized");
  return user;
}

type ApiAuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: NextResponse };


export async function apiAuth(
  options: { permissions?: Permission[]; allowPasswordChange?: boolean } = {},
): Promise<ApiAuthResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (user.mustChangePassword && !options.allowPasswordChange) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Password change required" },
        { status: 403 },
      ),
    };
  }
  if (
    options.permissions?.length &&
    !hasPermission(user, ...options.permissions)
  ) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}

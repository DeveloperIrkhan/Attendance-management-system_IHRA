import { hashPassword, verifyPassword } from "@/lib/auth/password.service";
import { apiAuth } from "@/lib/auth/authorization";
import type { User } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/validations/auth.validation";
import {  NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await apiAuth({ allowPasswordChange: true });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  const existingUser = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { passwordHash: true },
  });

  if (
    !existingUser ||
    !(await verifyPassword(currentPassword, existingUser.passwordHash))
  ) {
    return NextResponse.json(
      { success: false, message: "Current password is incorrect" },
      { status: 400 },
    );
  }
  //checking currentPassword and newPassword
  if (currentPassword === newPassword) {
    return NextResponse.json(
      { success: false, message: "New password must be different" },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
  return NextResponse.json(
    { success: true, message: "Password changed successfully" },
    { status: 200 },
  );
}

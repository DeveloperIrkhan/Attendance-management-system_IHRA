import { DUMMY_HASH, verifyPassword } from "@/lib/auth/password.service";
import { getHomePath } from "@/lib/auth/permissions";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/validations/auth.validation";
import { NextResponse } from "next/server";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const INVALID = { error: "Invalid email or password" };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsedValues = loginSchema.safeParse(body);
  if (!parsedValues.success) {
    return NextResponse.json(
      {
        error: parsedValues.error.issues[0].message,
      },
      { status: 400 },
    );
  }

  const { email, password } = parsedValues.data;
  console.log(email, password);
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: { select: { permissions: true } } },
  });

  if (!user) {
    await verifyPassword(password, DUMMY_HASH);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    if (updated.failedLoginAttempts >= MAX_ATTEMPTS) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000),
        },
      });
    }
    return NextResponse.json(INVALID, { status: 401 });
  }

  // if user is lock or not
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return NextResponse.json(
      { error: `Account temporarily locked. Try again in ${mins} minute(s).` },
      { status: 423 },
    );
  }

  //password checking
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    if (updated.failedLoginAttempts >= MAX_ATTEMPTS) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000),
        },
      });
    }
    return NextResponse.json(INVALID, { status: 401 });
  }

  if (!user.isActive) {
    return NextResponse.json(
      { error: "Your account is disabled. Contact the administrator." },
      { status: 403 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  await createSession(user.id);
  return NextResponse.json({
    redirectTo: user.mustChangePassword
      ? "/change-password"
      : getHomePath(user.role.permissions),
  });
}

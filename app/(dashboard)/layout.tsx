import { Suspense } from "react";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/authorization";
import LogoutButton from "@/components/LogoutButton";
export const instant = false;
async function AuthShell({ children }: { children: ReactNode }) {
  await connection();

  const user = await requireUser();

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <span className="font-semibold">Attendance System</span>

        <div className="flex items-center gap-3 text-sm">
          <span>
            {user.fullName}{" "}
            <span className="text-zinc-500">({user.role.name})</span>
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="p-6">{children}</main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<div className="p-6">Loading dashboard...</div>}>
      <AuthShell>{children}</AuthShell>
    </Suspense>
  );
}
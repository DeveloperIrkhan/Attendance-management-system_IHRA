import Link from "next/link";
import { Bell, Fingerprint, Search } from "lucide-react";
import SidebarNav from "./SidebarNav";
import type { NavSection } from "./nav";
import { MONTHS } from "@/lib/attendance/months";
import LogoutButton from "../LogoutButton";
import Image from "next/image";

type Props = {
  user: { fullName: string; roleName: string };
  sections: NavSection[];
  canSearchEmployees: boolean;
  notifications: number;
  lastImport: { month: number; year: number; status: string } | null;
  canViewImports: boolean;
  children: React.ReactNode;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

const IMPORT_LABEL: Record<string, { text: string; className: string }> = {
  COMPLETED: { text: "Completed", className: "text-green-400" },
  COMPLETED_WITH_ERRORS: {
    text: "Needs attention",
    className: "text-amber-400",
  },
  FAILED: { text: "Failed", className: "text-red-400" },
};

export default function AppShell({
  user,
  sections,
  canSearchEmployees,
  notifications,
  lastImport,
  canViewImports,
  children,
}: Props) {
  const importLabel = lastImport
    ? (IMPORT_LABEL[lastImport.status] ?? {
        text: lastImport.status,
        className: "text-slate-300",
      })
    : null;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-white">
            <Image
              src={"/logo.png"}
              height={200}
              width={200}
              alt="logo"
              className="w-10 h-10"
            />
          </span>
          <div className="leading-tight">
            <p className="font-semibold text-white">IHRA Attendance</p>
            <p className="text-xs text-slate-400">system dashboard</p>
          </div>
        </div>

        <SidebarNav sections={sections} />

        {canViewImports && (
          <div className="m-3 rounded-lg bg-slate-800 p-4 text-sm">
            <p className="font-medium text-white">Last import</p>
            {lastImport && importLabel ? (
              <>
                <p className="mt-1 text-slate-300">
                  {MONTHS[lastImport.month - 1]} {lastImport.year}{" "}
                  <span className={importLabel.className}>
                    ({importLabel.text})
                  </span>
                </p>
                <Link
                  href="/attendance/imports"
                  className="mt-2 inline-block text-green-400 hover:underline"
                >
                  View import history
                </Link>
              </>
            ) : (
              <p className="mt-1 text-slate-400">Nothing imported yet.</p>
            )}
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-green-800 text-white lg:hidden">
              <Fingerprint size={18} aria-hidden />
            </span>

            {canSearchEmployees ? (
              <form
                action="/employees"
                method="get"
                className="relative hidden max-w-md flex-1 sm:block"
              >
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  name="q"
                  type="search"
                  placeholder="Search employees by name, code or ID"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-green-500 focus:bg-white focus:outline-none"
                />
              </form>
            ) : (
              <div className="flex-1" />
            )}
            <div className="flex-1 sm:hidden" />

            <div className="ml-auto flex items-center gap-3">
              <Link
                href="/dashboard#attention"
                aria-label={
                  notifications > 0
                    ? `${notifications} items need attention`
                    : "Nothing needs attention"
                }
                className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-green-500"
              >
                <Bell size={20} aria-hidden />
                {notifications > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {notifications > 99 ? "99+" : notifications}
                  </span>
                )}
              </Link>

              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {initials(user.fullName)}
                </span>
                <div className="hidden leading-tight sm:block">
                  <p className="text-sm font-medium">{user.fullName}</p>
                  <p className="text-xs text-slate-500">
                    {user.roleName.replaceAll("_", " ").toLowerCase()}
                  </p>
                </div>
              </div>
              <LogoutButton />
            </div>
          </div>
          <SidebarNav sections={sections} orientation="horizontal" />
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

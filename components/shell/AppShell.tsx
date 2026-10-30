"use client";
import Link from "next/link";
import {
  Bell,
  Fingerprint,
  KeyRound,
  LogOut,
  Search,
  ShieldCheck,
  User,
} from "lucide-react";
import SidebarNav from "./SidebarNav";
import type { NavSection } from "./nav";
import { MONTHS } from "@/lib/attendance/months";
import LogoutButton from "../LogoutButton";
import Image from "next/image";
import LogoutMenu from "../LogoutMenu";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

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
        className: "text-green-300",
      })
    : null;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const logout = async () => {
    try {
      const response = await axios.post("/api/auth/logout");
      if (response.data?.success) {
        router.replace(response.data.redirectTo);
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    }
  };
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  return (
    <div className="flex min-h-screen bg-green-50 text-green-900">
      {/* Sidebar: fixed to the left edge, full screen height (large screens only) */}
      <aside className="hidden w-64 flex-col bg-black lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:h-dvh">
        <div className="flex items-center gap-3 shadow-2xl px-5 py-5">
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
            <p className="text-xs text-green-400">system dashboard</p>
          </div>
        </div>

        <SidebarNav sections={sections} />

        {canViewImports && (
          <div className="m-3 rounded-lg bg-green-800 p-4 text-sm">
            <p className="font-medium text-white">Last import</p>
            {lastImport && importLabel ? (
              <>
                <p className="mt-1 text-green-300">
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
              <p className="mt-1 text-green-400">Nothing imported yet.</p>
            )}
          </div>
        )}
      </aside>

      {/* Main area: pl-64 leaves room for the fixed sidebar (same as the sidebar's w-64) */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-green-200 bg-white/95 backdrop-blur">
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
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  aria-hidden
                />
                <input
                  name="q"
                  type="search"
                  placeholder="Search employees by name, code or ID"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-gray-500 focus:bg-white focus:outline-green-800"
                />
              </form>
            ) : (
              <div className="flex-1" />
            )}
            <div className="flex-1 sm:hidden" />

            <div ref={ref} className="ml-auto flex items-center gap-3">
              <Link
                href="/dashboard#attention"
                aria-label={
                  notifications > 0
                    ? `${notifications} items need attention`
                    : "Nothing needs attention"
                }
                className="relative rounded-lg p-2 text-gray-500 hover:bg-green-100 focus-visible:outline-2 focus-visible:outline-gray-500"
              >
                <Bell size={20} aria-hidden />
                {notifications > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {notifications > 99 ? "99+" : notifications}
                  </span>
                )}
              </Link>

              <div
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2.5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-900 text-xs font-semibold text-white">
                  {initials(user.fullName)}
                </span>
              </div>
              {open && (
                <div className="p-3 absolute top-9 right-10 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
                  <div className="p-3 leading-5">
                    <p className="text-md font-medium">{user.fullName}</p>
                    <p className="text-xs text-gray-500">
                      {user.roleName.replaceAll("_", " ").toLowerCase()}
                    </p>
                  </div>
                  <hr className="border-b border-gray-50" />
                  <Link
                    href="/"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                  >
                    <User className="w-4 h-4" /> My Profile
                  </Link>

                  <Link
                    href="/auth/change-password"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                  >
                    <KeyRound className="w-4 h-4" /> Change Password
                  </Link>

                  {user.roleName === "Admin" && (
                    <>
                      <Link
                        href="/dashboard/users/pending-approvals"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4" /> Pending Approvals
                      </Link>
                      <Link
                        href="/dashboard/users/view-all"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4" /> All Users
                      </Link>
                      <Link
                        href="/dashboard/roles/view-all"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4" /> Manage Roles
                      </Link>
                    </>
                  )}

                  <button
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-green-600 hover:bg-green-50 transition-colors border-t border-slate-100"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
          <SidebarNav sections={sections} orientation="horizontal" />
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
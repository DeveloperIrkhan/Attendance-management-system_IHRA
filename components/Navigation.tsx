"use client";

import Link from "next/link";
import { useState } from "react";
import LogoutMenu from "@/components/LogoutMenu";

type NavigationLink = {
  href: string;
  label: string;
};

type NavigationProps = {
  // links: NavigationLink[];
  user: {
    id: string;
    email: string;
    employeeId: string | null;
    fullName: string;
    isActive: boolean;
    mustChangePassword: boolean;
    role: {
      id: string;
      name: string;
      permissions: string[];
    };
  };
};

export default function Navigation({ user }: NavigationProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop navigation */}
      <header className="hidden md:flex items-center justify-between gap-4 bg-green-600 px-6 py-3 text-white shadow-md">
        <nav className="flex items-center gap-5 w-full">
          <span className="font-semibold tracking-widest text-xl w-full text-center">
            Islamabad Healthcare Regulatory Authority (IHRA) Attendance System
          </span>

          {/* {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-white/90 transition hover:text-white"
            >
              {link.label}
            </Link>
          ))} */}
        </nav>

        <LogoutMenu user={user} />
      </header>

      {/* Mobile navigation */}
      <header className="md:hidden border-b bg-green-600 text-white shadow-md">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold">Attendance System</span>

          <button
            type="button"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            onClick={() => setOpen((previous) => !previous)}
            className="rounded w-9 h-9 flex justify-center items-center p-2 text-2xl hover:bg-green-700"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>

        {open && (
          <nav className="flex flex-col gap-1 px-4 pb-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded px-3 py-2 text-white/90 hover:bg-green-700 hover:text-white"
              >
                {link.label}
              </Link>
            ))}

            <div className="border-t flex items-end justify-end border-white/20 pt-3">
              <LogoutMenu user={user} />
            </div>
          </nav>
        )}
      </header>
    </>
  );
}

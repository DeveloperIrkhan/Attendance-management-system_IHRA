"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarDays,
  FileCheck,
  History,
  LayoutDashboard,
  Menu,
  ScrollText,
  SlidersHorizontal,
  Table2,
  TriangleAlert,
  Upload,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { IconKey, NavSection } from "./nav";

const ICONS: Record<IconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  employees: Users,
  departments: Building2,
  designations: Briefcase,
  daily: CalendarCheck,
  monthly: Table2,
  missing: TriangleAlert,
  leaves: CalendarDays,
  import: Upload,
  history: History,
  calendar: Calendar,
  rules: SlidersHorizontal,
  noc: FileCheck,
  audit: ScrollText,
};

export default function SidebarNav({
  sections,
  orientation = "vertical",
}: {
  sections: NavSection[];
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname() ?? "";
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Store the path the menu was opened on. A route change closes it automatically
  // without an effect that synchronises state.
  const [openForPath, setOpenForPath] = useState<string | null>(null);
  const mobileOpen = openForPath === pathname;
  const mobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        mobileRef.current &&
        !mobileRef.current.contains(event.target as Node)
      ) {
        setOpenForPath(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenForPath(null);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  if (orientation === "horizontal") {
    return (
      <div ref={mobileRef} className="relative px-3 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setOpenForPath(mobileOpen ? null : pathname)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-menu"
          className={`inline-flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-green-800 ${
            mobileOpen
              ? "border-green-800 bg-green-800 text-white"
              : "border-green-700 text-green-800 hover:bg-green-50"
          }`}
        >
          {mobileOpen ? (
            <X size={16} aria-hidden />
          ) : (
            <Menu size={16} aria-hidden />
          )}
          {mobileOpen ? "Close menu" : "Menu"}
        </button>

        {mobileOpen && (
          <nav
            id="mobile-nav-menu"
            aria-label="Mobile navigation"
            className="absolute left-3 right-3 top-full z-40 mt-1 max-h-[70vh] overflow-y-auto rounded-lg border border-green-200 bg-white p-2 shadow-xl"
          >
            {sections.map((section) => (
              <div key={section.title} className="py-1 first:pt-0">
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {section.title}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = ICONS[item.icon];
                    const active = isActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpenForPath(null)}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm ${
                            active
                              ? "bg-green-800 text-white"
                              : "text-slate-700 hover:bg-green-50"
                          }`}
                        >
                          <Icon size={16} aria-hidden />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        )}
      </div>
    );
  }

  return (
    <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-none [&::-webkit-scrollbar]:hidden">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-1.5 text-xs font-medium text-slate-500">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-emerald-400 ${
                      active
                        ? "bg-green-800 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <Icon size={18} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

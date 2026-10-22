"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarDays,
  History,
  LayoutDashboard,
  SlidersHorizontal,
  Table2,
  TriangleAlert,
  Upload,
  Users,
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

  if (orientation === "horizontal") {
    return (
      <nav className="flex gap-1 overflow-x-auto px-3 py-2 lg:hidden">
        {sections
          .flatMap((s) => s.items)
          .map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                  isActive(item.href)
                    ? "bg-green-800 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={16} aria-hidden />
                {item.label}
              </Link>
            );
          })}
      </nav>
    );
  }

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
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

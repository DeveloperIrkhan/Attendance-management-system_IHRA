import Link from "next/link";

const TABS = [
  { href: "/leaves", label: "Leave requests", managerOnly: false },
  { href: "/leaves/short", label: "Short leaves", managerOnly: false },
  { href: "/leaves/types", label: "Leave types", managerOnly: true },
  { href: "/leaves/balances", label: "Balances", managerOnly: false },
];

export default function LeaveTabs({
  active,
  canManage = true,
}: {
  active: string;
  /** false for read-only viewers (a DD, CEO, Chairman): leave types are not shown to them */
  canManage?: boolean;
}) {
  return (
    <nav className="flex flex-wrap gap-2 border-b pb-3 text-sm">
      {TABS.filter((t) => canManage || !t.managerOnly).map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rounded px-3 py-1 ${
            t.href === active
              ? "border hoverEffect border-green-800 bg-green-800 text-white"
              : "border hoverEffect border-green-800 hover:bg-green-800 text-green-800 hover:text-white"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

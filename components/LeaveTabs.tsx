import Link from "next/link";

const TABS = [
  { href: "/leaves", label: "Leave requests" },
  { href: "/leaves/short", label: "Short leaves" },
  { href: "/leaves/types", label: "Leave types" },
  { href: "/leaves/balances", label: "Balances" },
];

export default function LeaveTabs({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap gap-2 border-b pb-3 text-sm">
      {TABS.map((t) => (
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
